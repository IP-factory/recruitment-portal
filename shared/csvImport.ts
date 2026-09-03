/**
 * CSV Assessment Question Import — shared contract (pure, no database access).
 *
 * This module owns everything that can be decided without TiDB:
 *   1. A safe, dependency-free RFC4180 CSV parser (quoted fields, embedded
 *      commas/newlines, doubled quotes, BOM, CRLF/LF/CR) with hard limits.
 *   2. The documented CSV column schema (core + option + numeric + rubric).
 *   3. A deterministic row → `QuestionInput` transform that feeds the SAME
 *      `validateQuestionInput` used by manual Question Bank creation, so an
 *      imported question is structurally identical to a manually created one.
 *   4. Preview DTOs shared by the Express API, the client and the tests.
 *   5. CSV template generation.
 *
 * Role-scoped checks (does the dimension exist in this role's Evaluation
 * Framework? does the question code already exist?) require the database and
 * live in server/csvImportRepository.ts, which augments the pure result here.
 *
 * SECURITY: CSV content is untrusted Admin input. It is parsed as inert text —
 * never evaluated, never interpreted as HTML/formulae, and every value is
 * persisted through parameterized Drizzle writes downstream. Admin content is
 * stored verbatim (a prompt such as "=5+3" is a legitimate math question, not
 * a formula to execute); React escapes it on render and the scorer only ever
 * reads numeric configuration.
 */
import {
  MULTI_DEFAULT_SCORE_CAP,
  QUESTION_REFERENCE_MAX_LENGTH,
  QUESTION_TYPES,
  SCORED_QUESTION_MAX,
  isScoredQuestionType,
  validateQuestionInput,
  type QuestionInput,
  type QuestionType,
} from "./questionBankApi";

// ── Limits (task #28) ─────────────────────────────────────────────────────────

/** Maximum number of question rows per CSV. */
export const MAX_CSV_QUESTIONS = 100;
/** Hard structural cap on parsed logical records (header + data + blanks). */
export const MAX_CSV_ROWS = 400;
/** Maximum accepted upload size in bytes (mirrors the route-level text limit). */
export const MAX_CSV_BYTES = 1_000_000;
/** Maximum length of a single cell. */
export const MAX_CSV_CELL_LENGTH = 4000;
/** Option columns supported: option_1 … option_10. */
export const MAX_OPTION_COLUMNS = 10;
/** Numeric scoring bands supported: band_1 … band_5. */
export const MAX_NUMERIC_BANDS = 5;

export const CSV_SCOPES = ["QUESTION_BANK", "ROLE_ONLY"] as const;
export type CsvScope = (typeof CSV_SCOPES)[number];

/** Question types importable through CSV. GATE stays under Eligibility (task #3). */
export const CSV_QUESTION_TYPES = ["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"] as const;

// ── Column schema (task #4, #5, #9, #10, #11) ─────────────────────────────────

export const CORE_COLUMNS = [
  "question_code",
  "question_text",
  "question_type",
  "dimension_code",
  "dimension_name",
  "dimension_weight",
  "dimension_floor",
  "display_order",
  "q_weight",
  "max_score",
  "required",
  "help_text",
  "status",
  "time_limit_sec",
  "claimed_question_reference",
] as const;

function optionColumns(): string[] {
  const columns: string[] = [];
  for (let index = 1; index <= MAX_OPTION_COLUMNS; index += 1) {
    columns.push(`option_${index}_text`, `option_${index}_score`, `option_${index}_explanation`);
  }
  return columns;
}

function numericColumns(): string[] {
  const columns: string[] = ["numeric_mode", "calculation_type"];
  for (let index = 1; index <= 2; index += 1) {
    columns.push(`input_${index}_key`, `input_${index}_label`, `input_${index}_unit`);
  }
  for (let index = 1; index <= MAX_NUMERIC_BANDS; index += 1) {
    columns.push(`band_${index}_min`, `band_${index}_max`, `band_${index}_score`);
  }
  return columns;
}

function openColumns(): string[] {
  return [
    "rubric_low_min",
    "rubric_low_max",
    "rubric_low_anchor",
    "rubric_mid_min",
    "rubric_mid_max",
    "rubric_mid_anchor",
    "rubric_high_min",
    "rubric_high_max",
    "rubric_high_anchor",
    "open_min_words",
    "open_max_words",
    "open_paste_allowed",
  ];
}

/** Full, ordered CSV header. The template and the parser share this list. */
export const CSV_COLUMNS: string[] = [...CORE_COLUMNS, ...optionColumns(), ...numericColumns(), ...openColumns()];

/** Columns that must be present in the header for the file to be usable. */
export const REQUIRED_COLUMNS = ["question_code", "question_text", "question_type"] as const;

// ── Framework dimension types ─────────────────────────────────────────────────

/**
 * One dimension as read from the CSV's dimension_name/weight/floor columns.
 * Multiple CSV rows belonging to the same dimension_code must carry identical
 * metadata; the importer deduplicates and validates consistency.
 */
export interface CsvFrameworkDimensionRow {
  code: string;
  /** Raw value from dimension_name; null when the cell was blank. */
  name: string | null;
  /** Raw value from dimension_weight; null when blank. */
  weight: number | null;
  /** Raw value from dimension_floor; null when blank (= no floor). */
  floor: number | null;
  /**
   * True only when every row carrying this code has identical name/weight/floor.
   * False signals a consistency violation that blocks auto-creation.
   */
  consistent: boolean;
  /** Human-readable description of the inconsistency (set when consistent=false). */
  inconsistencyReason: string | null;
}

/**
 * A single dimension as presented in the framework-preview panel shown to the
 * Admin before they decide to create the framework automatically or manually.
 *
 *   isNew         — true when this dimension does not yet exist for the role.
 *   conflictsWith — set when the role has a dimension with the same code but
 *                   different name/weight/floor. Auto-creation is blocked.
 */
export interface CsvFrameworkDimensionDto {
  code: string;
  name: string;
  weight: number;
  floor: number | null;
  isNew: boolean;
  conflictsWith: { name: string; weight: number; floor: number | null } | null;
}

/**
 * The framework-generation preview returned inside CsvImportPreviewDto.
 * Always present when the CSV contains at least one dimension_code, even if
 * all dimensions already exist (so the UI can confirm no action is needed).
 */
export interface CsvFrameworkPreviewDto {
  /** All unique dimension codes referenced in this CSV, fully analysed. */
  dimensions: CsvFrameworkDimensionDto[];
  /** Sum of weight values for NEW dimensions only. */
  newDimensionWeightTotal: number;
  /** Sum of weight values for ALL dimensions (existing + new) as declared in the CSV. */
  allDimensionWeightTotal: number;
  /** Codes referenced in the CSV that are not yet in the role's framework. */
  missingCodes: string[];
  /** Codes where the role already has a dimension but CSV metadata conflicts. */
  conflictingCodes: string[];
  /**
   * True when auto-creation is technically possible: all missing dimensions
   * carry complete, consistent name/weight/floor, weights total 100 across the
   * full framework (existing + new), and no conflicts exist.
   */
  canAutoCreate: boolean;
  /**
   * Human-readable reason why canAutoCreate is false, if applicable.
   */
  cannotAutoCreateReason: string | null;
}

/**
 * The framework readiness state from the perspective of this CSV upload.
 *
 *   ok             — all referenced dimensions exist in the role's framework.
 *   no_framework   — role has zero dimensions; ALL must be created.
 *   partial        — role has some dimensions, but not all referenced ones.
 *   conflict       — at least one dimension exists but its config differs from
 *                    what the CSV declares.
 */
export type CsvFrameworkState = "ok" | "no_framework" | "partial" | "conflict";

// ── Framework dimension extraction (pure) ─────────────────────────────────────

interface RowFrameworkData {
  code: string;
  name: string | null;
  weight: number | null;
  floor: number | null;
}

/**
 * Read the dimension_name, dimension_weight and dimension_floor cells for every
 * data row in a parsed CSV, then deduplicate by code and validate consistency.
 *
 * Rules:
 *  - Rows with a blank dimension_code produce no framework entry.
 *  - Multiple rows with the same code must have identical name/weight/floor.
 *    A mismatch marks that dimension as inconsistent and blocks auto-creation.
 *  - A blank floor cell means "no floor" — floor === null is valid.
 */
export function extractCsvFrameworkDimensions(rawRows: string[][], header: string[]): CsvFrameworkDimensionRow[] {
  const columnIndex = new Map<string, number>();
  header.forEach((name, position) => {
    if (!columnIndex.has(name)) columnIndex.set(name, position);
  });

  const getCell = (cells: string[], colName: string): string => {
    const idx = columnIndex.get(colName);
    return idx !== undefined ? (cells[idx] ?? "").trim() : "";
  };

  const accumulator = new Map<
    string,
    { canonical: RowFrameworkData; inconsistencyReasons: string[]; firstRowNumber: number }
  >();

  for (let position = 1; position < rawRows.length; position += 1) {
    const cells = rawRows[position];
    const rowNumber = position + 1;
    const isBlankRow = cells.every((v) => v.trim() === "");
    if (isBlankRow) continue;

    const codeRaw = getCell(cells, "dimension_code");
    if (!codeRaw) continue;
    const code = codeRaw.toUpperCase();

    const nameRaw = getCell(cells, "dimension_name");
    const name: string | null = nameRaw === "" ? null : nameRaw;

    const weightRaw = getCell(cells, "dimension_weight");
    let weight: number | null = null;
    if (weightRaw !== "") {
      const parsed = Number(weightRaw);
      weight = Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    const floorRaw = getCell(cells, "dimension_floor");
    let floor: number | null = null;
    if (floorRaw !== "") {
      const parsed = Number(floorRaw);
      floor = Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    const entry = accumulator.get(code);
    if (!entry) {
      accumulator.set(code, {
        canonical: { code, name, weight, floor },
        inconsistencyReasons: [],
        firstRowNumber: rowNumber,
      });
    } else {
      const c = entry.canonical;
      if (c.name !== name) {
        entry.inconsistencyReasons.push(
          `dimension_name differs: "${c.name ?? ""}" vs "${name ?? ""}" (rows ${entry.firstRowNumber} and ${rowNumber}).`,
        );
      }
      if (c.weight !== weight) {
        entry.inconsistencyReasons.push(
          `dimension_weight differs: ${c.weight ?? "blank"} vs ${weight ?? "blank"} (rows ${entry.firstRowNumber} and ${rowNumber}).`,
        );
      }
      if (c.floor !== floor) {
        entry.inconsistencyReasons.push(
          `dimension_floor differs: ${c.floor ?? "blank"} vs ${floor ?? "blank"} (rows ${entry.firstRowNumber} and ${rowNumber}).`,
        );
      }
    }
  }

  return Array.from(accumulator.values()).map(({ canonical, inconsistencyReasons }) => ({
    code: canonical.code,
    name: canonical.name,
    weight: canonical.weight,
    floor: canonical.floor,
    consistent: inconsistencyReasons.length === 0,
    inconsistencyReason: inconsistencyReasons.length > 0 ? inconsistencyReasons[0] : null,
  }));
}

/**
 * Validate the framework dimensions extracted from a CSV against a set of
 * existing role dimensions and return the preview DTO.
 *
 * existingDimensions: the role's current assessmentDimensions rows.
 * This is pure — no database access — so tests call it directly.
 */
export function buildFrameworkPreview(
  csvDimensions: CsvFrameworkDimensionRow[],
  existingDimensions: Array<{ reference: string; name: string; weight: number; minimumFloor: number | null }>,
): CsvFrameworkPreviewDto {
  const existingByCode = new Map(existingDimensions.map((d) => [d.reference.toUpperCase(), d]));

  const dimensions: CsvFrameworkDimensionDto[] = [];
  const missingCodes: string[] = [];
  const conflictingCodes: string[] = [];
  let newWeightTotal = 0;
  let allWeightTotal = 0;

  for (const csvDim of csvDimensions) {
    const existing = existingByCode.get(csvDim.code);
    const weight = typeof csvDim.weight === "number" && !Number.isNaN(csvDim.weight) ? csvDim.weight : 0;
    const floor = typeof csvDim.floor === "number" && !Number.isNaN(csvDim.floor) ? csvDim.floor : null;
    const name = csvDim.name ?? "";

    if (!existing) {
      missingCodes.push(csvDim.code);
      newWeightTotal += weight;
      allWeightTotal += weight;
      dimensions.push({ code: csvDim.code, name, weight, floor, isNew: true, conflictsWith: null });
    } else {
      allWeightTotal += existing.weight;
      // Conflict: CSV provides metadata that differs from the existing dimension.
      const hasConflict =
        csvDim.name !== null &&
        (existing.name.trim() !== name.trim() ||
          existing.weight !== weight ||
          (existing.minimumFloor ?? null) !== floor);
      if (hasConflict) {
        conflictingCodes.push(csvDim.code);
        dimensions.push({
          code: csvDim.code,
          name: existing.name,
          weight: existing.weight,
          floor: existing.minimumFloor ?? null,
          isNew: false,
          conflictsWith: { name, weight, floor },
        });
      } else {
        dimensions.push({
          code: csvDim.code,
          name: existing.name,
          weight: existing.weight,
          floor: existing.minimumFloor ?? null,
          isNew: false,
          conflictsWith: null,
        });
      }
    }
  }

  // ── Can auto-create? ──────────────────────────────────────────────────────

  const blockingReasons: string[] = [];

  const inconsistent = csvDimensions.filter((d) => !d.consistent);
  if (inconsistent.length > 0) {
    blockingReasons.push(
      `Dimension ${inconsistent[0].code} has inconsistent configuration across rows: ${inconsistent[0].inconsistencyReason}`,
    );
  }

  if (conflictingCodes.length > 0) {
    blockingReasons.push(
      `${conflictingCodes.join(", ")} already ${conflictingCodes.length === 1 ? "exists" : "exist"} in this role's framework with different configuration. Resolve the conflict manually.`,
    );
  }

  for (const dim of csvDimensions.filter((d) => !existingByCode.has(d.code))) {
    if (!dim.name || dim.name.trim() === "") {
      blockingReasons.push(`Dimension ${dim.code} is missing a dimension_name in the CSV.`);
    }
    if (dim.weight === null || Number.isNaN(dim.weight)) {
      blockingReasons.push(`Dimension ${dim.code} is missing a dimension_weight in the CSV.`);
    } else if (dim.weight <= 0) {
      blockingReasons.push(`Dimension ${dim.code} has an invalid dimension_weight: weight must be greater than zero.`);
    }
    if (dim.floor !== null && Number.isNaN(dim.floor)) {
      blockingReasons.push(`Dimension ${dim.code} has an invalid dimension_floor value in the CSV.`);
    }
  }

  const existingWeightTotal = existingDimensions.reduce((sum, d) => sum + d.weight, 0);
  const projectedTotal = existingWeightTotal + newWeightTotal;
  if (missingCodes.length > 0 && projectedTotal !== 100) {
    blockingReasons.push(
      `Dimension weights total ${projectedTotal}% after adding the new dimensions. The full framework must total 100%.`,
    );
  }

  const canAutoCreate = blockingReasons.length === 0 && missingCodes.length > 0;

  return {
    dimensions,
    newDimensionWeightTotal: newWeightTotal,
    allDimensionWeightTotal: allWeightTotal,
    missingCodes,
    conflictingCodes,
    canAutoCreate,
    cannotAutoCreateReason: blockingReasons.length > 0 ? blockingReasons[0] : null,
  };
}

// ── Errors & DTOs ─────────────────────────────────────────────────────────────

/** Structural CSV failure (unterminated quote, too many rows/cells). */
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/** A single parsed row with its transform outcome. `input` is set only when the
 * row passes `validateQuestionInput`; `errors` are row-prefixed messages. */
export interface CsvParsedRow {
  /** 1-based logical record number (header = row 1), spreadsheet-accurate. */
  rowNumber: number;
  /** Effective assessment order (provided display_order or the row sequence). */
  order: number | null;
  code: string;
  question: string;
  type: string;
  dimension: string;
  qWeight: number | null;
  maxScore: number | null;
  optionCount: number;
  status: string;
  /** Sanitized QuestionInput when the row is type-valid; null otherwise. */
  input: QuestionInput | null;
  /** Dimension reference to verify against the role framework (server-side). */
  dimensionCode: string | null;
  errors: string[];
}

export interface CsvParseResult {
  /** Number of non-empty data rows detected. */
  detected: number;
  rows: CsvParsedRow[];
  /** File-level errors (missing columns, too many rows, parse failure). */
  errors: string[];
  /**
   * Framework dimensions extracted from the dimension_name/weight/floor columns,
   * deduplicated and consistency-checked. Empty array when the file failed to
   * parse or contained no dimension_code cells.
   */
  frameworkDimensions: CsvFrameworkDimensionRow[];
}

/** Preview row exactly as rendered in the Import Preview table (task #14). */
export interface CsvPreviewRowDto {
  rowNumber: number;
  order: number | null;
  code: string;
  question: string;
  type: string;
  dimension: string;
  qWeight: number | null;
  maxScore: number | null;
  optionCount: number;
  status: string;
  /** True when every error on this row (structural + framework) is resolved. */
  valid: boolean;
  /**
   * True when the question's type, options and scoring configuration are
   * structurally correct, regardless of whether the dimension exists in the
   * role's framework. Used to show "10 questions valid" separately from
   * framework setup status.
   */
  structurallyValid: boolean;
  errors: string[];
}

export interface CsvImportPreviewDto {
  detected: number;
  /** Count of rows fully ready to import (structural + framework both OK). */
  valid: number;
  /**
   * Count of rows whose question configuration is structurally correct
   * (type, options, scores), regardless of framework state. When
   * frameworkState is not "ok", this may be higher than `valid` — the UI
   * uses this to show "10 questions valid" separately from framework setup.
   */
  structurallyValidCount: number;
  errorCount: number;
  rows: CsvPreviewRowDto[];
  /** File-level errors (empty file, missing columns, row limit). */
  errors: string[];
  /** The role's Evaluation Framework dimensions, for UI hints/validation. */
  dimensions: Array<{ reference: string; name: string }>;
  /** The assessment the import will target, or that will be created. */
  assessment: { id: string | null; name: string; status: string; willCreate: boolean } | null;
  /**
   * Framework readiness state. Present whenever the CSV contains dimension
   * references; null when the file failed to parse (no dimension data available).
   */
  frameworkState: CsvFrameworkState | null;
  /**
   * Framework preview data for the auto-creation flow. Present when
   * frameworkState is not "ok" and the CSV carries dimension_code cells.
   * Null when all dimensions are already configured (frameworkState === "ok")
   * or when the CSV could not be parsed.
   */
  frameworkPreview: CsvFrameworkPreviewDto | null;
}

export interface CsvImportResultDto {
  assessmentId: string;
  assessmentName: string;
  assessmentSlug: string;
  importedCount: number;
  scope: CsvScope;
  createdAssessment: boolean;
}

// ── Safe RFC4180 parser ───────────────────────────────────────────────────────

/**
 * Parse CSV text into logical records. Handles quoted fields, embedded
 * commas/newlines, doubled quotes, a leading BOM, and CRLF/LF/CR endings.
 * Enforces row and cell-length limits. Never evaluates content.
 */
export function parseCsv(rawText: string): string[][] {
  let text = rawText;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    if (field.length > MAX_CSV_CELL_LENGTH) {
      throw new CsvParseError(`A cell exceeds the ${MAX_CSV_CELL_LENGTH}-character limit.`);
    }
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    if (rows.length > MAX_CSV_ROWS) {
      throw new CsvParseError(`The file exceeds the ${MAX_CSV_ROWS}-row limit.`);
    }
  };

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      index += 1;
      continue;
    }
    if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      pushRow();
      index += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (inQuotes) throw new CsvParseError("The file contains an unterminated quoted field.");
  // Flush the final record (files rarely end with a newline).
  if (field.length > 0 || row.length > 0) pushRow();

  return rows;
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

type Record = { rowNumber: number; cells: Map<string, string> };

function normalizeHeader(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function cell(record: Record, name: string): string {
  return record.cells.get(name) ?? "";
}

function isBlank(value: string): boolean {
  return value.trim() === "";
}

function parseBoolean(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return fallback;
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

/** Parse an integer cell. Returns null when blank, NaN when malformed. */
function parseIntegerCell(value: string): number | null {
  if (isBlank(value)) return null;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

/** Parse a numeric cell (int or decimal). Returns null when blank, NaN when malformed. */
function parseNumberCell(value: string): number | null {
  if (isBlank(value)) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

// ── Row → QuestionInput transform ─────────────────────────────────────────────

interface OptionCell {
  text: string;
  score: string;
  explanation: string;
}

function readOptions(record: Record): OptionCell[] {
  const options: OptionCell[] = [];
  for (let index = 1; index <= MAX_OPTION_COLUMNS; index += 1) {
    const text = cell(record, `option_${index}_text`);
    const score = cell(record, `option_${index}_score`);
    const explanation = cell(record, `option_${index}_explanation`);
    if (isBlank(text) && isBlank(score) && isBlank(explanation)) continue;
    options.push({ text: text.trim(), score, explanation: explanation.trim() });
  }
  return options;
}

function normalizeStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "inactive") return "Inactive";
  return "Active";
}

function normalizeNumericMode(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "twovaluederived" || normalized === "twovalue" || normalized === "derived" || normalized === "percentage") {
    return "twoValueDerived";
  }
  return "calendarYearExperience";
}

/**
 * Build the raw QuestionInput candidate for one row, then run it through the
 * SAME `validateQuestionInput` used by manual creation. Returns the sanitized
 * input plus any row-prefixed errors (empty when valid).
 */
function transformRow(record: Record): { input: QuestionInput | null; errors: string[]; type: string; optionCount: number; qWeight: number | null; maxScoreCell: number | null } {
  const prefix = `Row ${record.rowNumber}`;
  const errors: string[] = [];

  const typeRaw = cell(record, "question_type").trim();
  const type = typeRaw.toUpperCase();
  const reference = cell(record, "question_code").trim();
  const prompt = cell(record, "question_text").trim();
  const helpText = cell(record, "help_text").trim();
  const dimensionCode = isBlank(cell(record, "dimension_code")) ? null : cell(record, "dimension_code").trim().toUpperCase();
  const status = normalizeStatus(cell(record, "status"));
  const required = parseBoolean(cell(record, "required"), true);
  const timeLimitSec = parseIntegerCell(cell(record, "time_limit_sec"));
  const qWeightCell = parseIntegerCell(cell(record, "q_weight"));
  const maxScoreCell = parseIntegerCell(cell(record, "max_score"));
  const options = readOptions(record);

  if (timeLimitSec !== null && (Number.isNaN(timeLimitSec) || timeLimitSec <= 0)) errors.push(`${prefix}: time_limit_sec must be a positive number of seconds.`);

  if (!typeRaw) errors.push(`${prefix}: Missing question type.`);
  else if (!(QUESTION_TYPES as readonly string[]).includes(type)) errors.push(`${prefix}: Unsupported question type "${typeRaw}".`);
  else if (type === "GATE") errors.push(`${prefix}: GATE questions are configured under the role's Eligibility settings, not CSV import.`);
  else if (!(CSV_QUESTION_TYPES as readonly string[]).includes(type)) errors.push(`${prefix}: Unsupported question type "${typeRaw}".`);

  if (!reference) errors.push(`${prefix}: Missing question code.`);
  else if (reference.length > QUESTION_REFERENCE_MAX_LENGTH) errors.push(`${prefix}: Question code is longer than ${QUESTION_REFERENCE_MAX_LENGTH} characters.`);
  if (!prompt) errors.push(`${prefix}: Missing question text.`);

  // Scored types use the fixed 5-point scale the engine normalizes against.
  const scored = isScoredQuestionType(type as QuestionType);
  if (scored && maxScoreCell !== null && maxScoreCell !== SCORED_QUESTION_MAX) {
    errors.push(`${prefix}: max_score must be ${SCORED_QUESTION_MAX} (the engine uses a fixed ${SCORED_QUESTION_MAX}-point scale) or left blank.`);
  }

  if (errors.length) {
    return { input: null, errors, type, optionCount: options.length, qWeight: Number.isInteger(qWeightCell) ? qWeightCell : null, maxScoreCell };
  }

  const base = {
    reference,
    dimensionReference: dimensionCode,
    required,
    prompt,
    helpText,
    status,
    timeLimitSec,
  };

  let candidate: unknown;
  switch (type) {
    case "ORDINAL": {
      candidate = {
        ...base,
        type: "ORDINAL",
        qWeight: qWeightCell,
        options: options.map((option) => ({ text: option.text, rawScore: parseIntegerCell(option.score) })),
      };
      break;
    }
    case "MULTI": {
      const scoreCap = maxScoreCell !== null && Number.isInteger(maxScoreCell) ? maxScoreCell : MULTI_DEFAULT_SCORE_CAP;
      candidate = {
        ...base,
        type: "MULTI",
        qWeight: qWeightCell,
        scoreCap,
        // A −1 option is a decoy: MULTI scorable options are 0…5, so −1 is
        // only valid as a decoy (validateQuestionInput enforces decoy === −1).
        options: options.map((option) => {
          const score = parseNumberCell(option.score);
          return { text: option.text, rawScore: score, isDecoy: score === -1 };
        }),
      };
      break;
    }
    case "SJT": {
      candidate = {
        ...base,
        type: "SJT",
        qWeight: qWeightCell,
        options: options.map((option) => ({ text: option.text, rawScore: parseIntegerCell(option.score), internalExplanation: option.explanation })),
      };
      break;
    }
    case "NUMERIC": {
      const mode = normalizeNumericMode(cell(record, "numeric_mode"));
      const calculationType = cell(record, "calculation_type").trim();
      const inputDefinitions: Array<{ label: string; unit: string }> = [];
      for (let index = 1; index <= 2; index += 1) {
        const label = cell(record, `input_${index}_label`).trim();
        const key = cell(record, `input_${index}_key`).trim();
        const unit = cell(record, `input_${index}_unit`).trim();
        const resolvedLabel = label || key;
        if (resolvedLabel) inputDefinitions.push({ label: resolvedLabel, unit });
      }
      const bands: Array<{ lowerBound: number; upperBound: number | null; rawScore: number }> = [];
      for (let index = 1; index <= MAX_NUMERIC_BANDS; index += 1) {
        const min = parseNumberCell(cell(record, `band_${index}_min`));
        const max = parseNumberCell(cell(record, `band_${index}_max`));
        const score = parseIntegerCell(cell(record, `band_${index}_score`));
        if (min === null && max === null && score === null) continue;
        bands.push({ lowerBound: min as number, upperBound: max === null ? null : (max as number), rawScore: score as number });
      }
      candidate = {
        ...base,
        type: "NUMERIC",
        qWeight: qWeightCell,
        numericConfig: {
          mode,
          inputDefinitions,
          ...(calculationType ? { derivedCalculationType: calculationType } : {}),
          bands,
        },
      };
      break;
    }
    case "OPEN": {
      const rubric: Array<{ scoreMin: number; scoreMax: number; anchorText: string }> = [];
      (["low", "mid", "high"] as const).forEach((band) => {
        const min = parseIntegerCell(cell(record, `rubric_${band}_min`));
        const max = parseIntegerCell(cell(record, `rubric_${band}_max`));
        const anchor = cell(record, `rubric_${band}_anchor`).trim();
        if (min === null && max === null && !anchor) return;
        rubric.push({ scoreMin: min as number, scoreMax: max === null ? (min as number) : (max as number), anchorText: anchor });
      });
      const minimumWords = parseIntegerCell(cell(record, "open_min_words"));
      const maximumWords = parseIntegerCell(cell(record, "open_max_words"));
      candidate = {
        ...base,
        type: "OPEN",
        qWeight: qWeightCell,
        openConfig: {
          minimumWords,
          maximumWords,
          timeLimitSec,
          pasteAllowed: parseBoolean(cell(record, "open_paste_allowed"), false),
          rubric,
        },
      };
      break;
    }
    case "EVIDENCE": {
      const claimedQuestionReference = cell(record, "claimed_question_reference").trim();
      candidate = {
        ...base,
        type: "EVIDENCE",
        // The weight cell is passed through rather than dropped, so an EVIDENCE
        // row carrying a q_weight is rejected with the same message the manual
        // Question Bank form uses instead of being silently ignored. The shared
        // validator never echoes qWeight back for unweighted types.
        qWeight: qWeightCell,
        claimedQuestionReference,
        // For EVIDENCE the option "score" column carries the verification
        // multiplier (1.00 / 0.95 / 0.85), matching the existing structure.
        options: options.map((option) => ({ text: option.text, verificationMultiplier: parseNumberCell(option.score) })),
      };
      break;
    }
    default:
      candidate = null;
  }

  const validated = validateQuestionInput(candidate);
  if ("errors" in validated) {
    return {
      input: null,
      errors: validated.errors.map((message) => `${prefix}: ${message}`),
      type,
      optionCount: options.length,
      qWeight: Number.isInteger(qWeightCell) ? qWeightCell : null,
      maxScoreCell,
    };
  }

  return {
    input: validated.input,
    errors: [],
    type,
    optionCount: options.length,
    qWeight: "qWeight" in validated.input ? (validated.input.qWeight as number) : null,
    maxScoreCell,
  };
}

// ── Parse + validate (pure) ───────────────────────────────────────────────────

/**
 * Parse and type-validate a CSV file without any database access. Detects
 * structural problems, missing columns, per-row type errors, duplicate
 * question codes and duplicate display orders. The server layer adds
 * role-scoped dimension and reference-conflict checks on top of this.
 */
export function parseAndValidateCsv(text: string): CsvParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return { detected: 0, rows: [], errors: ["The uploaded file is empty."], frameworkDimensions: [] };
  }
  if (text.length > MAX_CSV_BYTES) {
    return { detected: 0, rows: [], errors: [`The file exceeds the ${MAX_CSV_BYTES}-byte size limit.`], frameworkDimensions: [] };
  }

  let rawRows: string[][];
  try {
    rawRows = parseCsv(text);
  } catch (error) {
    return { detected: 0, rows: [], errors: [error instanceof CsvParseError ? error.message : "The file could not be parsed as CSV."], frameworkDimensions: [] };
  }

  if (rawRows.length === 0) return { detected: 0, rows: [], errors: ["The uploaded file is empty."], frameworkDimensions: [] };

  const header = rawRows[0].map(normalizeHeader);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    return { detected: 0, rows: [], errors: [`The CSV is missing required column${missingColumns.length > 1 ? "s" : ""}: ${missingColumns.join(", ")}.`], frameworkDimensions: [] };
  }

  const columnIndex = new Map<string, number>();
  header.forEach((name, position) => {
    if (!columnIndex.has(name)) columnIndex.set(name, position);
  });

  const rows: CsvParsedRow[] = [];
  const seenCodes = new Map<string, number>();
  const seenOrders = new Map<number, number>();
  const fileErrors: string[] = [];

  for (let position = 1; position < rawRows.length; position += 1) {
    const rawCells = rawRows[position];
    const rowNumber = position + 1; // header is row 1
    const isRowEmpty = rawCells.every((value) => value.trim() === "");
    if (isRowEmpty) continue;

    if (rawCells.length > header.length) {
      fileErrors.push(`Row ${rowNumber} has more columns than the header.`);
    }

    const cells = new Map<string, string>();
    columnIndex.forEach((sourceIndex, name) => {
      cells.set(name, (rawCells[sourceIndex] ?? "").toString());
    });
    const record: Record = { rowNumber, cells };

    const transformed = transformRow(record);

    const code = cell(record, "question_code").trim();
    if (code) {
      const previous = seenCodes.get(code.toLowerCase());
      if (previous !== undefined) transformed.errors.push(`Row ${rowNumber}: Duplicate question code "${code}" (also on row ${previous}).`);
      else seenCodes.set(code.toLowerCase(), rowNumber);
    }

    const orderCell = parseIntegerCell(cell(record, "display_order"));
    let order: number | null = null;
    if (orderCell === null) {
      order = rows.length + 1;
    } else if (Number.isInteger(orderCell) && orderCell > 0) {
      order = orderCell;
      const previous = seenOrders.get(orderCell);
      if (previous !== undefined) transformed.errors.push(`Row ${rowNumber}: Duplicate display_order ${orderCell} (also on row ${previous}).`);
      else seenOrders.set(orderCell, rowNumber);
    } else {
      transformed.errors.push(`Row ${rowNumber}: display_order must be a positive whole number.`);
      order = rows.length + 1;
    }

    rows.push({
      rowNumber,
      order,
      code,
      question: cell(record, "question_text").trim(),
      type: cell(record, "question_type").trim().toUpperCase(),
      dimension: cell(record, "dimension_code").trim().toUpperCase(),
      qWeight: transformed.qWeight,
      maxScore: isScoredQuestionType(transformed.type as QuestionType) ? SCORED_QUESTION_MAX : null,
      optionCount: transformed.optionCount,
      status: normalizeStatus(cell(record, "status")),
      input: transformed.input,
      dimensionCode: isBlank(cell(record, "dimension_code")) ? null : cell(record, "dimension_code").trim().toUpperCase(),
      errors: transformed.errors,
    });
  }

  if (rows.length === 0 && fileErrors.length === 0) {
    fileErrors.push("No question rows were found in the file.");
  }
  if (rows.length > MAX_CSV_QUESTIONS) {
    fileErrors.push(`The file contains ${rows.length} questions, exceeding the ${MAX_CSV_QUESTIONS}-question limit.`);
  }

  // Extract framework dimension metadata from the new dimension_name/weight/floor
  // columns. This is pure and never touches the database; the server layer
  // compares the result against the role's live dimensions.
  const frameworkDimensions = extractCsvFrameworkDimensions(rawRows, header);

  return { detected: rows.length, rows, errors: fileErrors, frameworkDimensions };
}

// ── Template generation (task #2, #22) ────────────────────────────────────────

function escapeCsvField(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsvRow(values: Array<string | number | null>): string {
  return values.map(escapeCsvField).join(",");
}

/**
 * Build a row object keyed by column name, then serialize in CSV_COLUMNS order
 * so every example line has the full, consistent header width.
 */
function exampleRow(values: Partial<globalThis.Record<string, string | number>>): string {
  return toCsvRow(CSV_COLUMNS.map((column) => (values[column] !== undefined ? values[column] : "")));
}

/** One worked example per supported question type. */
function templateExampleRows(): string[] {
  return [
    // ORDINAL — scores through the existing ORDINAL scorer.
    exampleRow({
      question_code: "EXAMPLE.D1.Q1",
      question_text: "Which best describes your business development experience?",
      question_type: "ORDINAL",
      dimension_code: "D1",
      dimension_name: "Commercial Track Record",
      dimension_weight: 30,
      dimension_floor: 50,
      display_order: 1,
      q_weight: 3,
      max_score: 5,
      required: "TRUE",
      help_text: "Select one",
      status: "Active",
      option_1_text: "Business development has been the core of my career",
      option_1_score: 5,
      option_2_text: "I have substantial direct business development experience",
      option_2_score: 4,
      option_3_text: "I have some business development exposure",
      option_3_score: 2,
      option_4_text: "I have limited direct experience",
      option_4_score: 0,
    }),
    // MULTI — option scores are summed by the existing MULTI scorer and capped
    // at max_score. A −1 option is treated as a decoy.
    exampleRow({
      question_code: "EXAMPLE.D3.Q1",
      question_text: "Select every outbound channel you have personally run.",
      question_type: "MULTI",
      dimension_code: "D3",
      dimension_name: "Sales & Channel Execution",
      dimension_weight: 20,
      dimension_floor: "",
      display_order: 2,
      q_weight: 2,
      max_score: 5,
      required: "TRUE",
      status: "Active",
      option_1_text: "Cold email sequences",
      option_1_score: 3,
      option_2_text: "LinkedIn outreach",
      option_2_score: 3,
      option_3_text: "Partner referrals",
      option_3_score: 2,
      option_4_text: "I have not run outbound channels",
      option_4_score: -1,
    }),
    // NUMERIC — configuration-driven; the label is the field the applicant
    // answers and the value the existing numeric scorer keys on.
    exampleRow({
      question_code: "EXAMPLE.D2.Q1",
      question_text: "In which year did you first work in a revenue role?",
      question_type: "NUMERIC",
      dimension_code: "D2",
      dimension_name: "Revenue Experience",
      dimension_weight: 25,
      dimension_floor: 50,
      display_order: 3,
      q_weight: 2,
      max_score: 5,
      required: "TRUE",
      status: "Active",
      numeric_mode: "calendarYearExperience",
      input_1_label: "Calendar year",
      input_1_unit: "year",
      band_1_min: 0,
      band_1_max: 2,
      band_1_score: 2,
      band_2_min: 3,
      band_2_max: 5,
      band_2_score: 4,
      band_3_min: 6,
      band_3_score: 5,
    }),
    // SJT — exactly four options, each with an internal explanation. Scores may
    // be negative (e.g. −2) exactly as the existing engine permits.
    exampleRow({
      question_code: "EXAMPLE.D5.Q1",
      question_text: "A key prospect goes quiet mid-negotiation. What do you do first?",
      question_type: "SJT",
      dimension_code: "D5",
      dimension_name: "Judgement & Resilience",
      dimension_weight: 15,
      dimension_floor: "",
      display_order: 4,
      q_weight: 3,
      max_score: 5,
      required: "TRUE",
      status: "Active",
      option_1_text: "Diagnose the stall reason with a targeted follow-up",
      option_1_score: 5,
      option_1_explanation: "Shows commercial judgement and initiative",
      option_2_text: "Offer a discount to revive interest",
      option_2_score: 1,
      option_2_explanation: "Reactive; erodes margin",
      option_3_text: "Escalate to the sales director immediately",
      option_3_score: 2,
      option_3_explanation: "Reasonable but premature",
      option_4_text: "Wait for the prospect to respond",
      option_4_score: -2,
      option_4_explanation: "Passive; loses momentum",
    }),
    // OPEN — manual Admin rubric review only (no automated scoring).
    exampleRow({
      question_code: "EXAMPLE.D6.Q1",
      question_text: "Describe a deal you closed and your specific contribution.",
      question_type: "OPEN",
      dimension_code: "D6",
      dimension_name: "Communication & Narrative",
      dimension_weight: 10,
      dimension_floor: "",
      display_order: 5,
      q_weight: 3,
      max_score: 5,
      required: "TRUE",
      status: "Active",
      open_min_words: 40,
      open_max_words: 250,
      rubric_low_min: 0,
      rubric_low_max: 1,
      rubric_low_anchor: "Weak, incomplete or off-brief response",
      rubric_mid_min: 2,
      rubric_mid_max: 3,
      rubric_mid_anchor: "Adequate but generic response",
      rubric_high_min: 4,
      rubric_high_max: 5,
      rubric_high_anchor: "Strong, specific and commercially credible response",
    }),
    // EVIDENCE — the option "score" is the verification multiplier (1.00/0.95/0.85).
    // claimed_question_reference points at the question this evidence verifies.
    exampleRow({
      question_code: "EXAMPLE.D2.Q1E",
      question_text: "How was your revenue achievement verified?",
      question_type: "EVIDENCE",
      dimension_code: "D2",
      dimension_name: "Revenue Experience",
      dimension_weight: 25,
      dimension_floor: 50,
      display_order: 6,
      required: "TRUE",
      status: "Active",
      claimed_question_reference: "EXAMPLE.D2.Q1",
      option_1_text: "Confirmed by employer reference",
      option_1_score: 1,
      option_2_text: "Supported by documents",
      option_2_score: 0.95,
      option_3_text: "Self-reported only",
      option_3_score: 0.85,
    }),
  ];
}

/** The downloadable CSV template: full header plus one example row per type. */
export function buildCsvTemplate(): string {
  const lines = [toCsvRow(CSV_COLUMNS), ...templateExampleRows()];
  return `${lines.join("\r\n")}\r\n`;
}

/** Plain-language instructions shown next to the download button (task #22). */
export function csvTemplateInstructions(): string[] {
  return [
    "Use the template to configure questions, options, scores and assessment order. Upload the completed file to validate and preview the questions before import.",
    "Delete or replace the EXAMPLE rows before importing — question codes must be unique and dimensions must already exist in this role's Evaluation Framework.",
    "dimension_name, dimension_weight and dimension_floor are optional when the role's Evaluation Framework already exists. When the framework is missing, the importer can generate it from these columns automatically — leave dimension_floor blank for no floor.",
    "Dimension information repeats across rows when multiple questions share the same dimension_code. Every row for the same dimension_code must carry identical dimension_name, dimension_weight and dimension_floor values.",
    "question_type must be one of: ORDINAL, MULTI, NUMERIC, SJT, OPEN, EVIDENCE. GATE questions stay under the role's Eligibility configuration.",
    "Scored questions use a fixed 5-point scale: set max_score to 5 (or leave it blank). q_weight must be 1, 2 or 3.",
    "Options use option_1_text … option_10_text with matching option_N_score. SJT also needs option_N_explanation and exactly four options.",
    "MULTI: a −1 option score marks a decoy. NUMERIC: fill numeric_mode, input_N_label and band_N_min/max/score. OPEN: fill the rubric_low/mid/high columns.",
    "EVIDENCE: put the verification multiplier (1.00, 0.95 or 0.85) in option_N_score and set claimed_question_reference to the question it verifies.",
    "All rows must be valid before Confirm Import is enabled. A maximum of 100 questions can be imported per file.",
  ];
}
