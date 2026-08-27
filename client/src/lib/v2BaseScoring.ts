import type { AdminQuestionOption, DimensionCode, NumericBand, QuestionBankQuestion } from "@/lib/questionBankData";

export const V2_DIMENSION_WEIGHTS = {
  D1: 22,
  D2: 18,
  D3: 14,
  D4: 12,
  D5: 12,
  D6: 8,
  D7: 8,
  D8: 6,
} as const satisfies Record<Exclude<DimensionCode, "GATE" | "NA">, number>;

export const V2_DIMENSION_LABELS = {
  D1: "Business Development Track Record",
  D2: "Verified Commercial Results",
  D3: "Sector & Segment Relevance",
  D4: "Abuja Market Access",
  D5: "Commercial Judgement",
  D6: "Communication & Proposal Quality",
  D7: "Drive & Resilience",
  D8: "Tools & Digital Fluency",
} as const;

export type V2ResponseValue = string | string[] | { year?: string; target?: string; actual?: string; never?: boolean };
export type V2Answers = Record<string, V2ResponseValue | undefined>;
export type V2RubricRatings = Record<string, number | undefined>;
export type V2QuestionScoringState = "scored" | "unanswered" | "invalid" | "awaiting-rubric" | "close-outcome" | "not-scored";
export type V2QuestionResult = {
  questionId: string;
  reference: string;
  type: QuestionBankQuestion["type"];
  rawScore?: number;
  maxScore?: number;
  qWeight?: number;
  weightedInput?: number;
  scoringState: V2QuestionScoringState;
  reason?: string;
};
export type V2DimensionResult = {
  dimensionId: keyof typeof V2_DIMENSION_WEIGHTS;
  dimensionName: string;
  weight: number;
  score?: number;
  contribution?: number;
  scoringState: "scored" | "unavailable";
  questionResults: V2QuestionResult[];
};
export type V2UnresolvedItem = { reference?: string; reason: string };
export type V2BaseScoringResult = {
  scoringReady: boolean;
  baseAssessmentScore?: number;
  dimensionResults: V2DimensionResult[];
  questionResults: V2QuestionResult[];
  unresolvedItems: V2UnresolvedItem[];
  reasonUnavailable?: string;
};

const DIMENSION_IDS = Object.keys(V2_DIMENSION_WEIGHTS) as Array<keyof typeof V2_DIMENSION_WEIGHTS>;
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
const isRecord = (value: V2ResponseValue | undefined): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isMissing = (value: V2ResponseValue | undefined) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.values(value).every((item) => item === undefined || item === "" || item === false));
const configuredOptions = (question: QuestionBankQuestion): readonly AdminQuestionOption[] => {
  if (question.type === "ORDINAL") return question.config.ordinalConfig?.options ?? question.options;
  if (question.type === "MULTI") return question.config.multiConfig?.options ?? question.options;
  if (question.type === "SJT") return question.config.sjtConfig?.options ?? question.options;
  if (question.type === "GATE") return question.config.gateConfig?.options ?? question.options;
  if (question.type === "EVIDENCE") return question.config.evidenceConfig?.options ?? question.options;
  return question.options;
};
const optionFor = (question: QuestionBankQuestion, id: string) => configuredOptions(question).find((option) => option.id === id);
const findBand = (bands: readonly NumericBand[], value: number) => bands.find((band) => value >= band.lowerBound && (band.upperBound === undefined || value <= band.upperBound));
const responseObject = (value: V2ResponseValue | undefined) => isRecord(value) ? value : {};

function scoreQuestion(question: QuestionBankQuestion, answers: V2Answers, rubricRatings: V2RubricRatings, currentYear: number): V2QuestionResult {
  const answer = answers[question.id];
  const base = { questionId: question.id, reference: question.reference, type: question.type, qWeight: question.qWeight ?? undefined };
  if (question.required && isMissing(answer)) return { ...base, scoringState: "unanswered", reason: "Required question unanswered." };
  if (question.type === "GATE" || question.type === "EVIDENCE") return { ...base, scoringState: "not-scored", reason: question.type === "GATE" ? "Eligibility gate; no points." : "Evidence response; no points." };
  if (question.type === "ORDINAL" || question.type === "SJT") {
    if (typeof answer !== "string") return { ...base, scoringState: "invalid", reason: "A single configured option is required." };
    const option = optionFor(question, answer);
    if (!option) return { ...base, scoringState: "invalid", reason: "Selected option is not configured." };
    if (option.outcome === "close") return { ...base, scoringState: "close-outcome", reason: "Application closed by eligibility outcome." };
    if (typeof option.rawPoints !== "number") return { ...base, scoringState: "invalid", reason: "Selected option has no configured raw score." };
    return { ...base, rawScore: option.rawPoints, maxScore: question.max ?? 5, scoringState: "scored" };
  }
  if (question.type === "MULTI") {
    if (!Array.isArray(answer) || answer.length === 0) return { ...base, scoringState: "unanswered", reason: "Required question unanswered." };
    const options = answer.map((id) => optionFor(question, id));
    if (options.some((option) => !option || typeof option.rawPoints !== "number")) return { ...base, scoringState: "invalid", reason: "One or more selected options are not configured." };
    const rawScore = Math.min(question.config.multiConfig?.scoreCap ?? 5, Math.max(0, options.reduce((sum, option) => sum + (option?.rawPoints ?? 0), 0)));
    return { ...base, rawScore, maxScore: question.max ?? 5, scoringState: "scored" };
  }
  if (question.type === "NUMERIC") {
    const config = question.config.numericConfig;
    const value = responseObject(answer);
    if (!config) return { ...base, scoringState: "invalid", reason: "Numeric configuration is missing." };
    let derivedValue: number;
    if (config.mode === "calendarYearExperience") {
      if (value.never === true) derivedValue = 0;
      else if (typeof value.year !== "string" || !/^\d{4}$/.test(value.year) || Number(value.year) > currentYear || Number(value.year) < 1900) return { ...base, scoringState: "invalid", reason: "Invalid calendar year response." };
      else derivedValue = currentYear - Number(value.year);
    } else {
      const target = Number(value.target);
      const actual = Number(value.actual);
      if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual) || actual < 0) return { ...base, scoringState: "invalid", reason: "Target must be greater than zero and actual delivered cannot be negative." };
      derivedValue = actual / target * 100;
    }
    const band = findBand(config.bands, derivedValue);
    if (!band) return { ...base, scoringState: "invalid", reason: "Numeric response does not match a configured scoring band." };
    return { ...base, rawScore: band.rawPoints, maxScore: question.max ?? 5, scoringState: "scored" };
  }
  if (question.type === "OPEN") {
    const rating = rubricRatings[question.id];
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 5) return { ...base, scoringState: "awaiting-rubric", reason: "Open response awaiting rubric review." };
    return { ...base, rawScore: rating, maxScore: question.max ?? 5, scoringState: "scored" };
  }
  return { ...base, scoringState: "invalid", reason: "Unsupported question type." };
}

export function validateV2DimensionWeights(weights: Record<string, number> = V2_DIMENSION_WEIGHTS) {
  return DIMENSION_IDS.every((id) => typeof weights[id] === "number") && DIMENSION_IDS.reduce((sum, id) => sum + Number(weights[id]), 0) === 100;
}

export function calculateV2BaseAssessmentScore(questions: readonly QuestionBankQuestion[], answers: V2Answers, rubricRatings: V2RubricRatings = {}, currentYear = new Date().getFullYear(), weights: Record<string, number> = V2_DIMENSION_WEIGHTS): V2BaseScoringResult {
  if (!validateV2DimensionWeights(weights)) return { scoringReady: false, dimensionResults: [], questionResults: [], unresolvedItems: [], reasonUnavailable: "Dimension weights must total 100%." };
  const questionResults = questions.map((question) => scoreQuestion(question, answers, rubricRatings, currentYear));
  const unresolvedItems: V2UnresolvedItem[] = questionResults.filter((result) => result.scoringState !== "scored" && result.scoringState !== "not-scored").map((result) => ({ reference: result.reference, reason: result.reason ?? "Question scoring is unresolved." }));
  const dimensionResults = DIMENSION_IDS.map((dimensionId): V2DimensionResult => {
    const assigned = questions.filter((question) => question.dimension === dimensionId && question.type !== "GATE" && question.type !== "EVIDENCE");
    const results = questionResults.filter((result) => assigned.some((question) => question.id === result.questionId));
    const valid = results.filter((result) => result.scoringState === "scored" && typeof result.rawScore === "number" && typeof result.maxScore === "number" && typeof result.qWeight === "number");
    const weight = Number(weights[dimensionId]);
    if (assigned.length === 0) { unresolvedItems.push({ reason: `${dimensionId} has no scored questions assigned.` }); return { dimensionId, dimensionName: V2_DIMENSION_LABELS[dimensionId], weight, scoringState: "unavailable", questionResults: results }; }
    if (valid.length !== assigned.length) return { dimensionId, dimensionName: V2_DIMENSION_LABELS[dimensionId], weight, scoringState: "unavailable", questionResults: results };
    const denominator = valid.reduce((sum, result) => sum + (result.qWeight ?? 0), 0);
    if (denominator <= 0) { unresolvedItems.push({ reason: `${dimensionId} has no scored questions assigned.` }); return { dimensionId, dimensionName: V2_DIMENSION_LABELS[dimensionId], weight, scoringState: "unavailable", questionResults: results }; }
    const score = Math.min(100, Math.max(0, valid.reduce((sum, result) => { const input = (result.rawScore! / result.maxScore!) * result.qWeight!; result.weightedInput = round(input, 2); return sum + input; }, 0) / denominator * 100));
    const contribution = score * weight / 100;
    return { dimensionId, dimensionName: V2_DIMENSION_LABELS[dimensionId], weight, score: round(score, 1), contribution: round(contribution, 1), scoringState: "scored", questionResults: results };
  });
  if (unresolvedItems.length || dimensionResults.some((dimension) => dimension.scoringState !== "scored")) return { scoringReady: false, dimensionResults, questionResults, unresolvedItems, reasonUnavailable: unresolvedItems[0]?.reason ?? "Base score unavailable." };
  const baseAssessmentScore = round(dimensionResults.reduce((sum, dimension) => sum + (dimension.contribution ?? 0), 0), 1);
  return { scoringReady: true, baseAssessmentScore, dimensionResults, questionResults, unresolvedItems: [] };
}
