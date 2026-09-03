/**
 * CSV Assessment Question Import — pure contract tests (no database).
 *
 * These cover the safe RFC4180 parser, the row → QuestionInput transform for
 * every supported type, structural and per-row validation, the CSV limits, the
 * downloadable template, and — critically — that a CSV row produces the SAME
 * sanitized QuestionInput as manual creation (task #26 equivalence). The scoring
 * engine is never imported here; equivalence is proven at the configuration
 * boundary so imported questions are indistinguishable from manual ones.
 */
import { describe, expect, it } from "vitest";
import {
  buildCsvTemplate,
  buildFrameworkPreview,
  CORE_COLUMNS,
  CSV_COLUMNS,
  csvTemplateInstructions,
  CsvParseError,
  extractCsvFrameworkDimensions,
  MAX_CSV_CELL_LENGTH,
  MAX_CSV_QUESTIONS,
  MAX_CSV_ROWS,
  MAX_OPTION_COLUMNS,
  parseAndValidateCsv,
  parseCsv,
  REQUIRED_COLUMNS,
  type CsvFrameworkDimensionRow,
} from "./csvImport";
import { validateQuestionInput } from "./questionBankApi";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function escapeField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize row objects in CSV_COLUMNS order (or a custom header). */
function buildCsv(rows: Array<globalThis.Record<string, string | number>>, columns: string[] = CSV_COLUMNS): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escapeField(row[column] ?? "")).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}

const ordinalRow: globalThis.Record<string, string | number> = {
  question_code: "D1.Q1",
  question_text: "Which best describes your experience?",
  question_type: "ORDINAL",
  dimension_code: "D1",
  display_order: 1,
  q_weight: 3,
  max_score: 5,
  required: "TRUE",
  status: "Active",
  option_1_text: "Core of my career",
  option_1_score: 5,
  option_2_text: "Substantial experience",
  option_2_score: 4,
  option_3_text: "Some exposure",
  option_3_score: 2,
  option_4_text: "Limited experience",
  option_4_score: 0,
};

// ── parseCsv: safe RFC4180 ────────────────────────────────────────────────────

describe("parseCsv (safe RFC4180 reader)", () => {
  it("reads simple rows and strips a leading BOM", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("\uFEFFa,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with embedded commas, newlines and doubled quotes", () => {
    expect(parseCsv('"x,y","line\nbreak","say ""hi"""')).toEqual([["x,y", "line\nbreak", 'say "hi"']]);
  });

  it("accepts CRLF, LF and CR line endings and flushes a final record without a newline", () => {
    expect(parseCsv("a\r\nb\nc\rd")).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("throws a CsvParseError on an unterminated quoted field", () => {
    expect(() => parseCsv('"never closed')).toThrow(CsvParseError);
  });

  it("throws a CsvParseError when a cell exceeds the length limit", () => {
    const huge = "a".repeat(MAX_CSV_CELL_LENGTH + 1);
    expect(() => parseCsv(huge)).toThrow(CsvParseError);
  });

  it("throws a CsvParseError when the row limit is exceeded", () => {
    const many = Array.from({ length: MAX_CSV_ROWS + 1 }, () => "x").join("\n");
    expect(() => parseCsv(many)).toThrow(CsvParseError);
  });

  it("never evaluates formula-like content — it is returned verbatim as text", () => {
    expect(parseCsv("=1+1,@cmd,+risk")).toEqual([["=1+1", "@cmd", "+risk"]]);
  });
});

// ── parseAndValidateCsv: file-level structure ─────────────────────────────────

describe("parseAndValidateCsv (file-level)", () => {
  it("flags an empty or whitespace-only file", () => {
    expect(parseAndValidateCsv("").errors).toEqual(["The uploaded file is empty."]);
    expect(parseAndValidateCsv("   \n  ").errors).toEqual(["The uploaded file is empty."]);
  });

  it("flags a file that exceeds the byte limit before parsing", () => {
    const oversized = "a".repeat(1_000_001);
    expect(parseAndValidateCsv(oversized).errors[0]).toContain("size limit");
  });

  it("names the missing required columns", () => {
    const result = parseAndValidateCsv(buildCsv([{ question_code: "X" }], ["question_code", "question_text"]));
    expect(result.detected).toBe(0);
    expect(result.errors[0]).toContain("question_type");
  });

  it("reports when only a header is present", () => {
    const result = parseAndValidateCsv(buildCsv([], ["question_code", "question_text", "question_type"]));
    expect(result.detected).toBe(0);
    expect(result.errors).toContain("No question rows were found in the file.");
  });

  it("enforces the maximum question count", () => {
    const rows = Array.from({ length: MAX_CSV_QUESTIONS + 1 }, (_, index) => ({
      question_code: `Q${index}`,
      question_text: "Prompt",
      question_type: "ORDINAL",
    }));
    const result = parseAndValidateCsv(buildCsv(rows, ["question_code", "question_text", "question_type"]));
    expect(result.detected).toBe(MAX_CSV_QUESTIONS + 1);
    expect(result.errors.some((message) => message.includes(`${MAX_CSV_QUESTIONS}-question limit`))).toBe(true);
  });

  it("is case-insensitive for header names and question type", () => {
    const result = parseAndValidateCsv(
      buildCsv([{ Question_Code: "D1.Q1", question_text: "Prompt", QUESTION_TYPE: "ordinal" }], ["Question_Code", "question_text", "QUESTION_TYPE"]),
    );
    expect(result.detected).toBe(1);
    expect(result.rows[0].type).toBe("ORDINAL");
  });
});

// ── parseAndValidateCsv: per-type transform (valid rows) ──────────────────────

describe("parseAndValidateCsv (valid rows per type)", () => {
  it("transforms an ORDINAL row into scored options", () => {
    const result = parseAndValidateCsv(buildCsv([ordinalRow]));
    expect(result.errors).toEqual([]);
    const row = result.rows[0];
    expect(row.errors).toEqual([]);
    expect(row.order).toBe(1);
    expect(row.maxScore).toBe(5);
    if (row.input?.type === "ORDINAL") {
      expect(row.input.qWeight).toBe(3);
      expect(row.input.options.map((option) => option.rawScore)).toEqual([5, 4, 2, 0]);
    } else {
      throw new Error("expected an ORDINAL input");
    }
  });

  it("treats a −1 MULTI option as a decoy and applies the score cap", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        {
          question_code: "D3.Q1", question_text: "Channels?", question_type: "MULTI", dimension_code: "D3",
          q_weight: 2, max_score: 5, option_1_text: "Email", option_1_score: 3, option_2_text: "Referral", option_2_score: 2, option_3_text: "None", option_3_score: -1,
        },
      ]),
    );
    const input = result.rows[0].input;
    if (input?.type === "MULTI") {
      expect(input.scoreCap).toBe(5);
      expect(input.options.map((option) => option.isDecoy)).toEqual([false, false, true]);
    } else {
      throw new Error("expected a MULTI input");
    }
  });

  it("requires exactly four SJT options and permits negative scores", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        {
          question_code: "D5.Q1", question_text: "Prospect goes quiet", question_type: "SJT", dimension_code: "D5", q_weight: 3, max_score: 5,
          option_1_text: "Diagnose", option_1_score: 5, option_1_explanation: "Strong",
          option_2_text: "Escalate", option_2_score: 2, option_2_explanation: "Premature",
          option_3_text: "Discount", option_3_score: 1, option_3_explanation: "Reactive",
          option_4_text: "Wait", option_4_score: -2, option_4_explanation: "Passive",
        },
      ]),
    );
    const input = result.rows[0].input;
    if (input?.type === "SJT") {
      expect(input.options).toHaveLength(4);
      expect(input.options[3].rawScore).toBe(-2);
      expect(input.options[0].internalExplanation).toBe("Strong");
    } else {
      throw new Error("expected an SJT input");
    }
  });

  it("builds NUMERIC bands and input definitions from the config columns", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        {
          question_code: "D2.Q1", question_text: "Year you started?", question_type: "NUMERIC", dimension_code: "D2", q_weight: 2, max_score: 5,
          numeric_mode: "calendarYearExperience", input_1_label: "Calendar year", input_1_unit: "year",
          band_1_min: 0, band_1_max: 2, band_1_score: 2, band_2_min: 3, band_2_score: 5,
        },
      ]),
    );
    const input = result.rows[0].input;
    if (input?.type === "NUMERIC") {
      expect(input.numericConfig.bands).toEqual([
        { lowerBound: 0, upperBound: 2, rawScore: 2 },
        { lowerBound: 3, upperBound: null, rawScore: 5 },
      ]);
      expect(input.numericConfig.inputDefinitions[0]).toEqual({ label: "Calendar year", unit: "year" });
    } else {
      throw new Error("expected a NUMERIC input");
    }
  });

  it("builds an OPEN rubric for manual review (no automated scoring)", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        {
          question_code: "D6.Q1", question_text: "Describe a deal", question_type: "OPEN", dimension_code: "D6", q_weight: 3, max_score: 5,
          open_min_words: 20, open_max_words: 200,
          rubric_low_min: 0, rubric_low_max: 1, rubric_low_anchor: "Weak", rubric_high_min: 4, rubric_high_max: 5, rubric_high_anchor: "Strong",
        },
      ]),
    );
    const input = result.rows[0].input;
    if (input?.type === "OPEN") {
      expect(input.openConfig.rubric).toEqual([
        { scoreMin: 0, scoreMax: 1, anchorText: "Weak" },
        { scoreMin: 4, scoreMax: 5, anchorText: "Strong" },
      ]);
    } else {
      throw new Error("expected an OPEN input");
    }
  });

  it("reads the EVIDENCE verification multiplier and claimed reference", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        {
          question_code: "D2.Q1E", question_text: "How verified?", question_type: "EVIDENCE", dimension_code: "D2",
          claimed_question_reference: "D2.Q1", option_1_text: "Employer", option_1_score: 1, option_2_text: "Documents", option_2_score: 0.95,
        },
      ]),
    );
    const row = result.rows[0];
    expect(row.maxScore).toBeNull(); // EVIDENCE is not a scored type
    const input = row.input;
    if (input?.type === "EVIDENCE") {
      expect(input.claimedQuestionReference).toBe("D2.Q1");
      expect(input.options.map((option) => option.verificationMultiplier)).toEqual([1, 0.95]);
    } else {
      throw new Error("expected an EVIDENCE input");
    }
  });
});

// ── parseAndValidateCsv: per-row errors ───────────────────────────────────────

describe("parseAndValidateCsv (row errors)", () => {
  const firstError = (rows: Array<globalThis.Record<string, string | number>>) => parseAndValidateCsv(buildCsv(rows)).rows[0].errors;

  it("rejects GATE rows — eligibility stays under the role settings", () => {
    expect(firstError([{ question_code: "G1", question_text: "Gate?", question_type: "GATE" }])[0]).toContain(
      "GATE questions are configured under the role's Eligibility settings",
    );
  });

  it("rejects an unsupported question type", () => {
    expect(firstError([{ question_code: "X", question_text: "Prompt", question_type: "RATING" }])[0]).toContain('Unsupported question type "RATING"');
  });

  it("requires a question code and question text", () => {
    expect(firstError([{ question_text: "Prompt", question_type: "ORDINAL" }]).some((e) => e.includes("Missing question code"))).toBe(true);
    expect(firstError([{ question_code: "X", question_type: "ORDINAL" }]).some((e) => e.includes("Missing question text"))).toBe(true);
  });

  it("enforces the fixed 5-point maximum for scored types", () => {
    expect(firstError([{ ...ordinalRow, max_score: 10 }]).some((e) => e.includes("max_score must be 5"))).toBe(true);
  });

  it("surfaces validateQuestionInput errors with a row prefix", () => {
    const errors = firstError([{ ...ordinalRow, q_weight: 4 }]);
    expect(errors.some((e) => e.startsWith("Row 2:") && e.includes("Question weight must be 1, 2 or 3"))).toBe(true);
    const optionErrors = firstError([{ ...ordinalRow, option_1_score: 7 }]);
    expect(optionErrors.some((e) => e.includes("must score between 0 and 5 points"))).toBe(true);
  });

  it("detects duplicate question codes and duplicate display orders", () => {
    const duplicateCode = parseAndValidateCsv(buildCsv([ordinalRow, { ...ordinalRow, display_order: 2 }]));
    expect(duplicateCode.rows[1].errors.some((e) => e.includes('Duplicate question code "D1.Q1"'))).toBe(true);

    const duplicateOrder = parseAndValidateCsv(buildCsv([ordinalRow, { ...ordinalRow, question_code: "D1.Q2" }]));
    expect(duplicateOrder.rows[1].errors.some((e) => e.includes("Duplicate display_order 1"))).toBe(true);
  });

  it("rejects a non-positive or malformed display_order", () => {
    expect(firstError([{ ...ordinalRow, display_order: 0 }]).some((e) => e.includes("display_order must be a positive whole number"))).toBe(true);
  });

  it("assigns a sequential order when display_order is blank", () => {
    const result = parseAndValidateCsv(
      buildCsv([
        { ...ordinalRow, display_order: "" },
        { ...ordinalRow, question_code: "D1.Q2", display_order: "" },
      ]),
    );
    expect(result.rows.map((row) => row.order)).toEqual([1, 2]);
  });
});

// ── Manual ↔ CSV equivalence (task #26) ───────────────────────────────────────

describe("manual ↔ CSV equivalence", () => {
  it("produces the identical sanitized QuestionInput as manual creation (ORDINAL)", () => {
    const fromCsv = parseAndValidateCsv(buildCsv([ordinalRow])).rows[0].input;
    const manual = validateQuestionInput({
      reference: "D1.Q1", dimensionReference: "D1", required: true, prompt: "Which best describes your experience?", helpText: "",
      status: "Active", timeLimitSec: null, type: "ORDINAL", qWeight: 3,
      options: [
        { text: "Core of my career", rawScore: 5 },
        { text: "Substantial experience", rawScore: 4 },
        { text: "Some exposure", rawScore: 2 },
        { text: "Limited experience", rawScore: 0 },
      ],
    });
    expect("input" in manual).toBe(true);
    if ("input" in manual) expect(fromCsv).toEqual(manual.input);
  });
});

// ── Template + column schema (task #2, #22) ───────────────────────────────────

describe("CSV template and column schema", () => {
  it("exposes the full ordered column schema with the core columns first", () => {
    expect(CSV_COLUMNS.slice(0, CORE_COLUMNS.length)).toEqual([...CORE_COLUMNS]);
    expect(CSV_COLUMNS).toContain(`option_${MAX_OPTION_COLUMNS}_text`);
    expect(CSV_COLUMNS).toContain("band_5_score");
    expect(CSV_COLUMNS).toContain("rubric_high_anchor");
    expect(new Set(CSV_COLUMNS).size).toBe(CSV_COLUMNS.length);
    expect(REQUIRED_COLUMNS.every((column) => CSV_COLUMNS.includes(column))).toBe(true);
    // New framework columns must be present in CORE_COLUMNS and therefore CSV_COLUMNS.
    expect(CORE_COLUMNS).toContain("dimension_name");
    expect(CORE_COLUMNS).toContain("dimension_weight");
    expect(CORE_COLUMNS).toContain("dimension_floor");
  });

  it("ships a template whose header matches CSV_COLUMNS and whose examples all validate", () => {
    const template = buildCsvTemplate();
    expect(template.split("\r\n")[0]).toBe(CSV_COLUMNS.join(","));

    const result = parseAndValidateCsv(template);
    expect(result.errors).toEqual([]);
    expect(result.detected).toBe(6);
    expect(result.rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(result.rows.map((row) => row.type).sort()).toEqual(["EVIDENCE", "MULTI", "NUMERIC", "OPEN", "ORDINAL", "SJT"]);

    // The template now includes dimension framework columns in every example row.
    expect(CSV_COLUMNS).toContain("dimension_name");
    expect(CSV_COLUMNS).toContain("dimension_weight");
    expect(CSV_COLUMNS).toContain("dimension_floor");
    // Framework dimensions are extracted from the examples.
    expect(result.frameworkDimensions.length).toBeGreaterThan(0);
    expect(result.frameworkDimensions.every((d) => d.consistent)).toBe(true);
  });

  it("provides plain-language instructions for the download UX", () => {
    const instructions = csvTemplateInstructions();
    expect(instructions.length).toBeGreaterThanOrEqual(6);
    expect(instructions.every((line) => line.trim().length > 0)).toBe(true);
  });
});

// ── extractCsvFrameworkDimensions ─────────────────────────────────────────────

describe("extractCsvFrameworkDimensions", () => {
  function makeRows(header: string[], dataRows: string[][]): string[][] {
    return [header, ...dataRows];
  }
  const HDR = ["question_code", "question_type", "dimension_code", "dimension_name", "dimension_weight", "dimension_floor"];

  it("extracts unique dimension entries from CSV rows", () => {
    const rows = makeRows(HDR, [
      ["Q1", "ORDINAL", "D1", "Leadership", "30", "50"],
      ["Q2", "ORDINAL", "D1", "Leadership", "30", "50"], // duplicate — same metadata
      ["Q3", "SJT",     "D2", "Judgement",  "20", ""],
    ]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ code: "D1", name: "Leadership", weight: 30, floor: 50, consistent: true, inconsistencyReason: null });
    expect(result[1]).toMatchObject({ code: "D2", name: "Judgement",  weight: 20, floor: null, consistent: true });
  });

  it("marks a dimension inconsistent when name differs across rows", () => {
    const rows = makeRows(HDR, [
      ["Q1", "ORDINAL", "D1", "Leadership",        "30", "50"],
      ["Q2", "ORDINAL", "D1", "Commercial Track",  "30", "50"],
    ]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result).toHaveLength(1);
    expect(result[0].consistent).toBe(false);
    expect(result[0].inconsistencyReason).toContain("dimension_name differs");
  });

  it("marks a dimension inconsistent when weight differs across rows", () => {
    const rows = makeRows(HDR, [
      ["Q1", "ORDINAL", "D1", "Leadership", "30", "50"],
      ["Q2", "ORDINAL", "D1", "Leadership", "25", "50"],
    ]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result[0].consistent).toBe(false);
    expect(result[0].inconsistencyReason).toContain("dimension_weight differs");
  });

  it("marks a dimension inconsistent when floor differs across rows", () => {
    const rows = makeRows(HDR, [
      ["Q1", "ORDINAL", "D1", "Leadership", "30", "50"],
      ["Q2", "ORDINAL", "D1", "Leadership", "30", "40"],
    ]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result[0].consistent).toBe(false);
    expect(result[0].inconsistencyReason).toContain("dimension_floor differs");
  });

  it("treats blank dimension_floor as null (no floor)", () => {
    const rows = makeRows(HDR, [["Q1", "ORDINAL", "D3", "Systems", "10", ""]]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result[0].floor).toBeNull();
  });

  it("ignores rows with a blank dimension_code", () => {
    const rows = makeRows(HDR, [
      ["Q1", "ORDINAL", "",   "No dimension", "10", ""],
      ["Q2", "ORDINAL", "D1", "Leadership",   "30", "50"],
    ]);
    const result = extractCsvFrameworkDimensions(rows, HDR);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("D1");
  });

  it("handles columns absent from the header gracefully (returns null for each)", () => {
    const minHdr = ["question_code", "question_type", "dimension_code"];
    const rows = makeRows(minHdr, [["Q1", "ORDINAL", "D1"]]);
    const result = extractCsvFrameworkDimensions(rows, minHdr);
    expect(result[0].name).toBeNull();
    expect(result[0].weight).toBeNull();
    expect(result[0].floor).toBeNull();
  });

  it("parseAndValidateCsv populates frameworkDimensions on the result", () => {
    const csv = buildCsv([
      { ...ordinalRow, dimension_name: "Leadership", dimension_weight: 100, dimension_floor: 50 },
    ]);
    const result = parseAndValidateCsv(csv);
    expect(result.frameworkDimensions).toHaveLength(1);
    expect(result.frameworkDimensions[0].code).toBe("D1");
    expect(result.frameworkDimensions[0].weight).toBe(100);
  });

  it("template example rows carry the new framework columns", () => {
    const template = buildCsvTemplate();
    const result = parseAndValidateCsv(template);
    // Every example row now has a dimension_name.
    expect(result.frameworkDimensions.length).toBeGreaterThan(0);
    expect(result.frameworkDimensions.every((d) => d.name !== null && d.name.length > 0)).toBe(true);
  });
});

// ── buildFrameworkPreview ─────────────────────────────────────────────────────

describe("buildFrameworkPreview", () => {
  const existing = [
    { reference: "D1", name: "Leadership",   weight: 30, minimumFloor: 50  },
    { reference: "D2", name: "Execution",    weight: 25, minimumFloor: null },
  ];

  const csvDims = (overrides?: Partial<CsvFrameworkDimensionRow>[]): CsvFrameworkDimensionRow[] =>
    (overrides ?? []).map((ov, i) => ({
      code: `D${i + 3}`,
      name: `Dimension ${i + 3}`,
      weight: 20,
      floor: null,
      consistent: true,
      inconsistencyReason: null,
      ...ov,
    }));

  it("state ok — all CSV dimensions already exist", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D1", name: "Leadership", weight: 30, floor: 50, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.missingCodes).toEqual([]);
    expect(preview.conflictingCodes).toEqual([]);
    expect(preview.canAutoCreate).toBe(false); // nothing to create
  });

  it("state partial — some dimensions missing, rest ok, weights total 100", () => {
    // existing: D1=30 + D2=25 = 55; new D3=25 + D4=20 → 55+45 = 100 ✓
    const preview = buildFrameworkPreview(
      [
        { code: "D1", name: "Leadership", weight: 30, floor: 50, consistent: true, inconsistencyReason: null },
        { code: "D3", name: "Systems",    weight: 25, floor: null, consistent: true, inconsistencyReason: null },
        { code: "D4", name: "Judgement",  weight: 20, floor: null, consistent: true, inconsistencyReason: null },
      ],
      existing,
    );
    expect(preview.missingCodes).toEqual(["D3", "D4"]);
    expect(preview.conflictingCodes).toEqual([]);
    // 55 (existing) + 25 + 20 = 100 → auto-create possible
    expect(preview.canAutoCreate).toBe(true);
    expect(preview.cannotAutoCreateReason).toBeNull();
  });

  it("blocks auto-create when projected weights ≠ 100", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D3", name: "New", weight: 20, floor: null, consistent: true, inconsistencyReason: null }],
      existing, // existing: 30+25=55; new: 20 → 75 ≠ 100
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("75%");
    expect(preview.cannotAutoCreateReason).toContain("100%");
  });

  it("blocks auto-create when dimension_name is missing", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D3", name: null, weight: 45, floor: null, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("dimension_name");
  });

  it("blocks auto-create when dimension_weight is missing", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D3", name: "New", weight: null, floor: null, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("dimension_weight");
  });

  it("blocks auto-create when dimension_weight is zero or negative", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D3", name: "New", weight: 0, floor: null, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("weight must be greater than zero");
  });

  it("blocks auto-create when a CSV row is inconsistent", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D3", name: "New", weight: 45, floor: null, consistent: false, inconsistencyReason: "dimension_weight differs: 45 vs 30 (rows 2 and 3)." }],
      existing,
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("inconsistent");
  });

  it("detects a conflict when CSV metadata differs from existing dimension", () => {
    const preview = buildFrameworkPreview(
      [{ code: "D1", name: "DIFFERENT NAME", weight: 30, floor: 50, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.conflictingCodes).toEqual(["D1"]);
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("D1");
    const d1 = preview.dimensions.find((d) => d.code === "D1")!;
    expect(d1.conflictsWith).toMatchObject({ name: "DIFFERENT NAME", weight: 30 });
  });

  it("does not conflict when CSV provides no name (blank dimension_name cell)", () => {
    // If Admin leaves dimension_name blank, there's no conflict to report.
    const preview = buildFrameworkPreview(
      [{ code: "D1", name: null, weight: 30, floor: 50, consistent: true, inconsistencyReason: null }],
      existing,
    );
    expect(preview.conflictingCodes).toEqual([]);
  });

  it("no_framework — role has zero dimensions, all-new, weights = 100", () => {
    const preview = buildFrameworkPreview(
      [
        { code: "D1", name: "Alpha", weight: 60, floor: 50, consistent: true, inconsistencyReason: null },
        { code: "D2", name: "Beta",  weight: 40, floor: null, consistent: true, inconsistencyReason: null },
      ],
      [], // no existing dimensions
    );
    expect(preview.missingCodes).toEqual(["D1", "D2"]);
    expect(preview.newDimensionWeightTotal).toBe(100);
    expect(preview.canAutoCreate).toBe(true);
  });

  it("no_framework — weights total 90%, blocks creation with a useful message", () => {
    const preview = buildFrameworkPreview(
      [
        { code: "D1", name: "Alpha", weight: 60, floor: null, consistent: true, inconsistencyReason: null },
        { code: "D2", name: "Beta",  weight: 30, floor: null, consistent: true, inconsistencyReason: null },
      ],
      [],
    );
    expect(preview.canAutoCreate).toBe(false);
    expect(preview.cannotAutoCreateReason).toContain("90%");
  });
});
