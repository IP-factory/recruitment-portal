/**
 * Task 24C-2 — Question Bank repository layer.
 *
 * Reusable, testable TiDB access for the Admin Question Bank domain. Express
 * handlers use these functions instead of embedding Drizzle queries directly.
 * All multi-table writes run in a single transaction so a failed save never
 * leaves partial question configuration behind.
 */
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import {
  assessmentCrossChecks,
  assessmentDimensions,
  assessmentQuestionAssignments,
  assessmentQuestions,
  assessments,
  eligibilityGates,
  numericQuestionConfigs,
  numericScoringBands,
  openQuestionConfigs,
  openRubricAnchors,
  questionEvidenceLinks,
  questionOptions,
  questionTypeConfigs,
} from "../drizzle/schema";
import {
  formatUsedInLabel,
  isScoredQuestionType,
  SCORED_QUESTION_MAX,
  type AdminNumericConfig,
  type AdminOpenConfig,
  type AdminQuestionCrossCheck,
  type AdminQuestionDetail,
  type AdminQuestionListItem,
  type AdminQuestionListResponse,
  type AdminQuestionOption,
  type QuestionDimensionEntry,
  type QuestionInput,
  type QuestionListQuery,
  type QuestionListSortKey,
} from "../shared/questionBankApi";
import { getDatabase } from "./db";

/** Safe 400-class failure carrying a user-facing message. */
export class QuestionBankValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionBankValidationError";
  }
}

export const newId = (prefix: string) => `${prefix}-${randomBytes(12).toString("hex")}`;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type QuestionRow = typeof assessmentQuestions.$inferSelect;

// ── Dimensions (resolved from the database — never hard-coded twice) ─────────

export async function getQuestionDimensions(): Promise<QuestionDimensionEntry[]> {
  const db = getDatabase();
  const rows = await db
    .select({ reference: assessmentDimensions.reference, name: assessmentDimensions.name })
    .from(assessmentDimensions)
    .orderBy(asc(assessmentDimensions.displayOrder));
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.reference) ? false : (seen.add(row.reference), true)));
}

// ── List ──────────────────────────────────────────────────────────────────────

const SORT_COLUMNS: Record<QuestionListSortKey, SQL> = {
  reference: sql`${assessmentQuestions.reference}`,
  dimension: sql`COALESCE(${assessmentDimensions.reference}, '~')`,
  type: sql`${assessmentQuestions.questionType}`,
  qWeight: sql`COALESCE(${assessmentQuestions.qWeight}, 0)`,
  status: sql`${assessmentQuestions.status}`,
};

export async function listQuestions(query: QuestionListQuery): Promise<AdminQuestionListResponse> {
  const db = getDatabase();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 10));
  const search = query.search?.trim() ?? "";

  const conditions = [];
  // Role-only imported questions are scoped to a single role and must never
  // pollute the reusable Question Bank list.
  conditions.push(eq(assessmentQuestions.scope, "QUESTION_BANK"));
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(like(assessmentQuestions.reference, term), like(assessmentQuestions.prompt, term)));
  }
  if (query.type) conditions.push(eq(assessmentQuestions.questionType, query.type));
  if (query.status) conditions.push(eq(assessmentQuestions.status, query.status));
  if (query.dimension === "GATE") conditions.push(isNull(assessmentQuestions.dimensionId));
  else if (query.dimension) conditions.push(eq(assessmentDimensions.reference, query.dimension));
  const where = conditions.length ? and(...conditions) : undefined;

  const joinDimension = () => db.select({
    id: assessmentQuestions.id,
    reference: assessmentQuestions.reference,
    questionType: assessmentQuestions.questionType,
    qWeight: assessmentQuestions.qWeight,
    status: assessmentQuestions.status,
    prompt: assessmentQuestions.prompt,
    dimensionReference: assessmentDimensions.reference,
    dimensionName: assessmentDimensions.name,
  }).from(assessmentQuestions).leftJoin(assessmentDimensions, eq(assessmentQuestions.dimensionId, assessmentDimensions.id));

  const [totalRow] = await db.select({ value: count() }).from(assessmentQuestions).leftJoin(assessmentDimensions, eq(assessmentQuestions.dimensionId, assessmentDimensions.id)).where(where);
  const total = totalRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortKey = query.sortKey && SORT_COLUMNS[query.sortKey] ? query.sortKey : "reference";
  const sortColumn = SORT_COLUMNS[sortKey];
  const ordered = query.sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn);

  const rows = await joinDimension().where(where).orderBy(ordered, asc(assessmentQuestions.reference)).limit(pageSize).offset((Math.min(page, totalPages) - 1) * pageSize);

  const usedInByQuestion = await getUsedInLabels(rows.map((row) => row.id));
  const [dimensions, summary] = await Promise.all([getQuestionDimensions(), getQuestionBankSummary()]);

  const items: AdminQuestionListItem[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    type: row.questionType,
    dimension: row.dimensionReference ? { reference: row.dimensionReference, name: row.dimensionName ?? row.dimensionReference } : null,
    qWeight: row.qWeight,
    status: row.status,
    prompt: row.prompt,
    usedIn: usedInByQuestion.get(row.id) ?? [],
  }));

  return { items, total, page: Math.min(page, totalPages), pageSize, totalPages, dimensions, summary };
}

async function getQuestionBankSummary() {
  const db = getDatabase();
  const [totalRow, activeRow] = await Promise.all([
    db.select({ value: count() }).from(assessmentQuestions).where(eq(assessmentQuestions.scope, "QUESTION_BANK")),
    db.select({ value: count() }).from(assessmentQuestions).where(and(eq(assessmentQuestions.scope, "QUESTION_BANK"), eq(assessmentQuestions.status, "Active"))),
  ]);
  const dimensions = await getQuestionDimensions();
  return { total: totalRow[0]?.value ?? 0, active: activeRow[0]?.value ?? 0, dimensionCount: dimensions.length };
}

/** Assessment labels per question, e.g. "Business Development Officer Assessment v2 — Draft". */
async function getUsedInLabels(questionIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (questionIds.length === 0) return result;
  const db = getDatabase();
  const assignments = await db.select().from(assessmentQuestionAssignments).where(inArray(assessmentQuestionAssignments.questionId, questionIds));
  if (assignments.length === 0) return result;
  const assessmentRows = await db.select().from(assessments).where(inArray(assessments.id, Array.from(new Set(assignments.map((row) => row.assessmentId)))));
  const assessmentById = new Map(assessmentRows.map((row) => [row.id, row]));
  for (const assignment of assignments) {
    const assessment = assessmentById.get(assignment.assessmentId);
    if (!assessment) continue;
    const label = formatUsedInLabel(assessment.name, assessment.status);
    const existing = result.get(assignment.questionId) ?? [];
    existing.push(label);
    result.set(assignment.questionId, existing);
  }
  return result;
}

// ── Single-question reads ─────────────────────────────────────────────────────

export async function getQuestionById(id: string): Promise<QuestionRow | null> {
  const db = getDatabase();
  return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, id)).limit(1))[0] ?? null;
}

export async function getQuestionByReference(reference: string): Promise<QuestionRow | null> {
  const db = getDatabase();
  return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.reference, reference)).limit(1))[0] ?? null;
}

/** Resolve an Admin route parameter that may be a database id or a reference. */
export async function getQuestionByIdOrReference(idOrReference: string): Promise<QuestionRow | null> {
  return (await getQuestionById(idOrReference)) ?? (await getQuestionByReference(idOrReference));
}

export async function getQuestionOptions(questionId: string): Promise<AdminQuestionOption[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      displayOrder: questionOptions.displayOrder,
      text: questionOptions.optionText,
      rawScore: questionOptions.rawScore,
      isDecoy: questionOptions.isDecoy,
      outcomeType: questionOptions.outcomeType,
      internalExplanation: questionOptions.internalExplanation,
      verificationMultiplier: questionOptions.verificationMultiplier,
      gateReference: eligibilityGates.reference,
      gateName: eligibilityGates.name,
    })
    .from(questionOptions)
    .leftJoin(eligibilityGates, eq(questionOptions.relatedGateId, eligibilityGates.id))
    .where(eq(questionOptions.questionId, questionId))
    .orderBy(asc(questionOptions.displayOrder));
  return rows.map((row) => ({
    displayOrder: row.displayOrder,
    text: row.text,
    rawScore: row.rawScore,
    isDecoy: Boolean(row.isDecoy),
    outcomeType: row.outcomeType,
    relatedGate: row.gateReference ? { reference: row.gateReference, name: row.gateName ?? row.gateReference } : null,
    internalExplanation: row.internalExplanation,
    verificationMultiplier: row.verificationMultiplier === null ? null : Number(row.verificationMultiplier),
  }));
}

export async function getNumericConfig(questionId: string): Promise<Omit<AdminNumericConfig, "bands"> | null> {
  const db = getDatabase();
  const row = (await db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  const inputDefinitions = parseJson<Array<{ label?: string; unit?: string }>>(row.inputDefinitions, []).map((entry) => ({ label: entry.label ?? "", unit: entry.unit ?? "" }));
  return { mode: row.mode, inputDefinitions, derivedCalculationType: row.derivedCalculationType };
}

export async function getNumericBands(questionId: string): Promise<AdminNumericConfig["bands"]> {
  const db = getDatabase();
  const rows = await db.select().from(numericScoringBands).where(eq(numericScoringBands.questionId, questionId)).orderBy(asc(numericScoringBands.displayOrder));
  return rows.map((row) => ({ lowerBound: Number(row.lowerBound), upperBound: row.upperBound === null ? null : Number(row.upperBound), rawScore: row.rawScore, displayOrder: row.displayOrder }));
}

export async function getOpenConfig(questionId: string): Promise<Omit<AdminOpenConfig, "rubric"> | null> {
  const db = getDatabase();
  const row = (await db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  return { minimumWords: row.minimumWords, maximumWords: row.maximumWords, timeLimitSec: row.timeLimitSec, pasteAllowed: Boolean(row.pasteAllowed) };
}

export async function getOpenRubrics(questionId: string): Promise<AdminOpenConfig["rubric"]> {
  const db = getDatabase();
  const rows = await db.select().from(openRubricAnchors).where(eq(openRubricAnchors.questionId, questionId)).orderBy(asc(openRubricAnchors.displayOrder));
  return rows.map((row) => ({ scoreMin: row.scoreMin, scoreMax: row.scoreMax, anchorText: row.anchorText, displayOrder: row.displayOrder }));
}

export async function getEvidenceLink(questionId: string): Promise<AdminQuestionDetail["evidenceLink"]> {
  const db = getDatabase();
  const rows = await db
    .select({ claimedQuestionId: questionEvidenceLinks.claimedQuestionId, claimedReference: assessmentQuestions.reference })
    .from(questionEvidenceLinks)
    .innerJoin(assessmentQuestions, eq(questionEvidenceLinks.claimedQuestionId, assessmentQuestions.id))
    .where(eq(questionEvidenceLinks.evidenceQuestionId, questionId))
    .limit(1);
  const row = rows[0];
  return row ? { claimedQuestionId: row.claimedQuestionId, claimedQuestionReference: row.claimedReference } : null;
}

export async function getQuestionCrossChecks(questionId: string): Promise<AdminQuestionCrossCheck[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      id: assessmentCrossChecks.id,
      sourceQuestionId: assessmentCrossChecks.sourceQuestionId,
      comparisonQuestionId: assessmentCrossChecks.comparisonQuestionId,
      ruleType: assessmentCrossChecks.ruleType,
      description: assessmentCrossChecks.description,
      defaultOutcome: assessmentCrossChecks.defaultOutcome,
      status: assessmentCrossChecks.status,
      sourceReference: sql<string>`sq.reference`,
      comparisonReference: sql<string>`cq.reference`,
    })
    .from(assessmentCrossChecks)
    .innerJoin(sql`assessment_questions sq`, sql`sq.id = ${assessmentCrossChecks.sourceQuestionId}`)
    .innerJoin(sql`assessment_questions cq`, sql`cq.id = ${assessmentCrossChecks.comparisonQuestionId}`)
    .where(or(eq(assessmentCrossChecks.sourceQuestionId, questionId), eq(assessmentCrossChecks.comparisonQuestionId, questionId)));
  return rows.map((row) => ({
    id: row.id,
    direction: row.sourceQuestionId === questionId ? "source" : "comparison",
    otherQuestionReference: row.sourceQuestionId === questionId ? row.comparisonReference : row.sourceReference,
    ruleType: row.ruleType,
    description: row.description,
    defaultOutcome: row.defaultOutcome,
    status: row.status,
  }));
}

/** MULTI score cap lives in the type configuration snapshot. */
async function getMultiScoreCap(questionId: string): Promise<number | null> {
  const db = getDatabase();
  const row = (await db.select({ configuration: questionTypeConfigs.configuration }).from(questionTypeConfigs).where(eq(questionTypeConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  const configuration = parseJson<{ multiConfig?: { scoreCap?: number } }>(row.configuration, {});
  return typeof configuration.multiConfig?.scoreCap === "number" ? configuration.multiConfig.scoreCap : null;
}

/** Compose the full Admin detail view for one question. */
export async function getQuestionDetail(idOrReference: string): Promise<AdminQuestionDetail | null> {
  const db = getDatabase();
  const question = await getQuestionByIdOrReference(idOrReference);
  if (!question) return null;

  const dimensionRows = question.dimensionId
    ? await db.select({ reference: assessmentDimensions.reference, name: assessmentDimensions.name }).from(assessmentDimensions).where(eq(assessmentDimensions.id, question.dimensionId)).limit(1)
    : [];
  const dimension = dimensionRows[0] ? { reference: dimensionRows[0].reference, name: dimensionRows[0].name } : null;

  const [options, numericConfig, numericBands, openConfig, openRubric, evidenceLink, crossChecks, usedInByQuestion, scoreCap] = await Promise.all([
    getQuestionOptions(question.id),
    getNumericConfig(question.id),
    getNumericBands(question.id),
    getOpenConfig(question.id),
    getOpenRubrics(question.id),
    getEvidenceLink(question.id),
    getQuestionCrossChecks(question.id),
    getUsedInLabels([question.id]),
    getMultiScoreCap(question.id),
  ]);

  return {
    id: question.id,
    reference: question.reference,
    type: question.questionType,
    dimension,
    qWeight: question.qWeight,
    maxScore: question.maxScore,
    required: Boolean(question.required),
    prompt: question.prompt,
    helpText: question.helpText,
    status: question.status,
    timeLimitSec: question.timeLimitSec,
    usedIn: usedInByQuestion.get(question.id) ?? [],
    options,
    scoreCap,
    numericConfig: numericConfig ? { ...numericConfig, bands: numericBands } : null,
    openConfig: openConfig ? { ...openConfig, rubric: openRubric } : null,
    evidenceLink,
    crossChecks,
    updatedAt: new Date(question.updatedAt).toISOString(),
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────

async function resolveDimensionId(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], dimensionReference: string | null): Promise<string | null> {
  if (!dimensionReference) return null;
  const rows = await tx.select({ id: assessmentDimensions.id }).from(assessmentDimensions).where(eq(assessmentDimensions.reference, dimensionReference)).limit(1);
  if (!rows[0]) throw new QuestionBankValidationError("The selected dimension does not exist.");
  return rows[0].id;
}

async function resolveGateId(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], gateReference: string | null): Promise<string | null> {
  if (!gateReference) return null;
  const rows = await tx.select({ id: eligibilityGates.id }).from(eligibilityGates).where(eq(eligibilityGates.reference, gateReference)).limit(1);
  if (!rows[0]) throw new QuestionBankValidationError(`The related gate "${gateReference}" does not exist.`);
  return rows[0].id;
}

/** Snapshot of the type configuration kept in question_type_configs. */
function buildTypeConfigSnapshot(input: QuestionInput): string {
  const letter = (index: number) => String.fromCharCode(97 + index);
  const letterLabel = (index: number) => String.fromCharCode(65 + index);
  if (input.type === "GATE") {
    const options = input.options.map((option, index) => ({ id: letter(index), label: letterLabel(index), text: option.text, gateOutcome: option.outcomeType }));
    return JSON.stringify({ gateConfig: { options } });
  }
  if (input.type === "ORDINAL") {
    const options = input.options.map((option, index) => {
      const base: Record<string, unknown> = { id: letter(index), label: letterLabel(index), text: option.text };
      if (option.rawScore !== null) base.rawPoints = option.rawScore;
      if (option.outcomeType === "close") {
        base.outcome = "close";
        if (option.relatedGateReference) base.relatedGate = option.relatedGateReference;
      }
      return base;
    });
    return JSON.stringify({ ordinalConfig: { options } });
  }
  if (input.type === "SJT") {
    const options = input.options.map((option, index) => ({ id: letter(index), label: letterLabel(index), text: option.text, rawPoints: option.rawScore, whatThisReveals: option.internalExplanation }));
    return JSON.stringify({ sjtConfig: { options } });
  }
  if (input.type === "MULTI") {
    const options = input.options.map((option, index) => ({ id: letter(index), label: letterLabel(index), text: option.text, rawPoints: option.rawScore, ...(option.isDecoy ? { decoy: true } : {}) }));
    return JSON.stringify({ multiConfig: { options, scoreCap: input.scoreCap } });
  }
  if (input.type === "NUMERIC") {
    const bands = input.numericConfig.bands.map((band, index) => ({ id: `band-${index + 1}`, lowerBound: band.lowerBound, ...(band.upperBound === null ? {} : { upperBound: band.upperBound }), rawPoints: band.rawScore }));
    return JSON.stringify({ numericConfig: { mode: input.numericConfig.mode, inputs: input.numericConfig.inputDefinitions, bands } });
  }
  if (input.type === "OPEN") {
    const rubric = input.openConfig.rubric.map((anchor) => ({ id: anchor.scoreMin === anchor.scoreMax ? String(anchor.scoreMin) : `${anchor.scoreMin}-${anchor.scoreMax}`, points: anchor.scoreMax, anchor: anchor.anchorText }));
    return JSON.stringify({ openConfig: { pasteAllowed: input.openConfig.pasteAllowed, ...(input.openConfig.timeLimitSec === null ? {} : { timeLimitSec: input.openConfig.timeLimitSec }), ...(input.openConfig.maximumWords === null ? {} : { wordLimit: input.openConfig.maximumWords }), rubric } });
  }
  // EVIDENCE
  const options = input.options.map((option, index) => ({ id: letter(index), label: letterLabel(index), text: option.text, verificationMultiplier: option.verificationMultiplier }));
  return JSON.stringify({ evidenceConfig: { pairedQuestionRef: input.claimedQuestionReference, options } });
}

export async function insertNestedConfiguration(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], questionId: string, input: QuestionInput) {
  const insertOptions = async (rows: Array<Partial<typeof questionOptions.$inferInsert> & { optionText: string }>) => {
    await rows.reduce(async (previous, row, index) => {
      await previous;
      await tx.insert(questionOptions).values({ id: newId("option"), questionId, displayOrder: index + 1, isDecoy: 0, ...row });
    }, Promise.resolve());
  };

  if (input.type === "GATE") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: null, outcomeType: option.outcomeType })));
  } else if (input.type === "ORDINAL") {
    const rows = await Promise.all(
      input.options.map(async (option) => ({
        optionText: option.text,
        rawScore: option.rawScore,
        outcomeType: option.outcomeType === "close" ? "close" : null,
        relatedGateId: option.outcomeType === "close" ? await resolveGateId(tx, option.relatedGateReference ?? null) : null,
      })),
    );
    await insertOptions(rows);
  } else if (input.type === "SJT") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: option.rawScore, internalExplanation: option.internalExplanation })));
  } else if (input.type === "MULTI") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: option.rawScore, isDecoy: option.isDecoy ? 1 : 0 })));
  } else if (input.type === "NUMERIC") {
    await tx.insert(numericQuestionConfigs).values({
      id: newId("numeric-config"),
      questionId,
      mode: input.numericConfig.mode,
      inputDefinitions: JSON.stringify(input.numericConfig.inputDefinitions),
      derivedCalculationType: input.numericConfig.derivedCalculationType,
    });
    await input.numericConfig.bands.reduce(async (previous, band, index) => {
      await previous;
      await tx.insert(numericScoringBands).values({ id: newId("band"), questionId, lowerBound: String(band.lowerBound), upperBound: band.upperBound === null ? null : String(band.upperBound), rawScore: band.rawScore, displayOrder: index + 1 });
    }, Promise.resolve());
  } else if (input.type === "OPEN") {
    await tx.insert(openQuestionConfigs).values({
      id: newId("open-config"),
      questionId,
      minimumWords: input.openConfig.minimumWords,
      maximumWords: input.openConfig.maximumWords,
      timeLimitSec: input.openConfig.timeLimitSec,
      pasteAllowed: input.openConfig.pasteAllowed ? 1 : 0,
    });
    await input.openConfig.rubric.reduce(async (previous, anchor, index) => {
      await previous;
      await tx.insert(openRubricAnchors).values({ id: newId("rubric"), questionId, scoreMin: anchor.scoreMin, scoreMax: anchor.scoreMax, anchorText: anchor.anchorText, displayOrder: index + 1 });
    }, Promise.resolve());
  } else {
    // EVIDENCE
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: null, verificationMultiplier: String(option.verificationMultiplier.toFixed(2)) })));
    const claimed = await tx.select({ id: assessmentQuestions.id }).from(assessmentQuestions).where(eq(assessmentQuestions.reference, input.claimedQuestionReference)).limit(1);
    if (!claimed[0]) throw new QuestionBankValidationError(`The claimed question "${input.claimedQuestionReference}" does not exist.`);
    await tx.insert(questionEvidenceLinks).values({ id: newId("evidence-link"), evidenceQuestionId: questionId, claimedQuestionId: claimed[0].id });
  }

  if (input.crossCheck) {
    const comparison = await tx.select({ id: assessmentQuestions.id }).from(assessmentQuestions).where(eq(assessmentQuestions.reference, input.crossCheck.comparisonQuestionReference)).limit(1);
    if (!comparison[0]) throw new QuestionBankValidationError(`The cross-check question "${input.crossCheck.comparisonQuestionReference}" does not exist.`);
    await tx.insert(assessmentCrossChecks).values({
      id: newId("cross-check"),
      sourceQuestionId: questionId,
      comparisonQuestionId: comparison[0].id,
      ruleType: input.crossCheck.ruleType,
      ruleConfiguration: JSON.stringify({ compareQuestionRef: input.crossCheck.comparisonQuestionReference }),
      description: input.crossCheck.description,
      defaultOutcome: input.crossCheck.defaultOutcome,
      status: input.crossCheck.status ?? "Active",
    });
  }

  await tx.insert(questionTypeConfigs).values({ id: newId("type-config"), questionId, configType: input.type, configuration: buildTypeConfigSnapshot(input) }).onDuplicateKeyUpdate({ set: { configType: input.type, configuration: buildTypeConfigSnapshot(input) } });
}

async function deleteNestedConfiguration(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], questionId: string) {
  await tx.delete(questionOptions).where(eq(questionOptions.questionId, questionId));
  await tx.delete(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, questionId));
  await tx.delete(numericScoringBands).where(eq(numericScoringBands.questionId, questionId));
  await tx.delete(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId));
  await tx.delete(openRubricAnchors).where(eq(openRubricAnchors.questionId, questionId));
  await tx.delete(questionEvidenceLinks).where(eq(questionEvidenceLinks.evidenceQuestionId, questionId));
  // Only rules sourced from this question are replaced; rules that merely
  // compare against it stay intact.
  await tx.delete(assessmentCrossChecks).where(eq(assessmentCrossChecks.sourceQuestionId, questionId));
  await tx.delete(questionTypeConfigs).where(eq(questionTypeConfigs.questionId, questionId));
}

export async function createQuestion(input: QuestionInput): Promise<AdminQuestionDetail> {
  const db = getDatabase();
  const duplicate = await getQuestionByReference(input.reference);
  if (duplicate) throw new QuestionBankValidationError(`A question with reference "${input.reference}" already exists.`);

  const questionId = newId("question");
  await db.transaction(async (tx) => {
    const dimensionId = await resolveDimensionId(tx, input.dimensionReference);
    const scored = isScoredQuestionType(input.type);
    const qWeight = scored && "qWeight" in input ? input.qWeight : null;
    await tx.insert(assessmentQuestions).values({
      id: questionId,
      reference: input.reference,
      dimensionId,
      questionType: input.type,
      prompt: input.prompt,
      helpText: input.helpText,
      qWeight,
      maxScore: scored ? SCORED_QUESTION_MAX : null,
      required: input.required ? 1 : 0,
      status: input.status,
      timeLimitSec: input.timeLimitSec,
    });
    await insertNestedConfiguration(tx, questionId, input);
  });

  const created = await getQuestionDetail(questionId);
  if (!created) throw new Error("Question insert did not complete");
  return created;
}

export async function updateQuestion(idOrReference: string, input: QuestionInput): Promise<AdminQuestionDetail | null> {
  const db = getDatabase();
  const existing = await getQuestionByIdOrReference(idOrReference);
  if (!existing) return null;
  // The reference is locked after creation — assessment relationships and
  // cross-checks rely on it for traceability.
  if (input.reference !== existing.reference) {
    throw new QuestionBankValidationError("Question references cannot be changed after creation.");
  }
  if (input.type !== existing.questionType) {
    const usedIn = await getUsedInLabels([existing.id]);
    if ((usedIn.get(existing.id) ?? []).length > 0) {
      throw new QuestionBankValidationError("This question's type cannot change while it is used in an assessment.");
    }
  }

  await db.transaction(async (tx) => {
    const dimensionId = await resolveDimensionId(tx, input.dimensionReference);
    const scored = isScoredQuestionType(input.type);
    const qWeight = scored && "qWeight" in input ? input.qWeight : null;
    await tx.update(assessmentQuestions).set({
      dimensionId,
      questionType: input.type,
      prompt: input.prompt,
      helpText: input.helpText,
      qWeight,
      maxScore: scored ? SCORED_QUESTION_MAX : null,
      required: input.required ? 1 : 0,
      status: input.status,
      timeLimitSec: input.timeLimitSec,
    }).where(eq(assessmentQuestions.id, existing.id));
    // Full replacement: stale nested configuration from a previous type is
    // never left attached to the question.
    await deleteNestedConfiguration(tx, existing.id);
    await insertNestedConfiguration(tx, existing.id, input);
  });

  return getQuestionDetail(existing.id);
}
