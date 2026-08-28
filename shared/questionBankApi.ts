/**
 * Task 24C-2 — shared Question Bank API contract.
 *
 * Pure DTO types and deterministic, type-aware validation shared by the
 * Express API, the client API module, and the tests. The Question Bank is
 * Admin-only: there are no public projections, so these shapes may carry
 * scoring configuration (raw points, decoys, rubrics, multipliers).
 *
 * The seven formal question types are preserved exactly — the legacy
 * Experience/Scenario model is never reintroduced.
 */

export const QUESTION_TYPES = ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"] as const;
export const QUESTION_BANK_STATUSES = ["Active", "Inactive"] as const;
export const SCORED_QUESTION_TYPES = ["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN"] as const;
export const CROSS_CHECK_RULE_TYPES = ["Integrity flag", "Manual review"] as const;
export const EVIDENCE_MULTIPLIERS = [1, 0.95, 0.85] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionBankStatus = (typeof QUESTION_BANK_STATUSES)[number] | "Draft";
export type CrossCheckRuleType = (typeof CROSS_CHECK_RULE_TYPES)[number];

export const SCORED_QUESTION_MAX = 5;
export const QUESTION_REFERENCE_MAX_LENGTH = 24;
export const SJT_OPTION_COUNT = 4;
export const SJT_SCORE_MIN = -2;
export const SJT_SCORE_MAX = 5;
export const MULTI_SCORE_MIN = -1;
export const MULTI_SCORE_MAX = 5;
export const MULTI_DEFAULT_SCORE_CAP = 5;
export const ORDINAL_MIN_OPTIONS = 4;
export const ORDINAL_MAX_OPTIONS = 5;

export function isScoredQuestionType(type: QuestionType): boolean {
  return (SCORED_QUESTION_TYPES as readonly string[]).includes(type);
}

// ── Admin list shapes ─────────────────────────────────────────────────────────

export interface QuestionDimensionEntry {
  reference: string;
  name: string;
}

/** Concise list row — no options, bands, rubrics or cross-checks. */
export interface AdminQuestionListItem {
  id: string;
  reference: string;
  type: QuestionType;
  dimension: QuestionDimensionEntry | null;
  qWeight: number | null;
  status: QuestionBankStatus;
  prompt: string;
  /** Composed assessment labels, e.g. "Business Development Officer Assessment v2 — Draft". */
  usedIn: string[];
}

export interface QuestionBankSummary {
  total: number;
  active: number;
  dimensionCount: number;
}

export type QuestionListSortKey = "reference" | "dimension" | "type" | "qWeight" | "status";

export interface AdminQuestionListResponse {
  items: AdminQuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** D1–D8 resolved from the database — never a second hard-coded copy. */
  dimensions: QuestionDimensionEntry[];
  summary: QuestionBankSummary;
}

export interface QuestionListQuery {
  search?: string;
  /** Dimension reference (D1–D8) or "GATE" for unassigned-dimension questions. */
  dimension?: string;
  type?: QuestionType;
  status?: QuestionBankStatus;
  sortKey?: QuestionListSortKey;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// ── Admin detail shapes ───────────────────────────────────────────────────────

export interface AdminQuestionOption {
  displayOrder: number;
  text: string;
  rawScore: number | null;
  isDecoy: boolean;
  outcomeType: string | null;
  relatedGate: { reference: string; name: string } | null;
  internalExplanation: string | null;
  verificationMultiplier: number | null;
}

export interface NumericInputDefinition {
  label: string;
  unit: string;
}

export type NumericMode = "calendarYearExperience" | "twoValueDerived";

export interface AdminNumericBand {
  lowerBound: number;
  upperBound: number | null;
  rawScore: number;
  displayOrder: number;
}

export interface AdminNumericConfig {
  mode: NumericMode;
  inputDefinitions: NumericInputDefinition[];
  derivedCalculationType: string;
  bands: AdminNumericBand[];
}

export interface AdminRubricAnchor {
  scoreMin: number;
  scoreMax: number;
  anchorText: string;
  displayOrder: number;
}

export interface AdminOpenConfig {
  minimumWords: number | null;
  maximumWords: number | null;
  timeLimitSec: number | null;
  pasteAllowed: boolean;
  rubric: AdminRubricAnchor[];
}

export interface AdminEvidenceLink {
  claimedQuestionId: string;
  claimedQuestionReference: string;
}

export interface AdminQuestionCrossCheck {
  id: string;
  /** Whether this question is the source or the comparison side of the rule. */
  direction: "source" | "comparison";
  otherQuestionReference: string;
  ruleType: CrossCheckRuleType;
  description: string;
  defaultOutcome: string;
  status: QuestionBankStatus;
}

export interface AdminQuestionDetail {
  id: string;
  reference: string;
  type: QuestionType;
  dimension: QuestionDimensionEntry | null;
  qWeight: number | null;
  maxScore: number | null;
  required: boolean;
  prompt: string;
  helpText: string;
  status: QuestionBankStatus;
  timeLimitSec: number | null;
  usedIn: string[];
  options: AdminQuestionOption[];
  /** MULTI score cap, when configured. */
  scoreCap: number | null;
  numericConfig: AdminNumericConfig | null;
  openConfig: AdminOpenConfig | null;
  evidenceLink: AdminEvidenceLink | null;
  crossChecks: AdminQuestionCrossCheck[];
  updatedAt: string;
}

// ── Create/update input (discriminated by type) ───────────────────────────────

export interface QuestionInputBase {
  reference: string;
  /** D1–D8 dimension reference, or null for Gate/Eligibility questions. */
  dimensionReference: string | null;
  required: boolean;
  prompt: string;
  helpText: string;
  status: QuestionBankStatus;
  timeLimitSec: number | null;
  crossCheck?: QuestionCrossCheckInput;
}

export interface QuestionCrossCheckInput {
  comparisonQuestionReference: string;
  ruleType: CrossCheckRuleType;
  description: string;
  defaultOutcome: string;
  status?: "Active" | "Inactive";
}

export interface GateOptionInput {
  text: string;
  /** Gate decision outcome, e.g. "pass", "fail", "flag". */
  outcomeType: string;
}

export interface OrdinalOptionInput {
  text: string;
  rawScore: number | null;
  /** Optional "close" outcome ending the application, with related gate. */
  outcomeType?: "close" | null;
  relatedGateReference?: string | null;
}

export interface MultiOptionInput {
  text: string;
  rawScore: number;
  isDecoy: boolean;
}

export interface SjtOptionInput {
  text: string;
  rawScore: number;
  internalExplanation: string;
}

export interface EvidenceOptionInput {
  text: string;
  verificationMultiplier: number;
}

export interface NumericBandInput {
  lowerBound: number;
  upperBound: number | null;
  rawScore: number;
}

export interface RubricAnchorInput {
  scoreMin: number;
  scoreMax: number;
  anchorText: string;
}

export interface NumericConfigInput {
  mode: NumericMode;
  inputDefinitions: NumericInputDefinition[];
  /** Filled with the mode default during validation when omitted. */
  derivedCalculationType: string;
  bands: NumericBandInput[];
}

export interface OpenConfigInput {
  minimumWords: number | null;
  maximumWords: number | null;
  timeLimitSec: number | null;
  pasteAllowed: boolean;
  rubric: RubricAnchorInput[];
}

export type QuestionInput =
  | (QuestionInputBase & { type: "GATE"; options: GateOptionInput[] })
  | (QuestionInputBase & { type: "ORDINAL"; qWeight: 1 | 2 | 3; options: OrdinalOptionInput[] })
  | (QuestionInputBase & { type: "MULTI"; qWeight: 1 | 2 | 3; scoreCap: number; options: MultiOptionInput[] })
  | (QuestionInputBase & { type: "NUMERIC"; qWeight: 1 | 2 | 3; numericConfig: NumericConfigInput })
  | (QuestionInputBase & { type: "SJT"; qWeight: 1 | 2 | 3; options: SjtOptionInput[] })
  | (QuestionInputBase & { type: "OPEN"; qWeight: 1 | 2 | 3; openConfig: OpenConfigInput })
  | (QuestionInputBase & { type: "EVIDENCE"; options: EvidenceOptionInput[]; claimedQuestionReference: string });

export type QuestionCreateInput = QuestionInput;
/** Update uses the same full type-aware shape; reference is locked after creation. */
export type QuestionUpdateInput = QuestionInput;

// ── Server-authoritative validation ───────────────────────────────────────────

const DEFAULT_DERIVED_CALCULATION: Record<NumericMode, string> = {
  calendarYearExperience: "calendar_year_to_derived_years",
  twoValueDerived: "two_inputs_to_percentage_attainment",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isNonEmptyString(value: unknown, maxLength = 4000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validateOptionsArray(candidate: unknown, context: string): string[] | null {
  if (!Array.isArray(candidate)) return [`${context} options are missing.`];
  if (candidate.length === 0) return [`Add at least one option to this ${context} question.`];
  return null;
}

function validateCrossCheck(candidate: unknown): { input: QuestionCrossCheckInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Cross-check configuration is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];
  const comparisonQuestionReference = typeof value.comparisonQuestionReference === "string" ? value.comparisonQuestionReference.trim() : "";
  if (!comparisonQuestionReference) errors.push("Select the question to cross-check against.");
  const ruleType = value.ruleType;
  if (typeof ruleType !== "string" || !(CROSS_CHECK_RULE_TYPES as readonly string[]).includes(ruleType)) errors.push("Select a valid cross-check rule type.");
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!description) errors.push("Describe the cross-check rule.");
  const defaultOutcome = typeof value.defaultOutcome === "string" && value.defaultOutcome.trim() ? value.defaultOutcome.trim() : (ruleType as string);
  const status = value.status === "Inactive" ? "Inactive" : "Active";
  if (errors.length) return { errors };
  return { input: { comparisonQuestionReference, ruleType: ruleType as CrossCheckRuleType, description, defaultOutcome, status } };
}

/**
 * Discriminated, type-aware validation for Question Bank create/update
 * payloads. Returns the sanitized input or safe error messages — never
 * technical database details.
 */
export function validateQuestionInput(candidate: unknown): { input: QuestionInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Question data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const reference = typeof value.reference === "string" ? value.reference.trim() : "";
  if (!reference) errors.push("Enter a question reference.");
  else if (reference.length > QUESTION_REFERENCE_MAX_LENGTH) errors.push("Question reference is too long.");

  const dimensionReference = value.dimensionReference === "" || value.dimensionReference == null ? null : value.dimensionReference;
  if (dimensionReference !== null && (typeof dimensionReference !== "string" || !/^[A-Z0-9]{1,16}$/.test(dimensionReference))) {
    errors.push("Select a valid dimension.");
  }

  const type = value.type;
  if (typeof type !== "string" || !(QUESTION_TYPES as readonly string[]).includes(type)) {
    errors.push("Select a valid question type.");
    return { errors };
  }
  const questionType = type as QuestionType;
  const scored = isScoredQuestionType(questionType);

  const qWeight = value.qWeight == null ? null : value.qWeight;
  if (scored && !isIntegerInRange(qWeight, 1, 3)) errors.push("Question weight must be 1, 2 or 3.");
  if (!scored && qWeight != null) errors.push("Gate and evidence questions do not carry a question weight.");

  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt) errors.push("Enter the question prompt.");
  const helpText = typeof value.helpText === "string" ? value.helpText.trim() : "";

  const status = value.status;
  if (typeof status !== "string" || !(QUESTION_BANK_STATUSES as readonly string[]).includes(status)) errors.push("Select a valid question status.");

  const timeLimitSec = value.timeLimitSec == null || value.timeLimitSec === "" ? null : value.timeLimitSec;
  if (timeLimitSec !== null && (!isFiniteNumber(timeLimitSec) || !Number.isInteger(timeLimitSec) || timeLimitSec <= 0)) {
    errors.push("The time limit must be a positive number of seconds.");
  }

  let crossCheck: QuestionCrossCheckInput | undefined;
  if (value.crossCheck != null) {
    const checked = validateCrossCheck(value.crossCheck);
    if ("errors" in checked) errors.push(...checked.errors);
    else crossCheck = checked.input;
  }

  if (errors.length) return { errors };

  const base: QuestionInputBase = {
    reference,
    dimensionReference: dimensionReference as string | null,
    required: value.required !== false,
    prompt,
    helpText,
    status: status as QuestionBankStatus,
    timeLimitSec: timeLimitSec as number | null,
    ...(crossCheck ? { crossCheck } : {}),
  };

  switch (questionType) {
    case "GATE": {
      const optionErrors = validateOptionsArray(value.options, "gate");
      if (optionErrors) return { errors: optionErrors };
      const options = (value.options as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>);
      options.forEach((option, index) => {
        if (!isNonEmptyString(option.text)) errors.push(`Option ${index + 1} needs answer text.`);
        if (!isNonEmptyString(option.outcomeType, 64)) errors.push(`Option ${index + 1} needs a gate outcome.`);
      });
      if (errors.length) return { errors };
      return { input: { ...base, type: "GATE", options: options.map((option) => ({ text: (option.text as string).trim(), outcomeType: (option.outcomeType as string).trim() })) } };
    }
    case "ORDINAL": {
      const optionErrors = validateOptionsArray(value.options, "ordinal");
      if (optionErrors) return { errors: optionErrors };
      const options = (value.options as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>);
      if (options.length < ORDINAL_MIN_OPTIONS || options.length > ORDINAL_MAX_OPTIONS) errors.push(`Ordinal questions need between ${ORDINAL_MIN_OPTIONS} and ${ORDINAL_MAX_OPTIONS} options.`);
      options.forEach((option, index) => {
        const label = `Option ${index + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const closing = option.outcomeType === "close";
        if (closing) {
          if (option.rawScore != null) errors.push(`${label} closes the application and cannot carry a raw score.`);
        } else if (!isIntegerInRange(option.rawScore, 0, SCORED_QUESTION_MAX)) {
          errors.push(`${label} must score between 0 and ${SCORED_QUESTION_MAX} points.`);
        }
        if (option.relatedGateReference != null && option.relatedGateReference !== "" && !isNonEmptyString(option.relatedGateReference, 16)) {
          errors.push(`${label} references an invalid gate.`);
        }
        if (option.outcomeType != null && option.outcomeType !== "close") errors.push(`${label} has an unsupported outcome.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "ORDINAL",
          qWeight: qWeight as 1 | 2 | 3,
          options: options.map((option) => ({
            text: (option.text as string).trim(),
            rawScore: option.outcomeType === "close" ? null : (option.rawScore as number),
            outcomeType: option.outcomeType === "close" ? "close" : null,
            relatedGateReference: option.outcomeType === "close" ? ((option.relatedGateReference as string | null) ?? null) : null,
          })),
        },
      };
    }
    case "MULTI": {
      const optionErrors = validateOptionsArray(value.options, "multi-select");
      if (optionErrors) return { errors: optionErrors };
      const options = (value.options as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>);
      const scoreCap = value.scoreCap == null ? MULTI_DEFAULT_SCORE_CAP : value.scoreCap;
      if (!isIntegerInRange(scoreCap, 1, 25)) errors.push("The multi-select score cap must be a positive number.");
      let scoredCount = 0;
      options.forEach((option, index) => {
        const label = `Option ${index + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const isDecoy = option.isDecoy === true;
        if (isDecoy) {
          if (option.rawScore !== -1) errors.push(`${label} is a decoy and must score −1.`);
        } else {
          scoredCount += 1;
          if (!isIntegerInRange(option.rawScore, 0, MULTI_SCORE_MAX)) errors.push(`${label} must score between 0 and ${MULTI_SCORE_MAX} points.`);
        }
      });
      if (scoredCount === 0) errors.push("Multi-select questions need at least one scorable option.");
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "MULTI",
          qWeight: qWeight as 1 | 2 | 3,
          scoreCap: scoreCap as number,
          options: options.map((option) => ({ text: (option.text as string).trim(), rawScore: option.rawScore as number, isDecoy: option.isDecoy === true })),
        },
      };
    }
    case "NUMERIC": {
      const config = (value.numericConfig ?? {}) as Record<string, unknown>;
      const mode = config.mode;
      if (mode !== "calendarYearExperience" && mode !== "twoValueDerived") errors.push("Select a valid numeric scoring mode.");
      const inputs = Array.isArray(config.inputDefinitions) ? (config.inputDefinitions as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>) : [];
      if (inputs.length === 0) errors.push("Numeric questions need at least one input definition.");
      inputs.forEach((input, index) => {
        if (!isNonEmptyString(input.label, 160)) errors.push(`Input ${index + 1} needs a label.`);
      });
      if (mode === "twoValueDerived" && inputs.length !== 2) errors.push("Two-value derived questions need exactly two inputs.");
      const bands = Array.isArray(config.bands) ? (config.bands as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>) : [];
      if (bands.length === 0) errors.push("Numeric questions need at least one scoring band.");
      const ranges: Array<[number, number]> = [];
      bands.forEach((band, index) => {
        const label = `Band ${index + 1}`;
        if (!isFiniteNumber(band.lowerBound)) errors.push(`${label} needs a lower bound.`);
        const upper = band.upperBound == null ? null : band.upperBound;
        if (upper !== null && !isFiniteNumber(upper)) errors.push(`${label} has an invalid upper bound.`);
        if (isFiniteNumber(band.lowerBound) && upper !== null && isFiniteNumber(upper) && upper < band.lowerBound) {
          errors.push(`${label} cannot end below its lower bound.`);
        }
        if (!isIntegerInRange(band.rawScore, 0, SCORED_QUESTION_MAX)) errors.push(`${label} must score between 0 and ${SCORED_QUESTION_MAX} points.`);
        if (isFiniteNumber(band.lowerBound)) ranges.push([band.lowerBound, upper !== null && isFiniteNumber(upper) ? upper : Number.POSITIVE_INFINITY]);
      });
      const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index][0] <= sorted[index - 1][1]) {
          errors.push("Numeric scoring bands must not overlap.");
          break;
        }
      }
      const derivedCalculationType = isNonEmptyString(config.derivedCalculationType, 96)
        ? (config.derivedCalculationType as string).trim()
        : DEFAULT_DERIVED_CALCULATION[mode as NumericMode];
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "NUMERIC",
          qWeight: qWeight as 1 | 2 | 3,
          numericConfig: {
            mode: mode as NumericMode,
            inputDefinitions: inputs.map((input) => ({ label: (input.label as string).trim(), unit: typeof input.unit === "string" ? input.unit.trim() : "" })),
            derivedCalculationType,
            bands: bands.map((band) => ({ lowerBound: band.lowerBound as number, upperBound: band.upperBound == null ? null : (band.upperBound as number), rawScore: band.rawScore as number })),
          },
        },
      };
    }
    case "SJT": {
      const optionErrors = validateOptionsArray(value.options, "scenario");
      if (optionErrors) return { errors: optionErrors };
      const options = (value.options as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>);
      if (options.length !== SJT_OPTION_COUNT) errors.push(`Scenario questions need exactly ${SJT_OPTION_COUNT} options.`);
      options.forEach((option, index) => {
        const label = `Option ${index + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        if (!isIntegerInRange(option.rawScore, SJT_SCORE_MIN, SJT_SCORE_MAX)) errors.push(`${label} must score between ${SJT_SCORE_MIN} and ${SJT_SCORE_MAX} points.`);
        if (!isNonEmptyString(option.internalExplanation)) errors.push(`${label} needs an internal explanation.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "SJT",
          qWeight: qWeight as 1 | 2 | 3,
          options: options.map((option) => ({ text: (option.text as string).trim(), rawScore: option.rawScore as number, internalExplanation: (option.internalExplanation as string).trim() })),
        },
      };
    }
    case "OPEN": {
      const config = (value.openConfig ?? {}) as Record<string, unknown>;
      const minimumWords = config.minimumWords == null ? null : config.minimumWords;
      const maximumWords = config.maximumWords == null ? null : config.maximumWords;
      if (minimumWords !== null && !isIntegerInRange(minimumWords, 1, 10000)) errors.push("The minimum word count must be a positive number.");
      if (maximumWords !== null && !isIntegerInRange(maximumWords, 1, 10000)) errors.push("The maximum word count must be a positive number.");
      if (minimumWords !== null && maximumWords !== null && isFiniteNumber(minimumWords) && isFiniteNumber(maximumWords) && minimumWords > maximumWords) {
        errors.push("The minimum word count cannot exceed the maximum.");
      }
      const configTimeLimit = config.timeLimitSec == null ? null : config.timeLimitSec;
      if (configTimeLimit !== null && (!isFiniteNumber(configTimeLimit) || !Number.isInteger(configTimeLimit) || configTimeLimit <= 0)) {
        errors.push("The time limit must be a positive number of seconds.");
      }
      const rubric = Array.isArray(config.rubric) ? (config.rubric as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>) : [];
      if (rubric.length === 0) errors.push("Open questions need at least one rubric anchor.");
      rubric.forEach((anchor, index) => {
        const label = `Rubric anchor ${index + 1}`;
        const scoreMin = anchor.scoreMin;
        const scoreMax = anchor.scoreMax;
        const minValid = isIntegerInRange(scoreMin, 0, SCORED_QUESTION_MAX);
        const maxValid = isIntegerInRange(scoreMax, 0, SCORED_QUESTION_MAX);
        if (!minValid) errors.push(`${label} needs a valid minimum score.`);
        if (!maxValid) errors.push(`${label} needs a valid maximum score.`);
        if (minValid && maxValid && (scoreMax as number) < (scoreMin as number)) {
          errors.push(`${label} cannot end below its minimum score.`);
        }
        if (!isNonEmptyString(anchor.anchorText)) errors.push(`${label} needs anchor text.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "OPEN",
          qWeight: qWeight as 1 | 2 | 3,
          openConfig: {
            minimumWords: minimumWords as number | null,
            maximumWords: maximumWords as number | null,
            timeLimitSec: configTimeLimit as number | null,
            pasteAllowed: config.pasteAllowed === true,
            rubric: rubric.map((anchor) => ({ scoreMin: anchor.scoreMin as number, scoreMax: anchor.scoreMax as number, anchorText: (anchor.anchorText as string).trim() })),
          },
        },
      };
    }
    case "EVIDENCE": {
      const optionErrors = validateOptionsArray(value.options, "evidence");
      if (optionErrors) return { errors: optionErrors };
      const options = (value.options as unknown[]).map((entry) => (entry ?? {}) as Record<string, unknown>);
      const claimedQuestionReference = typeof value.claimedQuestionReference === "string" ? value.claimedQuestionReference.trim() : "";
      if (!claimedQuestionReference) errors.push("Select the claimed question this evidence verifies.");
      else if (claimedQuestionReference === reference) errors.push("An evidence question cannot verify itself.");
      options.forEach((option, index) => {
        const label = `Option ${index + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const multiplier = option.verificationMultiplier;
        if (!isFiniteNumber(multiplier) || !(EVIDENCE_MULTIPLIERS as readonly number[]).some((allowed) => Math.abs(allowed - multiplier) < 0.0001)) {
          errors.push(`${label} must use a verification multiplier of 1.00, 0.95 or 0.85.`);
        }
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "EVIDENCE",
          claimedQuestionReference,
          options: options.map((option) => ({ text: (option.text as string).trim(), verificationMultiplier: option.verificationMultiplier as number })),
        },
      };
    }
  }
}

/** Compose the restrained "Used in" label for an assessment assignment. */
export function formatUsedInLabel(name: string, status: string): string {
  return status === "Active" ? name : `${name} — ${status}`;
}
