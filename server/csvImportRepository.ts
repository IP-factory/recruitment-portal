/**
 * CSV Assessment Question Import — server repository.
 *
 * Two responsibilities, both database-backed:
 *   1. `previewCsvImport` — augment the pure parse/validate result from
 *      shared/csvImport.ts with ROLE-SCOPED checks that need TiDB: does each
 *      dimension exist in this role's Evaluation Framework, does the question
 *      code already exist (CSV never overwrites), and does an EVIDENCE claimed
 *      reference resolve? Returns a preview DTO; writes nothing.
 *   2. `confirmCsvImport` — re-runs the SAME validation server-authoritatively
 *      (the client preview is never trusted), refuses to write unless every row
 *      is valid, then persists every question, its nested configuration and its
 *      assessment assignment in ONE transaction (task #29 atomicity).
 *
 * SCORING SAFETY: imported questions are written to the exact same tables, with
 * the exact same shapes, as manually created Question Bank questions — the
 * nested configuration is produced by reusing `insertNestedConfiguration` from
 * the Question Bank repository. Scored questions persist `maxScore = 5` and the
 * configured `qWeight`, identical to `createQuestion`. The two new metadata
 * columns (`scope`, `owner_role_id`) are never read by the scoring engine, so an
 * imported question is indistinguishable from a manual one once assigned.
 */
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import {
  assessmentDimensions,
  assessmentQuestionAssignments,
  assessmentQuestions,
  assessments,
  type RecruitmentRole,
} from "../drizzle/schema";
import { getRecruitmentRoleByIdOrSlug } from "./recruitmentRepository";
import { insertNestedConfiguration, newId } from "./questionBankRepository";
import { buildUniqueSlug, updateAssessmentStatus } from "./assessmentRepository";
import { getDatabase } from "./db";
import { isScoredQuestionType, SCORED_QUESTION_MAX } from "../shared/questionBankApi";
import {
  buildFrameworkPreview,
  CSV_SCOPES,
  MAX_CSV_QUESTIONS,
  parseAndValidateCsv,
  type CsvFrameworkPreviewDto,
  type CsvFrameworkState,
  type CsvImportPreviewDto,
  type CsvImportResultDto,
  type CsvParsedRow,
  type CsvScope,
} from "../shared/csvImport";
import { randomBytes } from "node:crypto";

/** Safe 400-class failure carrying a user-facing message. */
export class CsvImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportValidationError";
  }
}

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

interface RoleDimension {
  id: string;
  reference: string;
  name: string;
  weight: number;
  minimumFloor: number | null;
}

interface TargetAssessment {
  /** Null when the role has no assessment yet and one will be created. */
  id: string | null;
  name: string;
  status: string;
  slug: string | null;
  version: number;
  willCreate: boolean;
}

/** A parsed CSV row plus its resolved dimension id and merged error list. */
interface PreparedRow {
  row: CsvParsedRow;
  dimensionId: string | null;
  /** All errors — structural + framework. Governs `valid` in the preview. */
  errors: string[];
  /** Only framework-related errors (dimension missing/conflict). When all
   *  errors are framework errors the row is `structurallyValid` even though
   *  it cannot be imported yet. */
  frameworkErrors: string[];
}

interface PreparedImport {
  role: RecruitmentRole;
  dimensions: RoleDimension[];
  target: TargetAssessment;
  rows: PreparedRow[];
  fileErrors: string[];
  detected: number;
  frameworkState: CsvFrameworkState;
  frameworkPreview: CsvFrameworkPreviewDto | null;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Dimensions belonging to THIS role — the authoritative framework for import. */
async function loadRoleDimensions(roleId: string): Promise<RoleDimension[]> {
  const db = getDatabase();
  return db
    .select({
      id: assessmentDimensions.id,
      reference: assessmentDimensions.reference,
      name: assessmentDimensions.name,
      weight: assessmentDimensions.weight,
      minimumFloor: assessmentDimensions.minimumFloor,
    })
    .from(assessmentDimensions)
    .where(eq(assessmentDimensions.roleId, roleId))
    .orderBy(asc(assessmentDimensions.displayOrder));
}

/**
 * Resolve the assessment an import will land in: the role's highest-version
 * assessment, or a new Draft when the role has none (task #21). A new assessment
 * is created as Draft so an Admin activates it deliberately — matching the way
 * the live BDO assessment was staged.
 */
async function resolveTargetAssessment(role: RecruitmentRole): Promise<TargetAssessment> {
  const db = getDatabase();
  const rows = await db
    .select({ id: assessments.id, name: assessments.name, status: assessments.status, slug: assessments.slug, version: assessments.version })
    .from(assessments)
    .where(eq(assessments.roleId, role.id))
    .orderBy(desc(assessments.version));
  const latest = rows[0];
  if (latest) return { id: latest.id, name: latest.name, status: latest.status, slug: latest.slug, version: latest.version, willCreate: false };
  return { id: null, name: `${role.title} Assessment`, status: "Draft", slug: null, version: 1, willCreate: true };
}

// ── Validation (shared by preview + confirm) ──────────────────────────────────

async function prepareImport(roleIdOrSlug: string, csvText: string): Promise<PreparedImport> {
  const role = await getRecruitmentRoleByIdOrSlug(roleIdOrSlug);
  if (!role) throw new CsvImportValidationError("Unable to load this role.");

  const dimensions = await loadRoleDimensions(role.id);
  const dimensionByReference = new Map(dimensions.map((dimension) => [dimension.reference.toUpperCase(), dimension]));

  const parsed = parseAndValidateCsv(csvText);
  const fileErrors = [...parsed.errors];

  // ── Framework state ────────────────────────────────────────────────────────
  // Build the framework preview using the pure helper, then derive the state
  // the client will use to decide which notice to display.
  const frameworkPreviewRaw = buildFrameworkPreview(parsed.frameworkDimensions, dimensions);

  let frameworkState: CsvFrameworkState;
  let frameworkPreview: CsvFrameworkPreviewDto | null = null;

  if (parsed.frameworkDimensions.length === 0) {
    // CSV carries no dimension_code cells at all — treat as ok (the per-row
    // dimension validator will fire its own errors below).
    frameworkState = "ok";
  } else if (frameworkPreviewRaw.conflictingCodes.length > 0) {
    frameworkState = "conflict";
    frameworkPreview = frameworkPreviewRaw;
  } else if (frameworkPreviewRaw.missingCodes.length > 0) {
    frameworkState = dimensions.length === 0 ? "no_framework" : "partial";
    frameworkPreview = frameworkPreviewRaw;
  } else {
    frameworkState = "ok";
    // Even when ok, surface the preview so the client can show a confirmation.
    frameworkPreview = frameworkPreviewRaw;
  }

  // ── Question rows ──────────────────────────────────────────────────────────

  // Batch-resolve existing references so we never overwrite a question (task #19)
  // and so EVIDENCE claimed references pointing outside this file can be checked.
  const db = getDatabase();
  const codes = parsed.rows.map((row) => row.code).filter((code) => code.length > 0);
  const batchCodes = new Set(codes.map((code) => code.toLowerCase()));

  const existingRefs = new Set<string>();
  if (codes.length > 0) {
    const rows = await db.select({ reference: assessmentQuestions.reference }).from(assessmentQuestions).where(inArray(assessmentQuestions.reference, codes));
    rows.forEach((row) => existingRefs.add(row.reference.toLowerCase()));
  }

  const externalClaimed = new Set<string>();
  for (const parsedRow of parsed.rows) {
    const input = parsedRow.input;
    if (input && input.type === "EVIDENCE") {
      const claimed = input.claimedQuestionReference;
      if (claimed && !batchCodes.has(claimed.toLowerCase())) externalClaimed.add(claimed);
    }
  }
  const claimedExists = new Set<string>();
  if (externalClaimed.size > 0) {
    const rows = await db.select({ reference: assessmentQuestions.reference }).from(assessmentQuestions).where(inArray(assessmentQuestions.reference, Array.from(externalClaimed)));
    rows.forEach((row) => claimedExists.add(row.reference.toLowerCase()));
  }

  const preparedRows: PreparedRow[] = parsed.rows.map((row) => {
    const errors = [...row.errors];
    const frameworkErrors: string[] = [];
    let dimensionId: string | null = null;
    const input = row.input;

    if (input) {
      if (!row.dimensionCode) {
        const msg = `Row ${row.rowNumber}: dimension_code is required and must match this role's Evaluation Framework.`;
        errors.push(msg);
        frameworkErrors.push(msg);
      } else {
        const dimension = dimensionByReference.get(row.dimensionCode.toUpperCase());
        if (!dimension) {
          const msg = `Row ${row.rowNumber}: Dimension ${row.dimensionCode} does not exist in this role's Evaluation Framework.`;
          errors.push(msg);
          frameworkErrors.push(msg);
        } else {
          dimensionId = dimension.id;
        }
      }

      if (row.code && existingRefs.has(row.code.toLowerCase())) {
        errors.push(`Row ${row.rowNumber}: Question code "${row.code}" already exists. CSV import creates new questions only.`);
      }

      if (input.type === "EVIDENCE") {
        const claimed = input.claimedQuestionReference;
        if (claimed && !batchCodes.has(claimed.toLowerCase()) && !claimedExists.has(claimed.toLowerCase())) {
          errors.push(`Row ${row.rowNumber}: Claimed question "${claimed}" does not exist.`);
        }
      }
    }

    return { row, dimensionId, errors, frameworkErrors };
  });

  const target = await resolveTargetAssessment(role);
  return { role, dimensions, target, rows: preparedRows, fileErrors, detected: parsed.detected, frameworkState, frameworkPreview };
}

function toPreview(prepared: PreparedImport): CsvImportPreviewDto {
  const rows = prepared.rows.map(({ row, errors, frameworkErrors }) => {
    // `valid` — fully ready to import: no errors at all.
    const valid = errors.length === 0 && row.input !== null;
    // `structurallyValid` — question configuration is correct; only framework
    // errors (dimension not yet created) are preventing full validity.
    const structurallyValid =
      row.input !== null &&
      errors.length === frameworkErrors.length &&
      row.errors.length === 0; // no pure-parser structural errors either
    return {
      rowNumber: row.rowNumber,
      order: row.order,
      code: row.code,
      question: row.question,
      type: row.type,
      dimension: row.dimension,
      qWeight: row.qWeight,
      maxScore: row.maxScore,
      optionCount: row.optionCount,
      status: row.status,
      valid,
      structurallyValid,
      errors,
    };
  });
  const valid = rows.filter((row) => row.valid).length;
  const structurallyValidCount = rows.filter((row) => row.structurallyValid).length;
  return {
    detected: prepared.detected,
    valid,
    structurallyValidCount,
    errorCount: rows.length - valid,
    rows,
    errors: prepared.fileErrors,
    dimensions: prepared.dimensions.map((dimension) => ({ reference: dimension.reference, name: dimension.name })),
    assessment: { id: prepared.target.id, name: prepared.target.name, status: prepared.target.status, willCreate: prepared.target.willCreate },
    frameworkState: prepared.frameworkState,
    frameworkPreview: prepared.frameworkPreview,
  };
}

/** Validate a CSV against a role and return the Import Preview (writes nothing). */
export async function previewCsvImport(roleIdOrSlug: string, csvText: string): Promise<CsvImportPreviewDto> {
  return toPreview(await prepareImport(roleIdOrSlug, csvText));
}

// ── Atomic batch import ───────────────────────────────────────────────────────

async function persistImport(role: RecruitmentRole, target: TargetAssessment, validRows: PreparedRow[], scope: CsvScope): Promise<CsvImportResultDto> {
  const db = getDatabase();
  // Slug is computed before the transaction (a read); the insert happens inside it.
  const slug = target.willCreate ? await buildUniqueSlug(target.name, target.version) : target.slug;

  const assessmentId = await db.transaction(async (tx) => {
    let resolvedAssessmentId = target.id;
    if (!resolvedAssessmentId) {
      resolvedAssessmentId = newId("assessment");
      await tx.insert(assessments).values({
        id: resolvedAssessmentId,
        slug: slug ?? "assessment",
        roleId: role.id,
        name: target.name,
        description: `Questions imported from CSV for ${role.title}.`,
        status: "Draft",
        version: target.version,
      });
    }

    // Pass A — insert every question row first. This guarantees that an EVIDENCE
    // question whose claimed reference points at another row in the SAME file
    // resolves during Pass B (insertNestedConfiguration looks the claim up by
    // reference). Scope metadata is the only addition over createQuestion.
    const idByCode = new Map<string, string>();
    for (const prepared of validRows) {
      const input = prepared.row.input!;
      const questionId = newId("question");
      idByCode.set(prepared.row.code, questionId);
      const scored = isScoredQuestionType(input.type);
      const qWeight = scored && "qWeight" in input ? (input.qWeight as number) : null;
      await tx.insert(assessmentQuestions).values({
        id: questionId,
        reference: input.reference,
        dimensionId: prepared.dimensionId,
        questionType: input.type,
        prompt: input.prompt,
        helpText: input.helpText,
        qWeight,
        maxScore: scored ? SCORED_QUESTION_MAX : null,
        required: input.required ? 1 : 0,
        status: input.status,
        timeLimitSec: input.timeLimitSec,
        scope: scope === "ROLE_ONLY" ? "ROLE_ONLY" : "QUESTION_BANK",
        ownerRoleId: scope === "ROLE_ONLY" ? role.id : null,
      });
    }

    // Pass B — nested configuration, reusing the Question Bank writer so an
    // imported question is structurally identical to a manually created one.
    for (const prepared of validRows) {
      await insertNestedConfiguration(tx, idByCode.get(prepared.row.code)!, prepared.row.input!);
    }

    // Pass C — append assignments after the existing count. The CSV display_order
    // is the RELATIVE order of the newly imported questions (task #20); existing
    // assignments are never renumbered, so a live assessment stays intact.
    const [existing] = await tx
      .select({ value: count() })
      .from(assessmentQuestionAssignments)
      .where(eq(assessmentQuestionAssignments.assessmentId, resolvedAssessmentId));
    let nextOrder = existing?.value ?? 0;
    const ordered = [...validRows].sort((a, b) => (a.row.order ?? 0) - (b.row.order ?? 0) || a.row.rowNumber - b.row.rowNumber);
    for (const prepared of ordered) {
      nextOrder += 1;
      await tx.insert(assessmentQuestionAssignments).values({
        id: newId("assignment"),
        assessmentId: resolvedAssessmentId,
        questionId: idByCode.get(prepared.row.code)!,
        displayOrder: nextOrder,
      });
    }

    return resolvedAssessmentId;
  });

  const [finalAssessment] = await db
    .select({ name: assessments.name, slug: assessments.slug })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  return {
    assessmentId,
    assessmentName: finalAssessment?.name ?? target.name,
    assessmentSlug: finalAssessment?.slug ?? slug ?? "assessment",
    importedCount: validRows.length,
    scope,
    createdAssessment: target.willCreate,
  };
}

/**
 * Create missing Evaluation Framework dimensions from a previously-parsed CSV.
 *
 * Uses the SAME `assessmentDimensions` table as the manual Evaluation Framework
 * editor. The scoring engine reads from that table and is completely unaware of
 * whether dimensions were created manually or from CSV.
 *
 * Rules enforced server-authoritatively (never trust the client preview):
 *   - Role must exist.
 *   - Each dimension to create must carry a non-empty name and a positive weight.
 *   - The dimension code must not already exist for this role (no silent overwrite).
 *   - After adding the new dimensions, the TOTAL weight across all role dimensions
 *     must equal 100.
 *   - All creates happen in one transaction; a single failure rolls everything back.
 *
 * Returns the refreshed preview so the client can re-run validation in one round trip.
 */
export async function createCsvFramework(roleIdOrSlug: string, csvText: string): Promise<CsvImportPreviewDto> {
  const role = await getRecruitmentRoleByIdOrSlug(roleIdOrSlug);
  if (!role) throw new CsvImportValidationError("Unable to load this role.");

  const db = getDatabase();

  // Re-parse the CSV server-authoritatively — never trust the client preview.
  const parsed = parseAndValidateCsv(csvText);
  if (parsed.frameworkDimensions.length === 0) {
    throw new CsvImportValidationError("The CSV does not contain any dimension information.");
  }

  const existingDimensions = await loadRoleDimensions(role.id);
  const existingByCode = new Map(existingDimensions.map((d) => [d.reference.toUpperCase(), d]));

  // Identify the dimensions that actually need to be created.
  const toCreate = parsed.frameworkDimensions.filter((d) => !existingByCode.has(d.code));

  if (toCreate.length === 0) {
    // All dimensions already exist — nothing to create, just re-run preview.
    return previewCsvImport(roleIdOrSlug, csvText);
  }

  // ── Server-side validation ─────────────────────────────────────────────────

  for (const dim of toCreate) {
    // Consistency across CSV rows.
    if (!dim.consistent) {
      throw new CsvImportValidationError(
        `Dimension ${dim.code} has inconsistent configuration across rows: ${dim.inconsistencyReason}`,
      );
    }
    // Name required.
    if (!dim.name || dim.name.trim() === "") {
      throw new CsvImportValidationError(
        `The CSV does not contain enough information to create the Evaluation Framework automatically: dimension_name is missing for ${dim.code}.`,
      );
    }
    // Weight required and positive.
    if (dim.weight === null || Number.isNaN(dim.weight)) {
      throw new CsvImportValidationError(
        `The CSV does not contain enough information to create the Evaluation Framework automatically: dimension_weight is missing for ${dim.code}.`,
      );
    }
    if (dim.weight <= 0) {
      throw new CsvImportValidationError(
        `Dimension ${dim.code} has an invalid dimension_weight: weight must be greater than zero.`,
      );
    }
    // Floor, when present, must be a valid non-NaN number.
    if (dim.floor !== null && Number.isNaN(dim.floor)) {
      throw new CsvImportValidationError(
        `Dimension ${dim.code} has an invalid dimension_floor value in the CSV.`,
      );
    }
    // No conflict with existing dimension of the same code.
    const existing = existingByCode.get(dim.code);
    if (existing) {
      // This should have been caught above, but double-check.
      throw new CsvImportValidationError(
        `Dimension ${dim.code} already exists for this role. Existing dimensions cannot be overwritten via CSV.`,
      );
    }
  }

  // Weight total must reach exactly 100 after the new dimensions are added.
  const existingWeightTotal = existingDimensions.reduce((sum, d) => sum + d.weight, 0);
  const newWeightTotal = toCreate.reduce((sum, d) => sum + (d.weight ?? 0), 0);
  const projectedTotal = existingWeightTotal + newWeightTotal;
  if (projectedTotal !== 100) {
    throw new CsvImportValidationError(
      `Dimension weights total ${projectedTotal}% after adding the new dimensions. The full framework must total 100%.`,
    );
  }

  // ── Atomic creation ────────────────────────────────────────────────────────

  const nextDisplayOrder = existingDimensions.length;

  await db.transaction(async (tx) => {
    for (let i = 0; i < toCreate.length; i++) {
      const dim = toCreate[i]!;
      const id = `dim-${randomBytes(8).toString("hex")}`;
      const floor = dim.floor !== null && !Number.isNaN(dim.floor) ? Math.round(dim.floor) : null;
      await tx.insert(assessmentDimensions).values({
        id,
        roleId: role.id,
        reference: dim.code,
        name: dim.name!.trim(),
        weight: Math.round(dim.weight!),
        minimumFloor: floor,
        displayOrder: nextDisplayOrder + i + 1,
        status: "Active",
      });
    }
  });

  // Re-run the full preview against the now-updated framework so the client
  // Re-run the full preview against the now-updated framework so the client
  // gets a fresh result without needing a second round-trip.
  return previewCsvImport(roleIdOrSlug, csvText);
}

/**
 * Validate then atomically import a CSV into the role's assessment. Refuses to
 * write anything unless every row is valid — a single invalid row aborts the
 * whole import with a restrained message.
 */
export async function confirmCsvImport(roleIdOrSlug: string, csvText: string, scope: CsvScope): Promise<CsvImportResultDto> {
  if (!(CSV_SCOPES as readonly string[]).includes(scope)) {
    throw new CsvImportValidationError("Choose where to store the imported questions.");
  }

  const prepared = await prepareImport(roleIdOrSlug, csvText);
  const preview = toPreview(prepared);

  if (preview.errors.length > 0) throw new CsvImportValidationError(preview.errors[0]);
  const invalid = preview.rows.find((row) => !row.valid);
  if (invalid) throw new CsvImportValidationError(invalid.errors[0] ?? `Row ${invalid.rowNumber} is not valid.`);
  if (preview.detected === 0) throw new CsvImportValidationError("No question rows were found in the file.");
  if (preview.detected > MAX_CSV_QUESTIONS) {
    throw new CsvImportValidationError(`The file contains ${preview.detected} questions, exceeding the ${MAX_CSV_QUESTIONS}-question limit.`);
  }

  const validRows = prepared.rows.filter((preparedRow) => preparedRow.errors.length === 0 && preparedRow.row.input !== null);
  const result = await persistImport(prepared.role, prepared.target, validRows, scope);

  // Auto-activate: when CSV import creates or lands in a Draft assessment,
  // immediately set it Active so applicants can access it right away.
  // The Admin can change status at any time from the Assessment detail page.
  try {
    await updateAssessmentStatus(result.assessmentId, "Active");
  } catch {
    // Non-fatal: the import succeeded; status change failure is logged but
    // does not roll back the questions already persisted.
    console.error("[csv-import] auto-activate failed for assessment", result.assessmentId);
  }

  return result;
}
