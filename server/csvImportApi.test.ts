/**
 * CSV Assessment Question Import — live-database API tests.
 *
 * Drives the real Express routers against TiDB (skipped without DATABASE_URL)
 * and proves the four guarantees the task requires:
 *
 *  1. ADMIN-ONLY — every CSV route rejects anonymous and non-Admin callers.
 *  2. VALIDATE BEFORE IMPORT — preview reports every structural, per-type and
 *     role-scoped problem, and writes nothing.
 *  3. ATOMIC + NON-DESTRUCTIVE — a confirmed import persists questions, nested
 *     configuration and assignments in one transaction, appends after the
 *     existing assessment order, never overwrites an existing question code,
 *     and rolls back completely when any write fails.
 *  4. ONE SCORING ENGINE — an imported question is byte-for-byte equivalent to
 *     a manually created one for the scorer, and a fully imported assessment
 *     produces the exact Base / Verification / Penalty / Bonus / Final / Band
 *     values the existing engine defines. The seeded live BDO v2 assessment is
 *     asserted unchanged at the end.
 *
 * Every mutation uses temporary roles, questions and applications removed
 * during cleanup; the seeded production data is never written to.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import { createSessionForUser } from "./adminAuth";
import { createAdminApplicationApiRouter } from "./adminApplicationApi";
import { createApplicationApiRouter } from "./applicationApi";
import { createAssessmentApiRouter } from "./assessmentApi";
import { createCsvImportApiRouter } from "./csvImportApi";
import { createQuestionBankApiRouter } from "./questionBankApi";
import { getDatabase } from "./db";
import { loadQuestionScoringConfigs, resolveEvidenceMultiplier, scoreObjectiveQuestion } from "./evaluationScoring";
import {
  adminProfiles,
  applicationDimensionScores,
  applicationEvaluations,
  assessmentDimensions,
  assessmentQuestionAssignments,
  assessmentQuestions,
  assessments,
  numericQuestionConfigs,
  numericScoringBands,
  openQuestionConfigs,
  openRubricAnchors,
  questionEvidenceLinks,
  questionOptions,
  questionTypeConfigs,
  recruitmentRoles,
  users,
} from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import {
  CSV_COLUMNS,
  MAX_CSV_QUESTIONS,
  buildCsvTemplate,
  parseAndValidateCsv,
} from "../shared/csvImport";
import { SCORED_QUESTION_MAX } from "../shared/questionBankApi";

// ── Transaction-rollback hook (task #29) ──────────────────────────────────────
//
// Pass B of the import transaction reuses the Question Bank writer. Making it
// throw mid-transaction must roll back the Pass A question rows too, so the
// wrapper is injected here and toggled per-test through a hoisted flag.
const rollback = vi.hoisted(() => ({ failNext: false }));

vi.mock("./questionBankRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./questionBankRepository")>();
  const original = actual.insertNestedConfiguration;
  const wrapped = (async (
    tx: Parameters<typeof original>[0],
    questionId: string,
    input: Parameters<typeof original>[2],
  ) => {
    if (rollback.failNext) throw new Error("synthetic nested configuration failure");
    return original(tx, questionId, input);
  }) as typeof original;
  return { ...actual, insertNestedConfiguration: wrapped };
});

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

/**
 * Integration tests that CREATE and DELETE database records must run against a
 * dedicated TEST database, never the live workspace.
 *
 * Resolution order:
 *   TEST_DATABASE_URL  — a separate TiDB/MySQL database provisioned for tests.
 *                        When set, mutation tests run against this database.
 *   DATABASE_URL only  — mutation tests are SKIPPED to protect the live workspace.
 *                        The seeded BDO read-only assertions still run via `suite`.
 *
 * To enable the mutation integration suite:
 *   export TEST_DATABASE_URL="mysql://user:pass@host/test_db?ssl=..."
 *   npx vitest run server/csvImportApi.test.ts
 *
 * The TEST_DATABASE_URL database must have the same schema as DATABASE_URL.
 * Run migrations against it before running tests.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const mutationSuite = describe.skipIf(!testDatabaseUrl);

/** The seeded live assessment that must remain untouched (task #27). */
const BDO_V2_SLUG = "business-development-officer-assessment-v2";
const BDO_APPROVED_ORDER = [
  "D1.Q1", "D3.Q1", "D2.Q3", "D4.Q1", "D4.Q2", "D3.Q3", "D5.Q1",
  "D2.Q1", "D2.Q1E", "D7.Q1", "D1.Q2", "D6.Q1", "D8.Q1", "D2.Q2",
] as const;

/** A five-dimension Evaluation Framework whose weights sum to exactly 100. */
const FRAMEWORK = [
  { reference: "D1", name: "Strategic Thinking", weight: 30 },
  { reference: "D2", name: "Execution Evidence", weight: 25 },
  { reference: "D3", name: "Commercial Acumen", weight: 20 },
  { reference: "D4", name: "Judgement", weight: 15 },
  { reference: "D5", name: "Communication", weight: 10 },
] as const;

type CsvRow = Record<string, string | number | undefined>;

function csvCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize rows against the canonical header so tests never drift from CSV_COLUMNS. */
function buildCsv(rows: CsvRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** A minimal valid ORDINAL row; callers override only what they are testing. */
function ordinalRow(code: string, overrides: CsvRow = {}): CsvRow {
  return {
    question_code: code,
    question_text: `Which option describes you best? (${code})`,
    question_type: "ORDINAL",
    dimension_code: "D1",
    display_order: 1,
    q_weight: 3,
    max_score: SCORED_QUESTION_MAX,
    required: "TRUE",
    status: "Active",
    option_1_text: "Strong experience",
    option_1_score: 5,
    option_2_text: "Solid experience",
    option_2_score: 4,
    option_3_text: "Some experience",
    option_3_score: 2,
    option_4_text: "No experience",
    option_4_score: 0,
    ...overrides,
  };
}

/** Expand `[{text, score, explanation}]` into the positional option columns. */
function optionCells(options: Array<{ text: string; score?: number; explanation?: string }>): CsvRow {
  const cells: CsvRow = {};
  options.forEach((option, index) => {
    cells[`option_${index + 1}_text`] = option.text;
    if (option.score !== undefined) cells[`option_${index + 1}_score`] = option.score;
    if (option.explanation !== undefined) cells[`option_${index + 1}_explanation`] = option.explanation;
  });
  return cells;
}

/**
 * The six importable question types, expressed ONCE as CSV cells and ONCE as the
 * manual Question Bank payload. Both halves describe the same six questions, so
 * the equivalence test can import one half, hand-create the other and prove the
 * two land in the configuration tables identically — one question model, and
 * therefore one scoring engine. The same fixture doubles as the full-assessment
 * scoring regression: one question per dimension, weights summing to 100.
 */
function sixTypeFixture(code: (group: string, suffix: string) => string, csvGroup: string, manualGroup: string) {
  const prompts = {
    ordinal: "Which statement best describes your commercial experience?",
    numeric: "In which year did you first work in a revenue role?",
    evidence: "How was that revenue experience verified?",
    multi: "Select every channel you have personally run.",
    sjt: "A prospect goes quiet three weeks before signature. What do you do first?",
    open: "Describe a deal you closed and the part you personally played in it.",
  };
  const ordinalOptions = [
    { text: "Led revenue strategy across multiple markets", score: 5 },
    { text: "Owned a regional pipeline end to end", score: 4 },
    { text: "Supported a sales team without carrying a quota", score: 2 },
    { text: "No commercial experience", score: 0 },
  ];
  const multiOptions = [
    { text: "Outbound email", score: 3 },
    { text: "Partner referrals", score: 3 },
    { text: "Industry events", score: 2 },
    // A −1 option is a decoy: MULTI scorable options run 0…5.
    { text: "I have not run any channel", score: -1 },
  ];
  const sjtOptions = [
    { text: "Diagnose why the deal stalled", score: 5, explanation: "Best judgement" },
    { text: "Escalate to the economic buyer", score: 2, explanation: "Premature" },
    { text: "Offer a discount to revive it", score: 1, explanation: "Erodes margin" },
    { text: "Wait for them to come back", score: -2, explanation: "Passive" },
  ];
  const evidenceOptions = [
    { text: "Employer reference", score: 1 },
    { text: "Signed documents", score: 0.95 },
    { text: "Self-reported", score: 0.85 },
  ];
  const numericBands = [
    { min: 0, max: 2, score: 1 },
    { min: 3, max: 5, score: 3 },
    // No upper bound — the open-ended top band.
    { min: 6, max: undefined as number | undefined, score: 5 },
  ];
  const rubric = [
    { min: 0, max: 1, anchor: "Little evidence of structured thinking" },
    { min: 2, max: 3, anchor: "Adequate but only partly structured answer" },
    { min: 4, max: 5, anchor: "Clear, structured and specific answer" },
  ];

  const suffixes = ["D1.Q1", "D2.Q1", "D2.Q1E", "D3.Q1", "D4.Q1", "D5.Q1"] as const;

  const csv: CsvRow[] = [
    {
      question_code: code(csvGroup, "D1.Q1"),
      question_text: prompts.ordinal,
      question_type: "ORDINAL",
      dimension_code: "D1",
      display_order: 1,
      q_weight: 3,
      max_score: SCORED_QUESTION_MAX,
      required: "TRUE",
      status: "Active",
      ...optionCells(ordinalOptions),
    },
    {
      question_code: code(csvGroup, "D2.Q1"),
      question_text: prompts.numeric,
      question_type: "NUMERIC",
      dimension_code: "D2",
      display_order: 2,
      q_weight: 2,
      max_score: SCORED_QUESTION_MAX,
      required: "TRUE",
      status: "Active",
      numeric_mode: "calendarYearExperience",
      input_1_label: "Calendar year",
      input_1_unit: "year",
      band_1_min: numericBands[0].min,
      band_1_max: numericBands[0].max,
      band_1_score: numericBands[0].score,
      band_2_min: numericBands[1].min,
      band_2_max: numericBands[1].max,
      band_2_score: numericBands[1].score,
      band_3_min: numericBands[2].min,
      band_3_score: numericBands[2].score,
    },
    {
      question_code: code(csvGroup, "D2.Q1E"),
      question_text: prompts.evidence,
      question_type: "EVIDENCE",
      dimension_code: "D2",
      display_order: 3,
      // EVIDENCE carries neither a question weight nor a max score.
      required: "TRUE",
      status: "Active",
      claimed_question_reference: code(csvGroup, "D2.Q1"),
      ...optionCells(evidenceOptions),
    },
    {
      question_code: code(csvGroup, "D3.Q1"),
      question_text: prompts.multi,
      question_type: "MULTI",
      dimension_code: "D3",
      display_order: 4,
      q_weight: 3,
      max_score: SCORED_QUESTION_MAX,
      required: "TRUE",
      status: "Active",
      ...optionCells(multiOptions),
    },
    {
      question_code: code(csvGroup, "D4.Q1"),
      question_text: prompts.sjt,
      question_type: "SJT",
      dimension_code: "D4",
      display_order: 5,
      q_weight: 3,
      max_score: SCORED_QUESTION_MAX,
      required: "TRUE",
      status: "Active",
      ...optionCells(sjtOptions),
    },
    {
      question_code: code(csvGroup, "D5.Q1"),
      question_text: prompts.open,
      question_type: "OPEN",
      dimension_code: "D5",
      display_order: 6,
      q_weight: 3,
      max_score: SCORED_QUESTION_MAX,
      required: "TRUE",
      status: "Active",
      open_min_words: 20,
      open_max_words: 200,
      rubric_low_min: rubric[0].min,
      rubric_low_max: rubric[0].max,
      rubric_low_anchor: rubric[0].anchor,
      rubric_mid_min: rubric[1].min,
      rubric_mid_max: rubric[1].max,
      rubric_mid_anchor: rubric[1].anchor,
      rubric_high_min: rubric[2].min,
      rubric_high_max: rubric[2].max,
      rubric_high_anchor: rubric[2].anchor,
    },
  ];

  const base = (suffix: string, type: string, prompt: string) => ({
    reference: code(manualGroup, suffix),
    dimensionReference: suffix.split(".")[0] ?? null,
    prompt,
    helpText: "",
    required: true,
    status: "Active",
    timeLimitSec: null,
    type,
  });

  const manual: Array<Record<string, unknown>> = [
    {
      ...base("D1.Q1", "ORDINAL", prompts.ordinal),
      qWeight: 3,
      options: ordinalOptions.map((option) => ({ text: option.text, rawScore: option.score })),
    },
    {
      ...base("D2.Q1", "NUMERIC", prompts.numeric),
      qWeight: 2,
      numericConfig: {
        mode: "calendarYearExperience",
        inputDefinitions: [{ label: "Calendar year", unit: "year" }],
        bands: numericBands.map((band) => ({ lowerBound: band.min, upperBound: band.max ?? null, rawScore: band.score })),
      },
    },
    {
      ...base("D2.Q1E", "EVIDENCE", prompts.evidence),
      claimedQuestionReference: code(manualGroup, "D2.Q1"),
      options: evidenceOptions.map((option) => ({ text: option.text, verificationMultiplier: option.score })),
    },
    {
      ...base("D3.Q1", "MULTI", prompts.multi),
      qWeight: 3,
      scoreCap: SCORED_QUESTION_MAX,
      options: multiOptions.map((option) => ({ text: option.text, rawScore: option.score, isDecoy: option.score === -1 })),
    },
    {
      ...base("D4.Q1", "SJT", prompts.sjt),
      qWeight: 3,
      options: sjtOptions.map((option) => ({ text: option.text, rawScore: option.score, internalExplanation: option.explanation })),
    },
    {
      ...base("D5.Q1", "OPEN", prompts.open),
      qWeight: 3,
      openConfig: {
        minimumWords: 20,
        maximumWords: 200,
        timeLimitSec: null,
        pasteAllowed: false,
        rubric: rubric.map((anchor) => ({ scoreMin: anchor.min, scoreMax: anchor.max, anchorText: anchor.anchor })),
      },
    },
  ];

  return { suffixes, prompts, csv, manual };
}

mutationSuite("CSV assessment question import against TiDB", () => {
  // Point getDatabase() at the safe test database if TEST_DATABASE_URL is set.
  // This must happen before any db.insert() calls in beforeAll.
  if (testDatabaseUrl && testDatabaseUrl !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createCsvImportApiRouter());
  app.use(createQuestionBankApiRouter());
  app.use(createAssessmentApiRouter());
  app.use(createApplicationApiRouter());
  app.use(createAdminApplicationApiRouter());

  let server: Server;
  let baseUrl = "";
  let adminCookie = "";
  let viewerCookie = "";
  let adminUserId = 0;
  let viewerUserId = 0;

  const marker = randomBytes(4).toString("hex");
  /** Uppercase marker used inside question references (varchar(24), unique). */
  const TAG = marker.toUpperCase();
  /** Build a globally unique, length-safe question reference. */
  const code = (group: string, suffix: string) => `${group}${TAG}.${suffix}`;

  // One role per concern so no test depends on another test's writes.
  const previewRole = { id: `csv-preview-${marker}`, slug: `csv-preview-${marker}` };
  const importRole = { id: `csv-import-${marker}`, slug: `csv-import-${marker}` };
  const scopeRole = { id: `csv-scope-${marker}`, slug: `csv-scope-${marker}` };
  const rollbackRole = { id: `csv-rollback-${marker}`, slug: `csv-rollback-${marker}` };
  const equivalenceRole = { id: `csv-equiv-${marker}`, slug: `csv-equiv-${marker}` };
  const regressionRole = { id: `csv-regress-${marker}`, slug: `csv-regress-${marker}` };
  const allRoles = [previewRole, importRole, scopeRole, rollbackRole, equivalenceRole, regressionRole];

  const CURRENT_YEAR = new Date().getFullYear();

  /** Assessments created by the import tests, captured for the later sections. */
  let importAssessmentId = "";
  let equivalenceAssessmentId = "";
  let regressionAssessmentId = "";
  /** The live BDO assessment as it looked before any CSV import ran. */
  let bdoBefore: Awaited<ReturnType<typeof snapshotAssessment>> = null;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const db = getDatabase();

    // Admin (authorized) and viewer (session without an admin_profile).
    const adminOpenId = `csv-admin-${marker}`;
    await db.insert(users).values({ openId: adminOpenId, email: `csv-admin-${marker}@example.com`, loginMethod: "test", role: "user" });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({ id: `csv-profile-${marker}`, authUserId: adminUser.id, email: `csv-admin-${marker}@example.com`, role: "Admin", status: "Active" });
    adminUserId = adminUser.id;
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    const viewerOpenId = `csv-viewer-${marker}`;
    await db.insert(users).values({ openId: viewerOpenId, email: `csv-viewer-${marker}@example.com`, loginMethod: "test", role: "user" });
    const viewerUser = (await db.select().from(users).where(sql`${users.openId} = ${viewerOpenId}`).limit(1))[0];
    viewerUserId = viewerUser.id;
    viewerCookie = `${COOKIE_NAME}=${(await createSessionForUser(viewerUser.id)).token}`;

    // Synthetic roles, each with the same five-dimension framework.
    for (const role of allRoles) {
      await db.insert(recruitmentRoles).values({
        id: role.id,
        slug: role.slug,
        title: `CSV Import Role ${role.slug}`,
        department: "Test Department",
        location: "Test Location",
        employmentType: "Full-time",
        shortDescription: `Synthetic role ${marker} used by the CSV import tests.`,
        fullDescription: `## Synthetic role ${marker}\n\nCreated by the CSV import test suite and removed during cleanup.`,
        // Open so the applicant runtime accepts applications; the equivalence
        // role stays Draft because no applicant ever touches it.
        status: role.id === equivalenceRole.id ? "Draft" : "Open",
        closingDate: "2027-12-31",
      });
      await db.insert(assessmentDimensions).values(
        FRAMEWORK.map((dimension, index) => ({
          id: `${role.id}-dim-${dimension.reference}`,
          roleId: role.id,
          reference: dimension.reference,
          name: dimension.name,
          weight: dimension.weight,
          minimumFloor: null,
          displayOrder: index + 1,
          status: "Active" as const,
        })),
      );
    }

    // Capture the live assessment before a single CSV import runs.
    bdoBefore = await snapshotAssessment(BDO_V2_SLUG);
  });

  afterAll(async () => {
    const db = getDatabase();
    // Questions first: their children (options, configs, bands, anchors,
    // evidence links, responses, assignments) all cascade from this delete.
    await db.execute(sql.raw(`DELETE FROM assessment_questions WHERE reference LIKE '%${TAG}%'`)).catch(() => undefined);
    // Roles cascade their dimensions, assessments and applications.
    // The noFrameworkRole uses the same marker in its id so this catches it too.
    await db.execute(sql.raw(`DELETE FROM recruitment_roles WHERE id LIKE '%${marker}%'`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM admin_profiles WHERE auth_user_id IN (${adminUserId}, ${viewerUserId})`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM auth_sessions WHERE userId IN (${adminUserId}, ${viewerUserId})`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM users WHERE id IN (${adminUserId}, ${viewerUserId})`)).catch(() => undefined);
    server?.close();
  });

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, any> };
  }

  function csvPath(roleSlug: string, action: "csv-template" | "csv-preview" | "csv-import") {
    return `/api/admin/recruitment-roles/${roleSlug}/assessment/${action}`;
  }

  async function sendCsv(
    action: "csv-preview" | "csv-import",
    roleSlug: string,
    csv: string,
    options: { scope?: string; cookie?: string } = {},
  ) {
    const query = options.scope === undefined ? "" : `?scope=${encodeURIComponent(options.scope)}`;
    const response = await fetch(`${baseUrl}${csvPath(roleSlug, action)}${query}`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: options.cookie ?? adminCookie },
      body: csv,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, any> };
  }

  const preview = (roleSlug: string, csv: string) => sendCsv("csv-preview", roleSlug, csv);
  const confirm = (roleSlug: string, csv: string, scope?: string) => sendCsv("csv-import", roleSlug, csv, { scope });

  async function countQuestions(pattern: string): Promise<number> {
    const db = getDatabase();
    const [row] = await db
      .select({ value: count() })
      .from(assessmentQuestions)
      .where(sql`${assessmentQuestions.reference} LIKE ${pattern}`);
    return Number(row?.value ?? 0);
  }

  async function loadQuestion(reference: string) {
    const db = getDatabase();
    return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.reference, reference)).limit(1))[0] ?? null;
  }

  async function loadAssignments(assessmentId: string) {
    const db = getDatabase();
    return db
      .select({
        reference: assessmentQuestions.reference,
        questionId: assessmentQuestions.id,
        displayOrder: assessmentQuestionAssignments.displayOrder,
      })
      .from(assessmentQuestionAssignments)
      .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, assessmentQuestionAssignments.questionId))
      .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId))
      .orderBy(asc(assessmentQuestionAssignments.displayOrder));
  }

  /** Full option rows in display order — what the scorer ultimately reads. */
  async function loadOptionRows(questionId: string) {
    const db = getDatabase();
    return db
      .select({
        optionText: questionOptions.optionText,
        displayOrder: questionOptions.displayOrder,
        rawScore: questionOptions.rawScore,
        isDecoy: questionOptions.isDecoy,
        outcomeType: questionOptions.outcomeType,
        internalExplanation: questionOptions.internalExplanation,
        verificationMultiplier: questionOptions.verificationMultiplier,
      })
      .from(questionOptions)
      .where(eq(questionOptions.questionId, questionId))
      .orderBy(asc(questionOptions.displayOrder));
  }

  async function activateAssessment(assessmentId: string) {
    // Assessment status is deliberately not editable through the Admin API —
    // the CSV import stages a Draft and an Admin activates it out-of-band.
    const db = getDatabase();
    await db.update(assessments).set({ status: "Active" }).where(eq(assessments.id, assessmentId));
  }

  async function loadQuestionById(questionId: string) {
    const db = getDatabase();
    return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, questionId)).limit(1))[0] ?? null;
  }

  /**
   * Full structural snapshot of a seeded assessment. Captured before any import
   * runs and re-read at the end, so "the CSV feature left the live assessment
   * alone" is proven by comparison rather than by assumption.
   */
  async function snapshotAssessment(slug: string) {
    const db = getDatabase();
    const rows = await db.select().from(assessments).where(eq(assessments.slug, slug)).orderBy(asc(assessments.version));
    if (rows.length === 0) return null;
    const assessment = rows[rows.length - 1]!;
    const assignments = await loadAssignments(assessment.id);
    return {
      count: rows.length,
      id: assessment.id,
      name: assessment.name,
      description: assessment.description,
      version: assessment.version,
      status: assessment.status,
      roleId: assessment.roleId,
      createdAt: new Date(assessment.createdAt).toISOString(),
      assignments: assignments.map((assignment) => ({
        reference: assignment.reference,
        questionId: assignment.questionId,
        displayOrder: assignment.displayOrder,
      })),
    };
  }

  /** reference → { questionId, optionIds } for every question in an assessment. */
  async function loadRuntimeQuestions(assessmentId: string) {
    const assignments = await loadAssignments(assessmentId);
    const questionIds = assignments.map((assignment) => assignment.questionId);
    // One batched option read instead of a query per question. This helper runs
    // on every applicant step and the database is remote, so the difference
    // between one round trip and seven is the difference between a test that
    // finishes and a test that times out.
    const optionRows = questionIds.length === 0 ? [] : await getDatabase()
      .select({ questionId: questionOptions.questionId, id: questionOptions.id })
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, questionIds))
      .orderBy(asc(questionOptions.questionId), asc(questionOptions.displayOrder));
    const optionIds = new Map<string, string[]>();
    for (const row of optionRows) {
      const list = optionIds.get(row.questionId);
      if (list) list.push(row.id);
      else optionIds.set(row.questionId, [row.id]);
    }
    return new Map(assignments.map((assignment) => [assignment.reference, {
      reference: assignment.reference,
      questionId: assignment.questionId,
      displayOrder: assignment.displayOrder,
      optionIds: optionIds.get(assignment.questionId) ?? [],
    }]));
  }

  /** The loaded paper, handed to `submitAnswers` so it is only ever read once. */
  type RuntimeQuestions = Awaited<ReturnType<typeof loadRuntimeQuestions>>;

  /** Create an applicant through the public runtime for a synthetic role. */
  async function createApplicant(roleSlug: string, label: string) {
    const { status, body } = await api("/api/public/applications", {
      method: "POST",
      body: JSON.stringify({
        roleSlug,
        fullName: `CSV Applicant ${label} ${marker}`,
        email: `csv-${label}-${marker}@example.com`,
        phone: "+2348000000000",
        city: "Lagos",
        currentStatus: "Employed",
        currentStatusOther: "",
        totalExperience: "6-10 years",
        relevantExperience: "",
        linkedinUrl: "",
        // The synthetic roles have no eligibility gates, so no answers are due.
        eligibility: {},
      }),
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.eligibilityStatus).toBe("Eligible");
    return { applicationId: body.applicationId as string, token: body.applicantToken as string };
  }

  type AnswerPlan = Record<string, (optionIds: string[]) => { responseType: string; responsePayload: unknown }>;

  /** Answer every question in the plan through the real applicant endpoints. */
  async function submitAnswers(token: string, questions: RuntimeQuestions, plan: AnswerPlan) {
    for (const [reference, build] of Object.entries(plan)) {
      const entry = questions.get(reference);
      if (!entry) throw new Error(`Fixture question ${reference} is not assigned to this assessment`);
      const answer = build(entry.optionIds);
      const response = await fetch(`${baseUrl}/api/public/applications/me/assessment/responses/${entry.questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Application-Token": token },
        body: JSON.stringify(answer),
      });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.status !== 200 || body?.ok !== true) {
        throw new Error(`Saving ${reference} failed: ${response.status} ${JSON.stringify(body)}`);
      }
    }
  }

  async function completeAttempt(token: string) {
    const response = await fetch(`${baseUrl}/api/public/applications/me/assessment/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Application-Token": token },
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body?.ok).toBe(true);
  }

  /**
   * Load the paper. The applicant runtime creates the attempt on this first
   * load, so no answer can be saved before it happens.
   */
  async function startAssessment(token: string, expectedQuestionCount: number) {
    const response = await fetch(`${baseUrl}/api/public/applications/me/assessment`, {
      headers: { "X-Application-Token": token },
    });
    const body = (await response.json().catch(() => null)) as Record<string, any> | null;
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body?.questionCount).toBe(expectedQuestionCount);
    return body!.attemptId as string;
  }

  async function loadEvaluation(applicationId: string) {
    const { status, body } = await api(`/api/admin/applications/${applicationId}/evaluation`, { headers: { Cookie: adminCookie } });
    expect(status, JSON.stringify(body)).toBe(200);
    return body.evaluation as Record<string, any>;
  }

  /** The engine's own per-question raw score for one reference. */
  function scoreOf(evaluation: Record<string, any>, reference: string): number | null {
    const found = (evaluation.questionScores as Array<Record<string, any>>).find((row) => row.reference === reference);
    expect(found, `${reference} should appear in questionScores`).toBeDefined();
    return found!.rawScore as number | null;
  }

  /** The dimensions flattened to the numbers the Base Assessment Score sums. */
  function dimensionTable(evaluation: Record<string, any>) {
    return (evaluation.dimensions as Array<Record<string, any>>).map((dimension) => ({
      reference: dimension.dimensionReference,
      normalized: dimension.normalizedScore,
      weight: dimension.weight,
      contribution: dimension.weightedContribution,
      floorStatus: dimension.floorStatus,
    }));
  }

  /** Record an Admin OPEN review — the step that unblocks the Base score. */
  async function reviewOpenAnswer(applicationId: string, questionId: string, rawScore: number) {
    const { status, body } = await api(`/api/admin/applications/${applicationId}/open-reviews/${questionId}`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ rawScore }),
    });
    expect(status, JSON.stringify(body)).toBe(200);
  }

  /** Confirm Admin bonus awards; the engine caps the total itself. */
  async function confirmBonuses(applicationId: string, bonusTypes: string[]) {
    for (const bonusType of bonusTypes) {
      const { status, body } = await api(`/api/admin/applications/${applicationId}/bonuses/${bonusType}`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ confirmed: true }),
      });
      expect(status, JSON.stringify(body)).toBe(200);
    }
  }

  /**
   * Everything the scoring engine can see about one question, read straight from
   * the configuration tables. Reference-derived values are normalised so a CSV
   * question and its manual twin compare equal (task #26). `dimensionId` is
   * deliberately excluded: the manual Question Bank API resolves a dimension
   * reference globally, while CSV import resolves it inside the role's own
   * framework — the linkage differs by design, the scoring shape does not.
   */
  async function configFingerprint(reference: string, group: string) {
    const db = getDatabase();
    const question = await loadQuestion(reference);
    expect(question, `${reference} should exist`).not.toBeNull();
    const questionId = question!.id;
    const [options, typeConfigs, numericConfigs, bands, openConfigs, anchors, evidenceLinks] = await Promise.all([
      db.select().from(questionOptions).where(eq(questionOptions.questionId, questionId)).orderBy(asc(questionOptions.displayOrder)),
      db.select().from(questionTypeConfigs).where(eq(questionTypeConfigs.questionId, questionId)).limit(1),
      db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, questionId)).limit(1),
      db.select().from(numericScoringBands).where(eq(numericScoringBands.questionId, questionId)).orderBy(asc(numericScoringBands.displayOrder)),
      db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId)).limit(1),
      db.select().from(openRubricAnchors).where(eq(openRubricAnchors.questionId, questionId)).orderBy(asc(openRubricAnchors.displayOrder)),
      db.select().from(questionEvidenceLinks).where(eq(questionEvidenceLinks.evidenceQuestionId, questionId)).limit(1),
    ]);

    // The EVIDENCE snapshot names the claimed question, so swap the group prefix
    // for a neutral token — the only intended difference between the twins.
    const neutralize = (text: string) => text.split(`${group}${TAG}`).join("@CLAIMED@");
    const claimed = evidenceLinks[0] ? await loadQuestionById(evidenceLinks[0].claimedQuestionId) : null;

    return {
      questionType: question!.questionType,
      prompt: question!.prompt,
      helpText: question!.helpText,
      required: question!.required,
      status: question!.status,
      timeLimitSec: question!.timeLimitSec,
      qWeight: question!.qWeight,
      maxScore: question!.maxScore,
      options: options.map((option) => ({
        optionText: option.optionText,
        displayOrder: option.displayOrder,
        rawScore: option.rawScore,
        isDecoy: option.isDecoy,
        outcomeType: option.outcomeType,
        relatedGateId: option.relatedGateId,
        internalExplanation: option.internalExplanation,
        verificationMultiplier: option.verificationMultiplier,
      })),
      typeConfig: typeConfigs[0]
        ? { configType: typeConfigs[0].configType, configuration: neutralize(typeConfigs[0].configuration) }
        : null,
      numericConfig: numericConfigs[0]
        ? { mode: numericConfigs[0].mode, derivedCalculationType: numericConfigs[0].derivedCalculationType, inputDefinitions: numericConfigs[0].inputDefinitions }
        : null,
      numericBands: bands.map((band) => ({ lowerBound: band.lowerBound, upperBound: band.upperBound, rawScore: band.rawScore, displayOrder: band.displayOrder })),
      openConfig: openConfigs[0]
        ? { minimumWords: openConfigs[0].minimumWords, maximumWords: openConfigs[0].maximumWords, timeLimitSec: openConfigs[0].timeLimitSec, pasteAllowed: openConfigs[0].pasteAllowed }
        : null,
      rubricAnchors: anchors.map((anchor) => ({ scoreMin: anchor.scoreMin, scoreMax: anchor.scoreMax, anchorText: anchor.anchorText, displayOrder: anchor.displayOrder })),
      claimedReference: claimed === null ? null : neutralize(claimed.reference),
    };
  }

  /**
   * The exact projection `loadQuestionScoringConfigs` hands the scorer, keyed by
   * the reference suffix with every identity field removed.
   */
  function scoringFingerprint(configs: Awaited<ReturnType<typeof loadQuestionScoringConfigs>>, group: string) {
    const prefix = `${group}${TAG}.`;
    return new Map(
      configs
        .filter((config) => config.reference.startsWith(prefix))
        .map((config) => [
          config.reference.slice(prefix.length),
          {
            questionType: config.questionType,
            qWeight: config.qWeight,
            maxScore: config.maxScore,
            options: config.options.map((option) => ({
              rawScore: option.rawScore,
              isDecoy: option.isDecoy,
              verificationMultiplier: option.verificationMultiplier,
              outcomeType: option.outcomeType,
            })),
            numericConfig: config.numericConfig,
            numericBands: config.numericBands,
          },
        ]),
    );
  }

  // ── 1. Admin-only access (task #30) ─────────────────────────────────────────

  it("rejects anonymous and non-Admin callers on all three CSV routes", async () => {
    const csv = buildCsv([ordinalRow(code("Z", "D1.Q1"))]);
    // Anonymous (no headers at all) and a valid session with no Admin profile.
    const headerSets: Array<Record<string, string>> = [{}, { Cookie: viewerCookie }];
    for (const headers of headerSets) {
      const template = await api(csvPath(previewRole.slug, "csv-template"), { headers });
      expect(template.status).toBe(401);
      expect(template.body).toEqual({ ok: false, error: "Admin authorization is required." });

      const previewResponse = await fetch(`${baseUrl}${csvPath(previewRole.slug, "csv-preview")}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv", ...headers },
        body: csv,
      });
      expect(previewResponse.status).toBe(401);
      expect(await previewResponse.json()).toEqual({ ok: false, error: "Admin authorization is required." });

      const importResponse = await fetch(`${baseUrl}${csvPath(previewRole.slug, "csv-import")}?scope=QUESTION_BANK`, {
        method: "POST",
        headers: { "Content-Type": "text/csv", ...headers },
        body: csv,
      });
      expect(importResponse.status).toBe(401);
      expect(await importResponse.json()).toEqual({ ok: false, error: "Admin authorization is required." });
    }

    // The rejected preview/import wrote nothing.
    expect(await countQuestions(`%${TAG}%`)).toBe(0);
  });

  it("returns a restrained 400 for an unknown role instead of a database error", async () => {
    const response = await preview(`csv-missing-${marker}`, buildCsv([ordinalRow(code("Z", "D1.Q2"))]));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: "Unable to load this role." });
  });

  // ── 2. Downloadable template (task #2, #6, #22) ─────────────────────────────

  it("serves the CSV template with its full column list and instructions", async () => {
    const { status, body } = await api(csvPath(previewRole.slug, "csv-template"), { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.filename).toBe("assessment-question-import-template.csv");
    expect(body.template).toBe(buildCsvTemplate());
    expect(body.columns).toEqual(CSV_COLUMNS);
    expect(Array.isArray(body.instructions)).toBe(true);
    expect(body.instructions.length).toBeGreaterThan(0);
    expect(body.instructions.every((line: unknown) => typeof line === "string" && line.length > 0)).toBe(true);

    // Core, option, numeric and rubric columns are all documented in the header.
    expect(body.template.split("\r\n")[0]).toBe(CSV_COLUMNS.join(","));
    for (const column of ["question_code", "question_type", "dimension_code", "display_order", "q_weight", "option_1_text", "option_10_score", "band_5_score", "rubric_high_anchor", "claimed_question_reference"]) {
      expect(CSV_COLUMNS).toContain(column);
    }
  });

  it("produces a template that re-parses into six valid, one-per-type example rows", async () => {
    const parsed = parseAndValidateCsv(buildCsvTemplate());
    expect(parsed.errors).toEqual([]);
    expect(parsed.detected).toBe(6);
    expect(parsed.rows.map((row) => row.type)).toEqual(["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"]);
    expect(parsed.rows.every((row) => row.errors.length === 0 && row.input !== null)).toBe(true);
    expect(parsed.rows.map((row) => row.order)).toEqual([1, 2, 3, 4, 5, 6]);
    // GATE is never offered as an importable type.
    expect(parsed.rows.some((row) => row.type === "GATE")).toBe(false);
  });

  // ── 3. Preview: valid file, no writes (task #13, #14) ───────────────────────

  it("previews a valid multi-type file without writing anything", async () => {
    const csv = buildCsv([
      ordinalRow(code("P", "D1.Q1"), { display_order: 1 }),
      {
        question_code: code("P", "D3.Q1"),
        question_text: "Select every channel you have run.",
        question_type: "MULTI",
        dimension_code: "D3",
        display_order: 2,
        q_weight: 2,
        max_score: SCORED_QUESTION_MAX,
        status: "Active",
        option_1_text: "Cold email",
        option_1_score: 3,
        option_2_text: "Referrals",
        option_2_score: 2,
        option_3_text: "None of these",
        option_3_score: -1,
      },
      {
        question_code: code("P", "D2.Q1"),
        question_text: "In which year did you first work in revenue?",
        question_type: "NUMERIC",
        dimension_code: "D2",
        display_order: 3,
        q_weight: 2,
        max_score: SCORED_QUESTION_MAX,
        status: "Active",
        numeric_mode: "calendarYearExperience",
        input_1_label: "Calendar year",
        input_1_unit: "year",
        band_1_min: 0,
        band_1_max: 2,
        band_1_score: 2,
        band_2_min: 3,
        band_2_score: 5,
      },
      {
        question_code: code("P", "D5.Q1"),
        question_text: "A prospect goes quiet. What first?",
        question_type: "SJT",
        dimension_code: "D5",
        display_order: 4,
        q_weight: 3,
        max_score: SCORED_QUESTION_MAX,
        status: "Active",
        option_1_text: "Diagnose the stall",
        option_1_score: 5,
        option_1_explanation: "Best judgement",
        option_2_text: "Discount",
        option_2_score: 1,
        option_2_explanation: "Erodes margin",
        option_3_text: "Escalate",
        option_3_score: 2,
        option_3_explanation: "Premature",
        option_4_text: "Wait",
        option_4_score: -2,
        option_4_explanation: "Passive",
      },
      {
        question_code: code("P", "D4.Q1"),
        question_text: "Describe a deal you closed.",
        question_type: "OPEN",
        dimension_code: "D4",
        display_order: 5,
        q_weight: 3,
        max_score: SCORED_QUESTION_MAX,
        status: "Active",
        open_min_words: 20,
        open_max_words: 200,
        rubric_low_min: 0,
        rubric_low_max: 1,
        rubric_low_anchor: "Weak response",
        rubric_mid_min: 2,
        rubric_mid_max: 3,
        rubric_mid_anchor: "Adequate response",
        rubric_high_min: 4,
        rubric_high_max: 5,
        rubric_high_anchor: "Strong response",
      },
      {
        question_code: code("P", "D2.Q1E"),
        question_text: "How was that achievement verified?",
        question_type: "EVIDENCE",
        dimension_code: "D2",
        display_order: 6,
        status: "Active",
        claimed_question_reference: code("P", "D2.Q1"),
        option_1_text: "Employer reference",
        option_1_score: 1,
        option_2_text: "Documents",
        option_2_score: 0.95,
        option_3_text: "Self-reported",
        option_3_score: 0.85,
      },
    ]);

    const { status, body } = await preview(previewRole.slug, csv);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const dto = body.preview;
    expect(dto.detected).toBe(6);
    expect(dto.valid).toBe(6);
    expect(dto.errorCount).toBe(0);
    expect(dto.errors).toEqual([]);
    expect(dto.rows.every((row: any) => row.valid)).toBe(true);

    // The role's own Evaluation Framework is echoed for the UI hints.
    expect(dto.dimensions).toEqual(FRAMEWORK.map((dimension) => ({ reference: dimension.reference, name: dimension.name })));

    // No assessment exists yet, so the preview announces one will be created.
    expect(dto.assessment).toEqual({ id: null, name: `CSV Import Role ${previewRole.slug} Assessment`, status: "Draft", willCreate: true });

    // Scored rows always report the fixed 5-point scale; EVIDENCE reports none.
    const byCode = new Map<string, any>(dto.rows.map((row: any) => [row.code as string, row]));
    expect(byCode.get(code("P", "D2.Q1E")).maxScore).toBeNull();
    expect(byCode.get(code("P", "D2.Q1E")).qWeight).toBeNull();
    for (const scoredCode of ["D1.Q1", "D3.Q1", "D2.Q1", "D5.Q1", "D4.Q1"]) {
      expect(byCode.get(code("P", scoredCode)).maxScore).toBe(SCORED_QUESTION_MAX);
    }
    expect(byCode.get(code("P", "D5.Q1")).optionCount).toBe(4);
    expect(byCode.get(code("P", "D2.Q1")).optionCount).toBe(0);

    // Preview must never persist (task #13).
    expect(await countQuestions(`%${TAG}%`)).toBe(0);
  });

  // ── 4. Preview: per-row and file-level validation ───────────────────────────

  it("rejects an unsupported question type and a GATE row with distinct messages", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(code("P", "D1.Q2"), { question_type: "ESSAY" }),
      ordinalRow(code("P", "D1.Q3"), { question_type: "GATE" }),
    ]));
    expect(body.preview.detected).toBe(2);
    expect(body.preview.valid).toBe(0);
    expect(body.preview.rows[0].errors.join(" ")).toContain(`Unsupported question type "ESSAY"`);
    expect(body.preview.rows[1].errors.join(" ")).toContain("GATE questions are configured under the role's Eligibility settings");
    expect(await countQuestions(`%${TAG}%`)).toBe(0);
  });

  it("rejects a missing option score, too few ordinal options and a bad q_weight", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      // option_2 has text but no score.
      ordinalRow(code("P", "D1.Q4"), { option_2_score: undefined }),
      // Only three options — ORDINAL needs four or five.
      ordinalRow(code("P", "D1.Q5"), { option_4_text: undefined, option_4_score: undefined }),
      // q_weight outside 1..3.
      ordinalRow(code("P", "D1.Q6"), { q_weight: 7 }),
    ]));
    expect(body.preview.valid).toBe(0);
    expect(body.preview.rows[0].errors.join(" ")).toContain("Option 2 must score between 0 and 5 points.");
    expect(body.preview.rows[1].errors.join(" ")).toContain("Ordinal questions need between 4 and 5 options.");
    expect(body.preview.rows[2].errors.join(" ")).toContain("Question weight must be 1, 2 or 3.");
  });

  it("rejects a max_score other than the fixed 5-point scale", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([ordinalRow(code("P", "D1.Q7"), { max_score: 10 })]));
    expect(body.preview.rows[0].valid).toBe(false);
    expect(body.preview.rows[0].errors.join(" ")).toContain("max_score must be 5");
  });

  it("rejects duplicate question codes and duplicate display orders within the file", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(code("P", "D1.Q8"), { display_order: 4 }),
      ordinalRow(code("P", "D1.Q8"), { display_order: 5, question_text: "Duplicate code row" }),
      ordinalRow(code("P", "D1.Q9"), { display_order: 4, question_text: "Duplicate order row" }),
    ]));
    // The FIRST occurrence of a duplicated code/order stays valid — the later
    // rows are the ones an Admin has to fix.
    expect(body.preview.valid).toBe(1);
    expect(body.preview.rows[0].valid).toBe(true);
    expect(body.preview.rows[1].errors.join(" ")).toContain(`Duplicate question code "${code("P", "D1.Q8")}" (also on row 2).`);
    expect(body.preview.rows[2].errors.join(" ")).toContain("Duplicate display_order 4 (also on row 2).");
  });

  it("rejects a dimension that is not in this role's Evaluation Framework", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(code("P", "D9.Q1"), { dimension_code: "D9" }),
      ordinalRow(code("P", "D1.Q10"), { dimension_code: undefined }),
    ]));
    expect(body.preview.valid).toBe(0);
    expect(body.preview.rows[0].errors.join(" ")).toContain("Dimension D9 does not exist in this role's Evaluation Framework.");
    expect(body.preview.rows[1].errors.join(" ")).toContain("dimension_code is required and must match this role's Evaluation Framework.");
    // CSV import never invents dimensions.
    const db = getDatabase();
    const invented = await db.select().from(assessmentDimensions).where(sql`${assessmentDimensions.reference} = 'D9' AND ${assessmentDimensions.roleId} = ${previewRole.id}`);
    expect(invented).toEqual([]);
  });

  it("rejects an EVIDENCE row whose claimed question cannot be resolved", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      {
        question_code: code("P", "D2.Q9E"),
        question_text: "How was it verified?",
        question_type: "EVIDENCE",
        dimension_code: "D2",
        display_order: 1,
        status: "Active",
        claimed_question_reference: code("P", "D2.NOPE"),
        option_1_text: "Employer reference",
        option_1_score: 1,
      },
    ]));
    expect(body.preview.valid).toBe(0);
    expect(body.preview.rows[0].errors.join(" ")).toContain(`Claimed question "${code("P", "D2.NOPE")}" does not exist.`);
  });

  it("accepts an EVIDENCE row that claims a question inside the same file", async () => {
    const claimed = code("P", "D2.Q11");
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(claimed, { dimension_code: "D2", display_order: 1 }),
      {
        question_code: code("P", "D2.Q11E"),
        question_text: "How was that verified?",
        question_type: "EVIDENCE",
        dimension_code: "D2",
        display_order: 2,
        status: "Active",
        claimed_question_reference: claimed,
        option_1_text: "Employer reference",
        option_1_score: 1,
        option_2_text: "Self-reported",
        option_2_score: 0.85,
      },
    ]));
    expect(body.preview.errorCount).toBe(0);
    expect(body.preview.valid).toBe(2);
  });

  it("rejects an EVIDENCE row that carries a question weight, and an invalid multiplier", async () => {
    const claimed = code("P", "D2.Q12");
    // Both evidence rows claim the same question and both carry an unusable 0.5
    // multiplier; only the first also carries a question weight.
    const evidenceRow = (suffix: string, displayOrder: number, overrides: CsvRow = {}): CsvRow => ({
      question_code: code("P", suffix),
      question_text: "How was that verified?",
      question_type: "EVIDENCE",
      dimension_code: "D2",
      display_order: displayOrder,
      status: "Active",
      claimed_question_reference: claimed,
      option_1_text: "Employer reference",
      option_1_score: 0.5,
      ...overrides,
    });
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(claimed, { dimension_code: "D2", display_order: 1 }),
      evidenceRow("D2.Q12E", 2, { q_weight: 3 }),
      evidenceRow("D2.Q13E", 3),
    ]));
    expect(body.preview.valid).toBe(1);

    // A weight on an unweighted type is reported, not silently dropped — and
    // with the very message the manual Question Bank form uses.
    const weighted = body.preview.rows[1].errors.join(" ");
    expect(weighted).toContain("Gate and evidence questions do not carry a question weight.");
    // The shared validator checks weight before it checks type-specific option
    // cells and returns early, so the multiplier on that same row is not
    // re-reported — identical to the manual form. The next row has no weight,
    // and there the multiplier rule still bites.
    expect(weighted).not.toContain("verification multiplier");
    expect(body.preview.rows[2].errors.join(" ")).toContain(
      "Option 1 must use a verification multiplier of 1.00, 0.95 or 0.85.",
    );
  });

  it("rejects empty files, files with no data rows and files missing required columns", async () => {
    const empty = await preview(previewRole.slug, "");
    expect(empty.body.preview.errors).toEqual(["The uploaded file is empty."]);
    expect(empty.body.preview.detected).toBe(0);

    const headerOnly = await preview(previewRole.slug, `${CSV_COLUMNS.join(",")}\r\n`);
    expect(headerOnly.body.preview.errors).toEqual(["No question rows were found in the file."]);

    const missingColumns = await preview(previewRole.slug, "question_code,question_text\r\nA,B\r\n");
    expect(missingColumns.body.preview.errors[0]).toContain("The CSV is missing required column");
    expect(missingColumns.body.preview.errors[0]).toContain("question_type");
  });

  it("reports a bad time limit and a bad display order", async () => {
    const { body } = await preview(previewRole.slug, buildCsv([
      ordinalRow(code("P", "D1.Q13"), { time_limit_sec: -5, display_order: 1 }),
      ordinalRow(code("P", "D1.Q14"), { display_order: "soon" }),
    ]));
    expect(body.preview.rows[0].errors.join(" ")).toContain("time_limit_sec must be a positive number of seconds.");
    expect(body.preview.rows[1].errors.join(" ")).toContain("display_order must be a positive whole number.");
  });

  it(`refuses a file above the ${MAX_CSV_QUESTIONS}-question limit at preview time`, async () => {
    const rows: CsvRow[] = [];
    for (let index = 1; index <= MAX_CSV_QUESTIONS + 1; index += 1) {
      rows.push(ordinalRow(code("L", `Q${index}`), { display_order: undefined }));
    }
    const csv = buildCsv(rows);
    const { body } = await preview(previewRole.slug, csv);
    expect(body.preview.detected).toBe(MAX_CSV_QUESTIONS + 1);
    expect(body.preview.errors[0]).toBe(
      `The file contains ${MAX_CSV_QUESTIONS + 1} questions, exceeding the ${MAX_CSV_QUESTIONS}-question limit.`,
    );
    expect(await countQuestions(`%${TAG}%`)).toBe(0);
  });

  it("parses quoted cells containing commas, newlines and doubled quotes", async () => {
    const prompt = `He said ""go now"", then left.\nSecond line, with a comma.`;
    const { body } = await preview(previewRole.slug, buildCsv([ordinalRow(code("P", "D1.Q15"), { question_text: prompt })]));
    expect(body.preview.detected).toBe(1);
    expect(body.preview.rows[0].question).toBe(prompt);
    expect(body.preview.rows[0].valid).toBe(true);
  });

  // ── 5. Confirmed import (tasks #12, #17–#21) ────────────────────────────────

  it("refuses to import until the Admin chooses where the questions go", async () => {
    const csv = buildCsv(sixTypeFixture(code, "I", "I").csv);

    const missing = await confirm(importRole.slug, csv);
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ ok: false, error: "Choose where to store the imported questions." });

    const invented = await confirm(importRole.slug, csv, "EVERYWHERE");
    expect(invented.status).toBe(400);
    expect(invented.body).toEqual({ ok: false, error: "Choose where to store the imported questions." });

    expect(await countQuestions(`%${TAG}%`)).toBe(0);
  });

  it("imports all six types into a new Draft assessment with their nested configuration", async () => {
    const fixture = sixTypeFixture(code, "I", "I");
    const { status, body } = await confirm(importRole.slug, buildCsv(fixture.csv), "QUESTION_BANK");
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.result.importedCount).toBe(6);
    expect(body.result.scope).toBe("QUESTION_BANK");
    expect(body.result.createdAssessment).toBe(true);
    expect(body.result.assessmentName).toBe(`CSV Import Role ${importRole.slug} Assessment`);
    expect(typeof body.result.assessmentSlug).toBe("string");
    expect(body.result.assessmentSlug.length).toBeGreaterThan(0);
    importAssessmentId = body.result.assessmentId as string;

    // A first import stages a Draft the Admin activates deliberately (task #21).
    const detail = await api(`/api/admin/assessments/${importAssessmentId}`, { headers: { Cookie: adminCookie } });
    expect(detail.status).toBe(200);
    expect(detail.body.assessment.status).toBe("Draft");
    expect(detail.body.assessment.version).toBe(1);
    expect(detail.body.assessment.questionCount).toBe(6);
    expect(detail.body.assessment.role.id).toBe(importRole.id);
    // display_order is the CSV's own relative order, applied to a fresh assessment.
    expect(detail.body.assessment.assignments.map((row: any) => row.reference)).toEqual(fixture.suffixes.map((suffix) => code("I", suffix)));
    expect(detail.body.assessment.assignments.map((row: any) => row.displayOrder)).toEqual([1, 2, 3, 4, 5, 6]);

    const db = getDatabase();

    // ORDINAL — weighted, capped at the fixed 5-point scale, dimension resolved
    // inside THIS role's framework rather than globally.
    const ordinal = await loadQuestion(code("I", "D1.Q1"));
    expect(ordinal).toMatchObject({
      questionType: "ORDINAL",
      prompt: fixture.prompts.ordinal,
      helpText: "",
      required: 1,
      status: "Active",
      timeLimitSec: null,
      qWeight: 3,
      maxScore: SCORED_QUESTION_MAX,
      dimensionId: `${importRole.id}-dim-D1`,
      scope: "QUESTION_BANK",
      ownerRoleId: null,
    });
    expect(await loadOptionRows(ordinal!.id)).toEqual([
      { optionText: "Led revenue strategy across multiple markets", displayOrder: 1, rawScore: 5, isDecoy: 0, outcomeType: null, internalExplanation: null, verificationMultiplier: null },
      { optionText: "Owned a regional pipeline end to end", displayOrder: 2, rawScore: 4, isDecoy: 0, outcomeType: null, internalExplanation: null, verificationMultiplier: null },
      { optionText: "Supported a sales team without carrying a quota", displayOrder: 3, rawScore: 2, isDecoy: 0, outcomeType: null, internalExplanation: null, verificationMultiplier: null },
      { optionText: "No commercial experience", displayOrder: 4, rawScore: 0, isDecoy: 0, outcomeType: null, internalExplanation: null, verificationMultiplier: null },
    ]);

    // NUMERIC — config row plus ordered bands; no options at all.
    const numeric = await loadQuestion(code("I", "D2.Q1"));
    expect(numeric).toMatchObject({ questionType: "NUMERIC", qWeight: 2, maxScore: SCORED_QUESTION_MAX, dimensionId: `${importRole.id}-dim-D2` });
    const [numericConfig] = await db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, numeric!.id)).limit(1);
    expect(numericConfig!.mode).toBe("calendarYearExperience");
    // calculation_type is blank in the CSV, so the shared default applies.
    expect(numericConfig!.derivedCalculationType).toBe("calendar_year_to_derived_years");
    expect(JSON.parse(numericConfig!.inputDefinitions)).toEqual([{ label: "Calendar year", unit: "year" }]);
    const bands = await db
      .select({ lowerBound: numericScoringBands.lowerBound, upperBound: numericScoringBands.upperBound, rawScore: numericScoringBands.rawScore, displayOrder: numericScoringBands.displayOrder })
      .from(numericScoringBands)
      .where(eq(numericScoringBands.questionId, numeric!.id))
      .orderBy(asc(numericScoringBands.displayOrder));
    expect(bands.map((band) => ({
      lower: Number(band.lowerBound),
      upper: band.upperBound === null ? null : Number(band.upperBound),
      rawScore: band.rawScore,
      displayOrder: band.displayOrder,
    }))).toEqual([
      { lower: 0, upper: 2, rawScore: 1, displayOrder: 1 },
      { lower: 3, upper: 5, rawScore: 3, displayOrder: 2 },
      // The open-ended top band keeps a NULL upper bound.
      { lower: 6, upper: null, rawScore: 5, displayOrder: 3 },
    ]);
    expect(await loadOptionRows(numeric!.id)).toEqual([]);

    // EVIDENCE — unweighted, multiplier-carrying, linked to its claimed question.
    const evidence = await loadQuestion(code("I", "D2.Q1E"));
    expect(evidence).toMatchObject({ questionType: "EVIDENCE", qWeight: null, maxScore: null, dimensionId: `${importRole.id}-dim-D2` });
    expect((await loadOptionRows(evidence!.id)).map((option) => ({
      optionText: option.optionText,
      multiplier: Number(option.verificationMultiplier),
      rawScore: option.rawScore,
    }))).toEqual([
      { optionText: "Employer reference", multiplier: 1, rawScore: null },
      { optionText: "Signed documents", multiplier: 0.95, rawScore: null },
      { optionText: "Self-reported", multiplier: 0.85, rawScore: null },
    ]);
    const [link] = await db.select().from(questionEvidenceLinks).where(eq(questionEvidenceLinks.evidenceQuestionId, evidence!.id)).limit(1);
    // The claim resolves against a row from the SAME file — Pass A precedes Pass B.
    expect(link!.claimedQuestionId).toBe(numeric!.id);

    // MULTI — a −1 cell becomes a decoy, everything else stays scorable.
    const multi = await loadQuestion(code("I", "D3.Q1"));
    expect(multi).toMatchObject({ questionType: "MULTI", qWeight: 3, maxScore: SCORED_QUESTION_MAX, dimensionId: `${importRole.id}-dim-D3` });
    expect((await loadOptionRows(multi!.id)).map((option) => ({ optionText: option.optionText, rawScore: option.rawScore, isDecoy: option.isDecoy }))).toEqual([
      { optionText: "Outbound email", rawScore: 3, isDecoy: 0 },
      { optionText: "Partner referrals", rawScore: 3, isDecoy: 0 },
      { optionText: "Industry events", rawScore: 2, isDecoy: 0 },
      { optionText: "I have not run any channel", rawScore: -1, isDecoy: 1 },
    ]);

    // SJT — every option keeps its internal explanation.
    const sjt = await loadQuestion(code("I", "D4.Q1"));
    expect(sjt).toMatchObject({ questionType: "SJT", qWeight: 3, maxScore: SCORED_QUESTION_MAX, dimensionId: `${importRole.id}-dim-D4` });
    expect((await loadOptionRows(sjt!.id)).map((option) => ({ rawScore: option.rawScore, internalExplanation: option.internalExplanation }))).toEqual([
      { rawScore: 5, internalExplanation: "Best judgement" },
      { rawScore: 2, internalExplanation: "Premature" },
      { rawScore: 1, internalExplanation: "Erodes margin" },
      { rawScore: -2, internalExplanation: "Passive" },
    ]);

    // OPEN — word limits, paste policy and ordered rubric anchors.
    const open = await loadQuestion(code("I", "D5.Q1"));
    expect(open).toMatchObject({ questionType: "OPEN", qWeight: 3, maxScore: SCORED_QUESTION_MAX, dimensionId: `${importRole.id}-dim-D5` });
    const [openConfig] = await db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, open!.id)).limit(1);
    expect(openConfig).toMatchObject({ minimumWords: 20, maximumWords: 200, timeLimitSec: null, pasteAllowed: 0 });
    const anchors = await db
      .select({ scoreMin: openRubricAnchors.scoreMin, scoreMax: openRubricAnchors.scoreMax, anchorText: openRubricAnchors.anchorText, displayOrder: openRubricAnchors.displayOrder })
      .from(openRubricAnchors)
      .where(eq(openRubricAnchors.questionId, open!.id))
      .orderBy(asc(openRubricAnchors.displayOrder));
    expect(anchors.map((anchor) => [anchor.scoreMin, anchor.scoreMax, anchor.displayOrder])).toEqual([[0, 1, 1], [2, 3, 2], [4, 5, 3]]);
    expect(anchors.map((anchor) => anchor.anchorText)).toEqual([
      "Little evidence of structured thinking",
      "Adequate but only partly structured answer",
      "Clear, structured and specific answer",
    ]);

    // Every imported question carries the same type-config snapshot a manual
    // create writes — the CSV adds no second configuration model.
    const references = fixture.suffixes.map((suffix) => code("I", suffix));
    const questions = await db.select().from(assessmentQuestions).where(inArray(assessmentQuestions.reference, references));
    expect(questions).toHaveLength(6);
    const typeConfigs = await db.select().from(questionTypeConfigs).where(inArray(questionTypeConfigs.questionId, questions.map((question) => question.id)));
    expect(typeConfigs.map((config) => config.configType).sort()).toEqual(["EVIDENCE", "MULTI", "NUMERIC", "OPEN", "ORDINAL", "SJT"]);
    const evidenceSnapshot = typeConfigs.find((config) => config.questionId === evidence!.id)!;
    expect(JSON.parse(evidenceSnapshot.configuration).evidenceConfig.pairedQuestionRef).toBe(code("I", "D2.Q1"));
  });

  it("appends a second import after the existing order without renumbering it", async () => {
    const before = await loadAssignments(importAssessmentId);
    expect(before).toHaveLength(6);

    const { status, body } = await confirm(importRole.slug, buildCsv([
      ordinalRow(code("A", "D1.Q1"), { question_text: "A later addition, imported second.", display_order: 1 }),
    ]), "QUESTION_BANK");
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.result.createdAssessment).toBe(false);
    expect(body.result.importedCount).toBe(1);
    // The role keeps exactly one assessment — CSV never forks a second one.
    expect(body.result.assessmentId).toBe(importAssessmentId);

    const db = getDatabase();
    const roleAssessments = await db.select({ id: assessments.id }).from(assessments).where(eq(assessments.roleId, importRole.id));
    expect(roleAssessments).toHaveLength(1);

    const after = await loadAssignments(importAssessmentId);
    expect(after).toHaveLength(7);
    // Existing questions keep their order (task #20); the new one lands at the end.
    expect(after.slice(0, 6)).toEqual(before);
    expect(after[6]).toMatchObject({ reference: code("A", "D1.Q1"), displayOrder: 7 });
  });

  it("never overwrites an existing question code and aborts the whole file", async () => {
    const fresh = code("N", "D1.Q1");
    const existing = code("I", "D1.Q1");
    const { status, body } = await confirm(importRole.slug, buildCsv([
      ordinalRow(fresh, { question_text: "A brand new question.", display_order: 1 }),
      ordinalRow(existing, { question_text: "This one already exists.", display_order: 2 }),
    ]), "QUESTION_BANK");
    expect(status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: `Row 3: Question code "${existing}" already exists. CSV import creates new questions only.`,
    });
    // One rejected row aborts everything — the valid row is not written either.
    expect(await loadQuestion(fresh)).toBeNull();
    expect(await loadAssignments(importAssessmentId)).toHaveLength(7);
  });

  it("aborts the entire import when a single row is structurally invalid", async () => {
    const fresh = code("N", "D1.Q2");
    const { status, body } = await confirm(importRole.slug, buildCsv([
      ordinalRow(fresh, { display_order: 1 }),
      ordinalRow(code("N", "D1.Q3"), { display_order: 2, q_weight: 9 }),
    ]), "QUESTION_BANK");
    expect(status).toBe(400);
    expect(body.error).toContain("Question weight must be 1, 2 or 3.");
    expect(await loadQuestion(fresh)).toBeNull();
  });

  it(`refuses a file above the ${MAX_CSV_QUESTIONS}-question limit at import time`, async () => {
    const rows: CsvRow[] = [];
    for (let index = 1; index <= MAX_CSV_QUESTIONS + 1; index += 1) {
      rows.push(ordinalRow(code("L", `Q${index}`), { display_order: undefined }));
    }
    const { status, body } = await confirm(importRole.slug, buildCsv(rows), "QUESTION_BANK");
    expect(status).toBe(400);
    expect(body.error).toBe(
      `The file contains ${MAX_CSV_QUESTIONS + 1} questions, exceeding the ${MAX_CSV_QUESTIONS}-question limit.`,
    );
    expect(await countQuestions(`L${TAG}.%`)).toBe(0);
  });

  it("stores ROLE_ONLY questions against the role and hides them from the Question Bank", async () => {
    const roleOnly = code("R", "D1.Q1");
    const imported = await confirm(scopeRole.slug, buildCsv([
      ordinalRow(roleOnly, { question_text: "Used by this role alone." }),
    ]), "ROLE_ONLY");
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);
    expect(imported.body.result.scope).toBe("ROLE_ONLY");

    // Scope is metadata on the SAME question row — never a second question model.
    expect(await loadQuestion(roleOnly)).toMatchObject({ scope: "ROLE_ONLY", ownerRoleId: scopeRole.id });

    const hidden = await api(`/api/admin/questions?search=${encodeURIComponent(roleOnly)}`, { headers: { Cookie: adminCookie } });
    expect(hidden.status).toBe(200);
    expect(hidden.body.items).toEqual([]);

    // QUESTION_BANK imports stay reusable, so they stay listed.
    const listed = await api(`/api/admin/questions?search=${encodeURIComponent(code("I", "D1.Q1"))}`, { headers: { Cookie: adminCookie } });
    expect(listed.body.items.map((item: any) => item.reference)).toEqual([code("I", "D1.Q1")]);

    const db = getDatabase();
    const [bankRow] = await db.select({ value: count() }).from(assessmentQuestions).where(eq(assessmentQuestions.scope, "QUESTION_BANK"));
    expect(listed.body.summary.total).toBe(Number(bankRow?.value ?? 0));
  });

  it("stores formula-like cell content verbatim and never evaluates it", async () => {
    const reference = code("S", "D1.Q1");
    const prompt = `=CMD|'/C calc'!A0`;
    const helpText = `=HYPERLINK("http://evil.example","Click here")`;
    const { status, body } = await confirm(scopeRole.slug, buildCsv([
      ordinalRow(reference, {
        question_text: prompt,
        help_text: helpText,
        option_1_text: "=1+1",
        option_2_text: "@SUM(A1:A9)",
        option_3_text: "+danger",
        option_4_text: "-danger",
      }),
    ]), "QUESTION_BANK");
    expect(status, JSON.stringify(body)).toBe(200);

    // Read back byte-for-byte: a leading = + − or @ is data, never a formula.
    const question = await loadQuestion(reference);
    expect(question!.prompt).toBe(prompt);
    expect(question!.helpText).toBe(helpText);
    expect((await loadOptionRows(question!.id)).map((option) => option.optionText)).toEqual(["=1+1", "@SUM(A1:A9)", "+danger", "-danger"]);
  });

  it("rolls the whole transaction back when a nested configuration write fails", async () => {
    const csv = buildCsv(sixTypeFixture(code, "B", "B").csv);
    rollback.failNext = true;
    try {
      const { status, body } = await confirm(rollbackRole.slug, csv, "QUESTION_BANK");
      // A database fault surfaces as the restrained 503, never a stack trace.
      expect(status).toBe(503);
      expect(body).toEqual({ ok: false, error: "Unable to load recruitment data." });
    } finally {
      rollback.failNext = false;
    }

    // Nothing survived: no questions, and no half-created assessment.
    expect(await countQuestions(`B${TAG}.%`)).toBe(0);
    const db = getDatabase();
    const orphaned = await db.select({ id: assessments.id }).from(assessments).where(eq(assessments.roleId, rollbackRole.id));
    expect(orphaned).toEqual([]);

    // The same file imports cleanly once the fault is gone.
    const retry = await confirm(rollbackRole.slug, csv, "QUESTION_BANK");
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.result.importedCount).toBe(6);
    expect(retry.body.result.createdAssessment).toBe(true);
    expect(await countQuestions(`B${TAG}.%`)).toBe(6);
  });

  // ── 6. Manual vs CSV equivalence — one question model, one engine (task #26) ─

  it("produces exactly the same question as a manually created twin, for every type", async () => {
    const fixture = sixTypeFixture(code, "E", "M");
    // Import the CSV half.
    const imported = await confirm(equivalenceRole.slug, buildCsv(fixture.csv), "QUESTION_BANK");
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);
    equivalenceAssessmentId = imported.body.result.assessmentId as string;

    // Hand-create the twins through the ordinary Question Bank API.
    for (const payload of fixture.manual) {
      const created = await api("/api/admin/questions", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify(payload),
      });
      expect(created.status, `${payload.reference}: ${JSON.stringify(created.body)}`).toBe(201);
    }

    // Assign the twins to the very same assessment the CSV questions landed in.
    for (const payload of fixture.manual) {
      const twin = await loadQuestion(payload.reference as string);
      expect(twin, `${payload.reference} should exist`).not.toBeNull();
      const assigned = await api(`/api/admin/assessments/${equivalenceAssessmentId}/questions`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ questionId: twin!.id }),
      });
      expect(assigned.status, JSON.stringify(assigned.body)).toBe(201);
    }

    // The configuration tables hold identical rows for both halves.
    for (const suffix of fixture.suffixes) {
      const fromCsv = await configFingerprint(code("E", suffix), "E");
      const byHand = await configFingerprint(code("M", suffix), "M");
      expect(fromCsv, `${suffix} stored configuration`).toEqual(byHand);
    }

    // So does the projection the scoring engine actually loads. One read serves
    // both halves, and the same answer must then score the same, option slot by
    // option slot.
    const configs = await loadQuestionScoringConfigs(equivalenceAssessmentId);
    const csvSide = scoringFingerprint(configs, "E");
    const manualSide = scoringFingerprint(configs, "M");
    expect([...csvSide.keys()].sort()).toEqual([...fixture.suffixes].sort());
    for (const suffix of fixture.suffixes) {
      expect(csvSide.get(suffix), `${suffix} scoring configuration`).toEqual(manualSide.get(suffix));
    }

    for (const suffix of fixture.suffixes) {
      const csvConfig = configs.find((config) => config.reference === code("E", suffix))!;
      const manualConfig = configs.find((config) => config.reference === code("M", suffix))!;
      expect(csvConfig.options).toHaveLength(manualConfig.options.length);

      // Option ids are random per question, so map each CSV id onto the manual
      // twin's id at the same position before replaying a payload.
      const slotIds = new Map(csvConfig.options.map((option, slot) => [option.id, manualConfig.options[slot]!.id]));
      const substitute = (text: string) => {
        let out = text;
        for (const [csvId, manualId] of slotIds) out = out.split(csvId).join(manualId);
        return out;
      };

      const payloads: Array<{ responseType: string; responsePayload: string }> = [];
      if (csvConfig.questionType === "MULTI") {
        payloads.push({ responseType: "MULTI", responsePayload: JSON.stringify(csvConfig.options.map((option) => option.id)) });
        csvConfig.options.forEach((option) => payloads.push({ responseType: "MULTI", responsePayload: JSON.stringify([option.id]) }));
      } else if (csvConfig.questionType === "NUMERIC") {
        for (const yearsAgo of [0, 1, 2, 4, 8, 20]) {
          payloads.push({ responseType: "NUMERIC", responsePayload: JSON.stringify({ "Calendar year": String(CURRENT_YEAR - yearsAgo) }) });
        }
        payloads.push({ responseType: "NUMERIC", responsePayload: JSON.stringify({ "Calendar year": "not-a-year" }) });
      } else {
        csvConfig.options.forEach((option) => payloads.push({ responseType: csvConfig.questionType, responsePayload: option.id }));
        payloads.push({ responseType: csvConfig.questionType, responsePayload: "" });
      }

      payloads.forEach((payload, index) => {
        const twinPayload = { ...payload, responsePayload: substitute(payload.responsePayload) };
        expect(scoreObjectiveQuestion(csvConfig, payload), `${suffix} payload ${index}`)
          .toBe(scoreObjectiveQuestion(manualConfig, twinPayload));
        expect(resolveEvidenceMultiplier(csvConfig, payload), `${suffix} multiplier ${index}`)
          .toBe(resolveEvidenceMultiplier(manualConfig, twinPayload));
      });
    }
    // A single import plus twelve hand-created questions is a lot of round trips
    // against a remote TiDB: measured at 262s on its own and over 300s when the
    // rest of the suite is sharing the same database. The budget covers the
    // slower case rather than the convenient one.
  }, 900000);

  // ── 7. Full imported-assessment scoring regression (tasks #24, #25) ─────────
  //
  // The whole assessment is built by CSV import alone — one question per
  // dimension, weights summing to exactly 100 — then two applicants take it
  // through the real runtime and are scored by the real engine. Every expected
  // number below is derived from the existing formulas; the CSV feature
  // contributes none of them. Had a second scoring path been introduced
  // anywhere, these values would move.

  /** A 30-word OPEN answer, inside the fixture's 20–200 word window. */
  const OPEN_ANSWER = [
    "I rebuilt the partner channel for a fintech scale-up, personally closing eleven",
    "referral accounts worth 1.4m in annual recurring revenue while coaching two junior",
    "colleagues through their first enterprise deals.",
  ].join(" ");

  it("scores a fully CSV-imported assessment exactly as the existing engine defines", async () => {
    const fixture = sixTypeFixture(code, "G", "G");
    const imported = await confirm(regressionRole.slug, buildCsv(fixture.csv), "QUESTION_BANK");
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);
    expect(imported.body.result.importedCount).toBe(6);
    regressionAssessmentId = imported.body.result.assessmentId as string;

    // The import stages a Draft; an Admin activates it before applicants see it.
    await activateAssessment(regressionAssessmentId);

    const questions = await loadRuntimeQuestions(regressionAssessmentId);
    expect([...questions.keys()]).toEqual(fixture.suffixes.map((suffix) => code("G", suffix)));
    const openQuestionId = questions.get(code("G", "D5.Q1"))!.questionId;

    // ── Applicant A: top marks on every question ──────────────────────────────
    const strong = await createApplicant(regressionRole.slug, "strong");
    // The runtime only creates the attempt when the paper is first loaded, and
    // no answer can be saved before it exists.
    await startAssessment(strong.token, fixture.suffixes.length);
    await submitAnswers(strong.token, questions, {
      [code("G", "D1.Q1")]: (optionIds) => ({ responseType: "ORDINAL", responsePayload: optionIds[0]! }),
      [code("G", "D2.Q1")]: () => ({ responseType: "NUMERIC", responsePayload: { "Calendar year": String(CURRENT_YEAR - 8) } }),
      [code("G", "D2.Q1E")]: (optionIds) => ({ responseType: "EVIDENCE", responsePayload: optionIds[0]! }),
      [code("G", "D3.Q1")]: (optionIds) => ({ responseType: "MULTI", responsePayload: optionIds.slice(0, 3) }),
      [code("G", "D4.Q1")]: (optionIds) => ({ responseType: "SJT", responsePayload: optionIds[0]! }),
      [code("G", "D5.Q1")]: () => ({ responseType: "OPEN", responsePayload: OPEN_ANSWER }),
    });
    await completeAttempt(strong.token);

    // Until a reviewer scores the OPEN answer the engine refuses to guess: no
    // Base, no Final, no Band — while the objective questions are already scored.
    const pending = await loadEvaluation(strong.applicationId);
    expect(pending.evaluationStatus).toBe("Pending OPEN Review");
    expect(pending.baseAssessmentScore).toBeNull();
    expect(pending.finalScreeningScore).toBeNull();
    expect(pending.rawBand).toBeNull();
    expect(pending.appliedBand).toBeNull();
    expect(scoreOf(pending, code("G", "D1.Q1"))).toBe(5);
    expect(scoreOf(pending, code("G", "D2.Q1"))).toBe(5);
    expect(scoreOf(pending, code("G", "D3.Q1"))).toBe(5);
    expect(scoreOf(pending, code("G", "D4.Q1"))).toBe(5);
    // EVIDENCE never contributes a raw score — it only feeds the multiplier.
    expect(scoreOf(pending, code("G", "D2.Q1E"))).toBeNull();
    expect(scoreOf(pending, code("G", "D5.Q1"))).toBeNull();

    await reviewOpenAnswer(strong.applicationId, openQuestionId, 5);

    const scored = await loadEvaluation(strong.applicationId);
    expect(scored.evaluationStatus).toBe("Scored");
    // Every dimension normalizes to 100, so the weighted contributions are the
    // dimension weights themselves and the Base Assessment Score is 100.
    expect(dimensionTable(scored)).toEqual([
      { reference: "D1", normalized: 100, weight: 30, contribution: 30, floorStatus: null },
      { reference: "D2", normalized: 100, weight: 25, contribution: 25, floorStatus: null },
      { reference: "D3", normalized: 100, weight: 20, contribution: 20, floorStatus: null },
      { reference: "D4", normalized: 100, weight: 15, contribution: 15, floorStatus: null },
      { reference: "D5", normalized: 100, weight: 10, contribution: 10, floorStatus: null },
    ]);
    expect(scored.baseAssessmentScore).toBe(100);
    expect(scored.verificationMultiplier).toBe(1);
    expect(scored.integrityPenalty).toBe(0);
    expect(scored.bonus).toBe(0);
    expect(scored.finalScreeningScore).toBe(100);
    expect(scored.rawBand).toBe("A");
    expect(scored.appliedBand).toBe("A");
    expect(scored.floorMissed).toBeNull();
    expect(scored.manualReviewRequired).toBe(false);
    // The OPEN raw score lives in the review, never in questionScores.
    expect(scoreOf(scored, code("G", "D5.Q1"))).toBeNull();

    // The same numbers are what the engine persisted for the Admin screens.
    const db = getDatabase();
    const [stored] = await db.select().from(applicationEvaluations).where(eq(applicationEvaluations.applicationId, strong.applicationId)).limit(1);
    expect(stored).toMatchObject({
      evaluationStatus: "Scored",
      integrityPenalty: 0,
      bonus: 0,
      manualReviewRequired: 0,
      rawBand: "A",
      appliedBand: "A",
      floorMissed: null,
    });
    expect(Number(stored!.baseAssessmentScore)).toBe(100);
    expect(Number(stored!.verificationMultiplier)).toBe(1);
    expect(Number(stored!.finalScreeningScore)).toBe(100);

    const storedDimensions = await db
      .select().from(applicationDimensionScores)
      .where(eq(applicationDimensionScores.applicationId, strong.applicationId))
      .orderBy(asc(applicationDimensionScores.dimensionReference));
    expect(storedDimensions.map((row) => [row.dimensionReference, Number(row.normalizedScore), row.weight, Number(row.weightedContribution)])).toEqual([
      ["D1", 100, 30, 30], ["D2", 100, 25, 25], ["D3", 100, 20, 20], ["D4", 100, 15, 15], ["D5", 100, 10, 10],
    ]);

    // ── Applicant B: mixed answers, a clamped negative SJT, two bonuses ───────
    const mixed = await createApplicant(regressionRole.slug, "mixed");
    await startAssessment(mixed.token, fixture.suffixes.length);
    await submitAnswers(mixed.token, questions, {
      [code("G", "D1.Q1")]: (optionIds) => ({ responseType: "ORDINAL", responsePayload: optionIds[2]! }),
      [code("G", "D2.Q1")]: () => ({ responseType: "NUMERIC", responsePayload: { "Calendar year": String(CURRENT_YEAR - 4) } }),
      [code("G", "D2.Q1E")]: (optionIds) => ({ responseType: "EVIDENCE", responsePayload: optionIds[1]! }),
      [code("G", "D3.Q1")]: (optionIds) => ({ responseType: "MULTI", responsePayload: [optionIds[2]!] }),
      [code("G", "D4.Q1")]: (optionIds) => ({ responseType: "SJT", responsePayload: optionIds[3]! }),
      [code("G", "D5.Q1")]: () => ({ responseType: "OPEN", responsePayload: OPEN_ANSWER }),
    });
    await completeAttempt(mixed.token);
    await reviewOpenAnswer(mixed.applicationId, openQuestionId, 1);
    // 3 + 2 points, landing exactly on the bonus cap.
    await confirmBonuses(mixed.applicationId, ["diplomatic-account", "french-arabic"]);

    const partial = await loadEvaluation(mixed.applicationId);
    expect(partial.evaluationStatus).toBe("Scored");
    expect(scoreOf(partial, code("G", "D1.Q1"))).toBe(2);
    // 4 years of derived experience falls in the 3–5 band.
    expect(scoreOf(partial, code("G", "D2.Q1"))).toBe(3);
    expect(scoreOf(partial, code("G", "D3.Q1"))).toBe(2);
    // A −2 SJT option stays −2 as a raw score…
    expect(scoreOf(partial, code("G", "D4.Q1"))).toBe(-2);
    expect(dimensionTable(partial)).toEqual([
      { reference: "D1", normalized: 40, weight: 30, contribution: 12, floorStatus: null },
      { reference: "D2", normalized: 60, weight: 25, contribution: 15, floorStatus: null },
      { reference: "D3", normalized: 40, weight: 20, contribution: 8, floorStatus: null },
      // …and the normalization clamps at zero instead of going negative.
      { reference: "D4", normalized: 0, weight: 15, contribution: 0, floorStatus: null },
      { reference: "D5", normalized: 20, weight: 10, contribution: 2, floorStatus: null },
    ]);
    expect(partial.baseAssessmentScore).toBe(37);
    expect(partial.verificationMultiplier).toBe(0.95);
    // The seeded cross-checks are keyed to the live BDO references, so none of
    // them can fire on imported questions and the penalty stays zero.
    expect(partial.integrityPenalty).toBe(0);
    expect(partial.bonus).toBe(5);
    // min(100, max(0, 37 × 0.95 − 0 + 5))
    expect(partial.finalScreeningScore).toBe(40.15);
    expect(partial.rawBand).toBe("D");
    expect(partial.appliedBand).toBe("D");
    expect(partial.floorMissed).toBeNull();

    const [storedPartial] = await db.select().from(applicationEvaluations).where(eq(applicationEvaluations.applicationId, mixed.applicationId)).limit(1);
    expect(Number(storedPartial!.baseAssessmentScore)).toBe(37);
    expect(Number(storedPartial!.verificationMultiplier)).toBe(0.95);
    expect(Number(storedPartial!.finalScreeningScore)).toBe(40.15);
    expect(storedPartial!.rawBand).toBe("D");
    expect(storedPartial!.appliedBand).toBe("D");
    expect(storedPartial!.bonus).toBe(5);

    // One import, two full applicant runs and seven recalculations — the Admin
    // evaluation endpoint recalculates on every read — all against a remote
    // TiDB: measured at 239s on its own and 511s when the rest of the suite is
    // sharing the same database. This is the heaviest test here and the budget
    // has to cover the slower case.
  }, 900000);

  // ── 8. The live seeded assessment is untouched (task #27) ───────────────────

  it("leaves the seeded live assessment exactly as it was before any import ran", async () => {    expect(bdoBefore, "the live BDO v2 assessment should be seeded").not.toBeNull();
    const after = await snapshotAssessment(BDO_V2_SLUG);
    // Same row, same metadata, same assignment list down to the question ids
    // and display order — compared, not assumed.
    expect(after).toEqual(bdoBefore);
    expect(after!.assignments.map((assignment) => assignment.reference)).toEqual([...BDO_APPROVED_ORDER]);
    expect(after!.assignments.some((assignment) => assignment.reference.includes(TAG))).toBe(false);

    // The Admin API agrees with the direct read.
    const detail = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    expect(detail.status).toBe(200);
    expect(detail.body.assessment.name).toBe("Business Development Officer Assessment v2");
    expect(detail.body.assessment.version).toBe(2);
    expect(["Active", "Draft"]).toContain(detail.body.assessment.status);
    expect(detail.body.assessment.questionCount).toBe(BDO_APPROVED_ORDER.length);
    expect(detail.body.assessment.assignments.map((row: any) => row.reference)).toEqual([...BDO_APPROVED_ORDER]);

    // And not one question from this run was ever attached to it.
    const db = getDatabase();
    const [leaked] = await db
      .select({ value: count() })
      .from(assessmentQuestionAssignments)
      .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, assessmentQuestionAssignments.questionId))
      .where(and(
        eq(assessmentQuestionAssignments.assessmentId, after!.id),
        sql`${assessmentQuestions.reference} LIKE ${`%${TAG}%`}`,
      ));
    expect(Number(leaked?.value ?? 0)).toBe(0);
  });

  // ── 9. Framework generation tests ───────────────────────────────────────────

  /**
   * A role without any Evaluation Framework dimensions. Used only in this
   * section — the main import tests all use roles that already have FRAMEWORK.
   */
  const noFrameworkRole = { id: `csv-nofw-${marker}`, slug: `csv-nofw-${marker}` };

  /**
   * CSV that includes framework metadata for five new dimensions totalling 100%.
   * Matches the Executive Housekeeper fixture from the task spec.
   */
  const EH_FRAMEWORK = [
    { code: "D1", name: "Housekeeping Leadership Experience", weight: 25, floor: 50 },
    { code: "D2", name: "Team Leadership & Work Allocation",  weight: 15, floor: 50 },
    { code: "D3", name: "Systems & Operational Control",     weight: 10, floor: null },
    { code: "D4", name: "Quality, Standards & Room Readiness", weight: 25, floor: 50 },
    { code: "D5", name: "Coordination & Peak Operations",    weight: 25, floor: 50 },
  ] as const;

  function ehCsvRow(questionCode: string, dimCode: string, order: number): CsvRow {
    const dim = EH_FRAMEWORK.find((d) => d.code === dimCode)!;
    return {
      question_code: questionCode,
      question_text: `EH question ${questionCode}`,
      question_type: "SJT",
      dimension_code: dimCode,
      dimension_name: dim.name,
      dimension_weight: dim.weight,
      dimension_floor: dim.floor ?? "",
      display_order: order,
      q_weight: 2,
      max_score: SCORED_QUESTION_MAX,
      status: "Active",
      ...optionCells([
        { text: "A", score: 5, explanation: "Best" },
        { text: "B", score: 2, explanation: "Good" },
        { text: "C", score: 1, explanation: "Ok" },
        { text: "D", score: -2, explanation: "Poor" },
      ]),
    };
  }

  // Create the no-framework role once in beforeAll is tricky because the
  // beforeAll already ran; use a lazy-setup approach inside each test instead.
  async function ensureNoFrameworkRole() {
    const db = getDatabase();
    const existing = await db
      .select({ id: recruitmentRoles.id })
      .from(recruitmentRoles)
      .where(eq(recruitmentRoles.id, noFrameworkRole.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(recruitmentRoles).values({
        id: noFrameworkRole.id,
        slug: noFrameworkRole.slug,
        title: `CSV No-Framework Role ${marker}`,
        department: "Test",
        location: "Lagos",
        employmentType: "Full-time",
        shortDescription: "No-framework test role",
        fullDescription: "No framework test role",
        status: "Open",
        closingDate: "2027-12-31",
      });
    }
    // Clear any dimensions left by a previous test run within the same suite.
    await db
      .delete(assessmentDimensions)
      .where(eq(assessmentDimensions.roleId, noFrameworkRole.id));
    // Clear any assessments.
    await db
      .delete(assessments)
      .where(eq(assessments.roleId, noFrameworkRole.id));
  }

  it("TEST-FW-1: preview returns frameworkState=no_framework when role has no dimensions", async () => {
    await ensureNoFrameworkRole();
    const csv = buildCsv([ehCsvRow(code("FW", "D1.Q1"), "D1", 1)]);
    const { status, body } = await preview(noFrameworkRole.slug, csv);
    expect(status).toBe(200);
    expect(body.preview.frameworkState).toBe("no_framework");
    expect(body.preview.frameworkPreview).not.toBeNull();
    expect(body.preview.frameworkPreview.missingCodes).toContain("D1");
  });

  it("TEST-FW-2: preview returns frameworkState=partial when some dimensions are missing", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();
    // Pre-seed D1 only.
    await db.insert(assessmentDimensions).values({
      id: `${noFrameworkRole.id}-dim-D1`,
      roleId: noFrameworkRole.id,
      reference: "D1",
      name: EH_FRAMEWORK[0].name,
      weight: 25,
      minimumFloor: 50,
      displayOrder: 1,
      status: "Active",
    });
    const csv = buildCsv([
      ehCsvRow(code("FW", "D1.Q2"), "D1", 1),
      ehCsvRow(code("FW", "D2.Q1"), "D2", 2),
    ]);
    const { body } = await preview(noFrameworkRole.slug, csv);
    expect(body.preview.frameworkState).toBe("partial");
    expect(body.preview.frameworkPreview.missingCodes).toEqual(["D2"]);
    expect(body.preview.frameworkPreview.conflictingCodes).toEqual([]);
  });

  it("TEST-FW-3: preview returns frameworkState=conflict when CSV metadata differs from existing", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();
    // Seed D1 with a DIFFERENT weight from what the CSV declares.
    await db.insert(assessmentDimensions).values({
      id: `${noFrameworkRole.id}-dim-D1-conflict`,
      roleId: noFrameworkRole.id,
      reference: "D1",
      name: EH_FRAMEWORK[0].name,
      weight: 20, // CSV says 25
      minimumFloor: 50,
      displayOrder: 1,
      status: "Active",
    });
    const csv = buildCsv([ehCsvRow(code("FW", "D1.Q3"), "D1", 1)]);
    const { body } = await preview(noFrameworkRole.slug, csv);
    expect(body.preview.frameworkState).toBe("conflict");
    expect(body.preview.frameworkPreview.conflictingCodes).toContain("D1");
    expect(body.preview.frameworkPreview.canAutoCreate).toBe(false);
  });

  it("TEST-FW-4: csv-framework creates all five EH dimensions and revalidates the CSV", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();

    const csv = buildCsv([
      ehCsvRow(code("FW", "EH.D1.Q1"), "D1", 1),
      ehCsvRow(code("FW", "EH.D1.Q2"), "D1", 2), // D1 repeated — must be consistent
      ehCsvRow(code("FW", "EH.D2.Q1"), "D2", 3),
      ehCsvRow(code("FW", "EH.D3.Q1"), "D3", 4),
      ehCsvRow(code("FW", "EH.D4.Q1"), "D4", 5),
      ehCsvRow(code("FW", "EH.D5.Q1"), "D5", 6),
    ]);

    // Before: preview has frameworkState=no_framework and 0 valid rows.
    const before = await preview(noFrameworkRole.slug, csv);
    expect(before.body.preview.frameworkState).toBe("no_framework");
    expect(before.body.preview.valid).toBe(0);

    // Create the framework.
    const create = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    const createBody = await create.json() as Record<string, any>;
    expect(create.status, JSON.stringify(createBody)).toBe(200);
    expect(createBody.ok).toBe(true);

    // The refreshed preview returned in the same response must now be valid.
    expect(createBody.preview.frameworkState).toBe("ok");
    expect(createBody.preview.valid).toBe(6);
    expect(createBody.preview.errorCount).toBe(0);

    // Dimensions are in the same assessmentDimensions table the manual editor uses.
    const dims = await db
      .select({ reference: assessmentDimensions.reference, name: assessmentDimensions.name, weight: assessmentDimensions.weight, minimumFloor: assessmentDimensions.minimumFloor })
      .from(assessmentDimensions)
      .where(eq(assessmentDimensions.roleId, noFrameworkRole.id))
      .orderBy(asc(assessmentDimensions.displayOrder));
    expect(dims).toHaveLength(5);
    expect(dims.map((d) => d.reference)).toEqual(["D1", "D2", "D3", "D4", "D5"]);
    expect(dims.map((d) => d.weight)).toEqual([25, 15, 10, 25, 25]);
    expect(dims.find((d) => d.reference === "D3")!.minimumFloor).toBeNull();
    expect(dims.find((d) => d.reference === "D1")!.minimumFloor).toBe(50);
  });

  it("TEST-FW-5: csv-framework is rejected for an unauthenticated caller", async () => {
    await ensureNoFrameworkRole();
    const csv = buildCsv([ehCsvRow(code("FW", "EH.D1.Q99"), "D1", 1)]);
    const anon = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csv,
    });
    expect(anon.status).toBe(401);
  });

  it("TEST-FW-6: csv-framework is rejected when weights do not total 100%", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();
    // D1=25 + D2=15 = 40 → total will be 40 ≠ 100.
    function shortCsvRow(q: string, dim: string, dimName: string, weight: number): CsvRow {
      return {
        question_code: q, question_text: "Q", question_type: "SJT", dimension_code: dim,
        dimension_name: dimName, dimension_weight: weight, dimension_floor: "",
        display_order: 1, q_weight: 2, max_score: SCORED_QUESTION_MAX, status: "Active",
        ...optionCells([
          { text: "A", score: 5, explanation: "Best" }, { text: "B", score: 2, explanation: "Good" },
          { text: "C", score: 1, explanation: "Ok" },   { text: "D", score: -2, explanation: "Poor" },
        ]),
      };
    }
    const csv = buildCsv([
      shortCsvRow(code("FW", "W1"), "D1", "Alpha", 25),
      shortCsvRow(code("FW", "W2"), "D2", "Beta",  15),
    ]);
    const resp = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    expect(resp.status).toBe(400);
    const body = await resp.json() as Record<string, any>;
    expect(body.ok).toBe(false);
    expect(body.error).toContain("40%");
    expect(body.error).toContain("100%");

    // No dimensions were created.
    const dims = await db.select().from(assessmentDimensions).where(eq(assessmentDimensions.roleId, noFrameworkRole.id));
    expect(dims).toHaveLength(0);
  });

  it("TEST-FW-7: csv-framework is rejected when dimension_name is missing", async () => {
    await ensureNoFrameworkRole();
    const csv = buildCsv([{
      question_code: code("FW", "NM1"), question_text: "Q", question_type: "SJT",
      dimension_code: "D1", dimension_name: "", dimension_weight: 100, dimension_floor: "",
      display_order: 1, q_weight: 2, max_score: SCORED_QUESTION_MAX, status: "Active",
      ...optionCells([
        { text: "A", score: 5, explanation: "Best" }, { text: "B", score: 2, explanation: "Good" },
        { text: "C", score: 1, explanation: "Ok" },   { text: "D", score: -2, explanation: "Poor" },
      ]),
    }]);
    const resp = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    expect(resp.status).toBe(400);
    const body = await resp.json() as Record<string, any>;
    expect(body.error).toContain("dimension_name");
  });

  it("TEST-FW-8: csv-framework is rejected when CSV rows are inconsistent for the same dimension", async () => {
    await ensureNoFrameworkRole();
    function inconsistentRow(q: string, dim: string, name: string, weight: number, order: number): CsvRow {
      return {
        question_code: q, question_text: "Q", question_type: "SJT", dimension_code: dim,
        dimension_name: name, dimension_weight: weight, dimension_floor: "",
        display_order: order, q_weight: 2, max_score: SCORED_QUESTION_MAX, status: "Active",
        ...optionCells([
          { text: "A", score: 5, explanation: "Best" }, { text: "B", score: 2, explanation: "Good" },
          { text: "C", score: 1, explanation: "Ok" },   { text: "D", score: -2, explanation: "Poor" },
        ]),
      };
    }
    const csv = buildCsv([
      inconsistentRow(code("FW", "IC1"), "D1", "Alpha", 30, 1), // D1 weight 30
      inconsistentRow(code("FW", "IC2"), "D1", "Alpha", 25, 2), // D1 weight 25 — conflict
    ]);
    const resp = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    expect(resp.status).toBe(400);
    const body = await resp.json() as Record<string, any>;
    expect(body.error).toContain("inconsistent");
  });

  it("TEST-FW-9: csv-framework does not overwrite an existing identical dimension but succeeds for new ones", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();
    // Pre-seed D1 with EXACTLY the same metadata the CSV will declare.
    await db.insert(assessmentDimensions).values({
      id: `${noFrameworkRole.id}-dim-D1-exist`,
      roleId: noFrameworkRole.id,
      reference: "D1",
      name: EH_FRAMEWORK[0].name,
      weight: EH_FRAMEWORK[0].weight,
      minimumFloor: EH_FRAMEWORK[0].floor,
      displayOrder: 1,
      status: "Active",
    });

    // Include only D1 (existing, same config) and D2 (new); D1+D2 = 40 → need
    // extra weight; skip weight total for this test by making D2=75.
    const csv = buildCsv([
      ehCsvRow(code("FW", "EH2.D1.Q1"), "D1", 1),
      {
        question_code: code("FW", "EH2.D2.Q1"), question_text: "Q", question_type: "SJT",
        dimension_code: "D2", dimension_name: "Team Leadership & Work Allocation",
        dimension_weight: 75, dimension_floor: 50,
        display_order: 2, q_weight: 2, max_score: SCORED_QUESTION_MAX, status: "Active",
        ...optionCells([
          { text: "A", score: 5, explanation: "Best" }, { text: "B", score: 2, explanation: "Good" },
          { text: "C", score: 1, explanation: "Ok" },   { text: "D", score: -2, explanation: "Poor" },
        ]),
      },
    ]);

    const resp = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    const respBody = await resp.json() as Record<string, any>;
    expect(resp.status, JSON.stringify(respBody)).toBe(200);

    const dims = await db
      .select({ reference: assessmentDimensions.reference })
      .from(assessmentDimensions)
      .where(eq(assessmentDimensions.roleId, noFrameworkRole.id))
      .orderBy(asc(assessmentDimensions.displayOrder));
    // D1 already existed; D2 was created; total = 2.
    expect(dims.map((d) => d.reference)).toEqual(["D1", "D2"]);
  });

  it("TEST-FW-10: csv-framework is rejected when there is a conflict with an existing dimension", async () => {
    const db = getDatabase();
    await ensureNoFrameworkRole();
    // D1 exists with weight=25; CSV declares weight=30 → conflict.
    await db.insert(assessmentDimensions).values({
      id: `${noFrameworkRole.id}-dim-D1-cfl2`,
      roleId: noFrameworkRole.id,
      reference: "D1",
      name: EH_FRAMEWORK[0].name,
      weight: 25,
      minimumFloor: 50,
      displayOrder: 1,
      status: "Active",
    });
    const csv = buildCsv([{
      question_code: code("FW", "CFL1"), question_text: "Q", question_type: "SJT",
      dimension_code: "D1", dimension_name: EH_FRAMEWORK[0].name,
      dimension_weight: 30, // conflict: existing is 25
      dimension_floor: 50,
      display_order: 1, q_weight: 2, max_score: SCORED_QUESTION_MAX, status: "Active",
      ...optionCells([
        { text: "A", score: 5, explanation: "Best" }, { text: "B", score: 2, explanation: "Good" },
        { text: "C", score: 1, explanation: "Ok" },   { text: "D", score: -2, explanation: "Poor" },
      ]),
    }]);
    const resp = await fetch(`${baseUrl}/api/admin/recruitment-roles/${noFrameworkRole.slug}/assessment/csv-framework`, {
      method: "POST",
      headers: { "Content-Type": "text/csv", Cookie: adminCookie },
      body: csv,
    });
    expect(resp.status).toBe(400);
    const body = await resp.json() as Record<string, any>;
    expect(body.error).toMatch(/D1|existing|overwrite/i);
  });
});

