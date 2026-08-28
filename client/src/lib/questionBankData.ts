/**
 * Frontend-only Question Bank contract (LEGACY mock source).
 *
 * As of Task 24C-2 the Admin Question Bank CRUD (list, detail, create, edit)
 * reads/writes TiDB through `recruitmentApi.ts` and NO LONGER consumes this
 * module. It is retained only for the domains that have not yet been cut over:
 * the Assessment Builder / Assessment Detail (Task 24C-3), the v2 Scoring
 * Preview and scoring files, and the candidate placeholder. Do not reintroduce
 * it as a runtime source for the Question Bank pages.
 *
 * The Admin configuration model is intentionally richer than the applicant
 * assessment projection. Existing applicant questions continue to consume the
 * legacy `question` / `competency` / `options` shape through assessmentData.ts.
 */
import { DEFAULT_BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS as BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS, type AssessmentOption } from "@/lib/assessmentQuestionContent";
import { FRAMEWORK_QUESTIONS } from "@/lib/frameworkQuestionData";

export type QuestionType = "GATE" | "ORDINAL" | "MULTI" | "NUMERIC" | "SJT" | "OPEN" | "EVIDENCE";
export type LegacyQuestionType = "Experience" | "Scenario";
export type QuestionStatus = "Active" | "Inactive";
export type DimensionCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "GATE" | "NA";
export type QWeight = 1 | 2 | 3;
export type ScoreOutcome = "score" | "close";

export type QuestionDimension = { code: DimensionCode; label: string };
export const QUESTION_BANK_DIMENSIONS = [
  { code: "D1", label: "Business Development Track Record" },
  { code: "D2", label: "Verified Commercial Results" },
  { code: "D3", label: "Sector & Segment Relevance" },
  { code: "D4", label: "Abuja Market Access" },
  { code: "D5", label: "Commercial Judgement" },
  { code: "D6", label: "Communication & Proposal Quality" },
  { code: "D7", label: "Drive & Resilience" },
  { code: "D8", label: "Tools & Digital Fluency" },
  { code: "GATE", label: "Gate / Eligibility" },
  { code: "NA", label: "Not Applicable" },
] as const satisfies readonly QuestionDimension[];

export const QUESTION_BANK_TYPES: readonly QuestionType[] = ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"];
export const QUESTION_BANK_COMPETENCIES = QUESTION_BANK_DIMENSIONS.map((dimension) => dimension.label);
const dimensionLabel = (code: DimensionCode) => QUESTION_BANK_DIMENSIONS.find((dimension) => dimension.code === code)?.label ?? "Not Applicable";

export type AdminQuestionOption = AssessmentOption & {
  rawPoints?: number;
  decoy?: boolean;
  outcome?: ScoreOutcome;
  relatedGate?: string;
  whatThisReveals?: string;
  verificationMultiplier?: 1 | 0.95 | 0.85;
  gateOutcome?: "pass" | "fail" | "flag";
};
export type NumericInput = { label: string; unit: string; minimum?: number; maximum?: number };
export type NumericBand = { id: string; lowerBound: number; upperBound?: number; rawPoints: number };
export type RubricAnchor = { id: string; points: 0 | 1 | 2 | 3 | 4 | 5; anchor: string };

export type QuestionConfig = {
  gateConfig?: { options: AdminQuestionOption[] };
  ordinalConfig?: { options: AdminQuestionOption[] };
  multiConfig?: { options: AdminQuestionOption[]; scoreCap: number };
  numericConfig?: {
    mode: "single" | "twoValueDerived" | "calendarYearExperience";
    inputs: NumericInput[];
    bands: NumericBand[];
  };
  sjtConfig?: { options: AdminQuestionOption[] };
  openConfig?: {
    wordLimit?: number;
    minimumWords?: number;
    pasteAllowed: boolean;
    timeLimitSec?: number;
    rubric: RubricAnchor[];
  };
  evidenceConfig?: { pairedQuestionRef: string; options: AdminQuestionOption[] };
  crossCheck?: { compareQuestionRef: string; ruleDescription: string; flagOutcome: "integrity" };
};

export type QuestionBankQuestion = {
  id: string;
  reference: string;
  dimension: DimensionCode;
  dimensionLabel: string;
  type: QuestionType;
  qWeight: QWeight | null;
  max: 5 | null;
  required: boolean;
  prompt: string;
  helpText: string;
  status: QuestionStatus;
  evidenceRef: string;
  flagIf: string;
  timeLimitSec: number | null;
  usedIn: string;
  config: QuestionConfig;
  /** Compatibility aliases retained for the existing applicant and Admin surfaces. */
  competency: string;
  question: string;
  options: readonly AdminQuestionOption[];
};

export type QuestionBankInput = {
  reference?: string;
  dimension?: DimensionCode;
  type: QuestionType;
  qWeight?: QWeight | null;
  max?: 5 | null;
  required?: boolean;
  prompt?: string;
  helpText?: string;
  status: QuestionStatus;
  evidenceRef?: string;
  flagIf?: string;
  timeLimitSec?: number | null;
  config?: QuestionConfig;
  competency?: string;
  question?: string;
  options?: AdminQuestionOption[];
};
export type QuestionScoreMap = Record<string, Record<string, number>>;
export const QUESTION_BANK_STORAGE_KEY = "recruitment-portal:admin-demo-question-bank";
export const QUESTION_SCORE_STORAGE_KEY = "recruitment-portal:admin-demo-question-scores";
const assessmentName = "Business Development Assessment";

const standardOptions = (choices: readonly string[]): AdminQuestionOption[] => choices.map((text, index) => ({ id: String.fromCharCode(97 + index), label: String.fromCharCode(65 + index), text }));
const scoredTypes = new Set<QuestionType>(["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN"]);
const dimensionForLegacyCompetency = (competency: string): QuestionDimension => {
  const match = QUESTION_BANK_DIMENSIONS.find((dimension) => dimension.label === competency);
  return match ?? { code: "NA", label: competency || "Not Applicable" };
};
const labelOptions = (options: readonly AdminQuestionOption[] = []) => options.map((option, index) => ({ ...option, label: String.fromCharCode(65 + index) }));
const defaultConfigFor = (type: QuestionType, options: AdminQuestionOption[], scores: Record<string, number> = {}): QuestionConfig => {
  const scoredOptions = labelOptions(options).map((option) => ({ ...option, rawPoints: typeof scores[option.id] === "number" ? scores[option.id] : option.rawPoints ?? 0 }));
  if (type === "GATE") return { gateConfig: { options: labelOptions(options).map((option) => ({ ...option, gateOutcome: option.gateOutcome ?? "pass" })) } };
  if (type === "ORDINAL") return { ordinalConfig: { options: scoredOptions } };
  if (type === "SJT") return { sjtConfig: { options: scoredOptions } };
  if (type === "MULTI") return { multiConfig: { options: scoredOptions, scoreCap: 5 } };
  if (type === "NUMERIC") return { numericConfig: { mode: "single", inputs: [{ label: "Value", unit: "" }], bands: [{ id: "band-1", lowerBound: 0, rawPoints: 0 }] } };
  if (type === "OPEN") return { openConfig: { pasteAllowed: true, rubric: [] } };
  if (type === "EVIDENCE") return { evidenceConfig: { pairedQuestionRef: "", options: labelOptions(options).map((option) => ({ ...option, verificationMultiplier: 1 })) } };
  return {};
};
const legacyTypeToFormal = (type: string): QuestionType => type === "Experience" ? "ORDINAL" : type === "Scenario" ? "SJT" : QUESTION_BANK_TYPES.includes(type as QuestionType) ? type as QuestionType : "SJT";

const defaultQuestions: QuestionBankQuestion[] = BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS.map((question, index) => {
  const type = index === 0 ? "ORDINAL" : "SJT";
  const options = labelOptions([...question.options]);
  const scores = Object.fromEntries(options.map((option, optionIndex) => [option.id, optionIndex === 2 ? 5 : Math.min(optionIndex, 4)]));
  const dimension = index === 0 ? QUESTION_BANK_DIMENSIONS[0] : QUESTION_BANK_DIMENSIONS[5];
  return {
    id: `q-${String(index + 1).padStart(3, "0")}`,
    reference: `Q-${String(index + 1).padStart(3, "0")}`,
    dimension: dimension.code,
    dimensionLabel: dimension.label,
    type,
    qWeight: 2,
    max: 5,
    required: true,
    prompt: question.question,
    helpText: "",
    status: "Active",
    evidenceRef: "",
    flagIf: "",
    timeLimitSec: null,
    usedIn: assessmentName,
    config: defaultConfigFor(type, options, scores),
    competency: question.category,
    question: question.question,
    options,
  };
});

const legacyAdditionalQuestions: QuestionBankQuestion[] = [
  { id: "q-006", reference: "Q-006", competency: "Negotiation & Closing", question: "A prospect says they are ready to proceed but asks for a final concession that could affect the commercial value of the opportunity. What would you most likely do?", type: "SJT", dimension: "D5", dimensionLabel: dimensionLabel("D5"), prompt: "A prospect says they are ready to proceed but asks for a final concession that could affect the commercial value of the opportunity. What would you most likely do?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["Agree immediately to avoid losing the opportunity.", "Clarify the underlying concern, protect the agreed value and explore an appropriate commercial trade-off.", "End the conversation because the prospect is changing the terms.", "Refer every request to a senior colleague without further discussion.", "Offer several concessions before understanding the request."]), config: defaultConfigFor("SJT", standardOptions(["Agree immediately to avoid losing the opportunity.", "Clarify the underlying concern, protect the agreed value and explore an appropriate commercial trade-off.", "End the conversation because the prospect is changing the terms.", "Refer every request to a senior colleague without further discussion.", "Offer several concessions before understanding the request."])) },
  { id: "q-007", reference: "Q-007", competency: "Communication", question: "Which statement best describes how you communicate the value of a new product or service to a prospective client?", type: "SJT", dimension: "D6", dimensionLabel: dimensionLabel("D6"), prompt: "Which statement best describes how you communicate the value of a new product or service to a prospective client?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["I provide the same overview to every prospect.", "I focus mainly on the product features.", "I connect the offer to the prospect's priorities and confirm that the value is understood.", "I avoid discussing value until the client requests pricing.", "I rely on written materials instead of conversations."]), config: defaultConfigFor("SJT", standardOptions(["I provide the same overview to every prospect.", "I focus mainly on the product features.", "I connect the offer to the prospect's priorities and confirm that the value is understood.", "I avoid discussing value until the client requests pricing.", "I rely on written materials instead of conversations."])) },
  { id: "q-008", reference: "Q-008", competency: "Leadership", question: "A colleague is struggling to move several opportunities forward. What would you most likely do first?", type: "SJT", dimension: "D7", dimensionLabel: dimensionLabel("D7"), prompt: "A colleague is struggling to move several opportunities forward. What would you most likely do first?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["Take over all of the opportunities immediately.", "Review the pipeline together, identify the blockers and agree practical next steps.", "Tell the colleague to increase the number of follow-up emails.", "Wait for the next reporting cycle before discussing it.", "Raise the issue publicly in a team meeting."]), config: defaultConfigFor("SJT", standardOptions(["Take over all of the opportunities immediately.", "Review the pipeline together, identify the blockers and agree practical next steps.", "Tell the colleague to increase the number of follow-up emails.", "Wait for the next reporting cycle before discussing it.", "Raise the issue publicly in a team meeting."])) },
  { id: "q-009", reference: "Q-009", competency: "Prospecting", question: "How do you typically prioritise potential business development opportunities when your pipeline includes several different organisations?", type: "SJT", dimension: "D1", dimensionLabel: dimensionLabel("D1"), prompt: "How do you typically prioritise potential business development opportunities when your pipeline includes several different organisations?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["I contact prospects in the order they appear in my list.", "I prioritise the most familiar brands.", "I assess fit, potential value, urgency and access to the relevant decision-makers.", "I focus only on organisations that contact me first.", "I choose whichever prospect appears easiest to reach."]), config: defaultConfigFor("SJT", standardOptions(["I contact prospects in the order they appear in my list.", "I prioritise the most familiar brands.", "I assess fit, potential value, urgency and access to the relevant decision-makers.", "I focus only on organisations that contact me first.", "I choose whichever prospect appears easiest to reach."])) },
  { id: "q-010", reference: "Q-010", competency: "Pipeline Management", question: "An opportunity has been inactive for several weeks after a promising initial conversation. What would you most likely do?", type: "SJT", dimension: "D7", dimensionLabel: dimensionLabel("D7"), prompt: "An opportunity has been inactive for several weeks after a promising initial conversation. What would you most likely do?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["Remove it from the pipeline without further contact.", "Send the same follow-up message each week.", "Review the earlier discussion, identify a relevant reason to re-engage and agree a clear next step.", "Offer a discount immediately.", "Wait for the prospect to restart the conversation."]), config: defaultConfigFor("SJT", standardOptions(["Remove it from the pipeline without further contact.", "Send the same follow-up message each week.", "Review the earlier discussion, identify a relevant reason to re-engage and agree a clear next step.", "Offer a discount immediately.", "Wait for the prospect to restart the conversation."])) },
  { id: "q-011", reference: "Q-011", competency: "Commercial Judgement", question: "When evaluating a potential commercial opportunity, what information is most important to understand before committing further time?", type: "SJT", dimension: "D5", dimensionLabel: dimensionLabel("D5"), prompt: "When evaluating a potential commercial opportunity, what information is most important to understand before committing further time?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["Whether the organisation has a well-known name.", "The likely needs, decision process, value potential and delivery feasibility.", "Whether the prospect responds quickly to messages.", "Whether competitors have already contacted the prospect.", "Whether a discount may be requested later."]), config: defaultConfigFor("SJT", standardOptions(["Whether the organisation has a well-known name.", "The likely needs, decision process, value potential and delivery feasibility.", "Whether the prospect responds quickly to messages.", "Whether competitors have already contacted the prospect.", "Whether a discount may be requested later."])) },
  { id: "q-012", reference: "Q-012", competency: "Business Development Experience", question: "Which statement best reflects your approach to building a sustainable pipeline of new business opportunities?", type: "SJT", dimension: "D1", dimensionLabel: dimensionLabel("D1"), prompt: "Which statement best reflects your approach to building a sustainable pipeline of new business opportunities?", helpText: "", qWeight: 2, max: 5, required: true, status: "Active", evidenceRef: "", flagIf: "", timeLimitSec: null, usedIn: "Not assigned", options: standardOptions(["I focus only on opportunities that can close quickly.", "I rely on one lead source whenever possible.", "I maintain a balanced pipeline, qualify opportunities and build relationships over time.", "I pursue every available lead with the same level of effort.", "I wait until current opportunities are complete before prospecting again."]), config: defaultConfigFor("SJT", standardOptions(["I focus only on opportunities that can close quickly.", "I rely on one lead source whenever possible.", "I maintain a balanced pipeline, qualify opportunities and build relationships over time.", "I pursue every available lead with the same level of effort.", "I wait until current opportunities are complete before prospecting again."])) },
];
export const QUESTION_BANK_QUESTIONS: readonly QuestionBankQuestion[] = [...defaultQuestions, ...legacyAdditionalQuestions, ...FRAMEWORK_QUESTIONS];
const cloneQuestion = (question: QuestionBankQuestion): QuestionBankQuestion => ({ ...question, config: structuredClone(question.config), options: question.options.map((option) => ({ ...option })) });
const readStorage = <Value,>(key: string): Value | null => { if (typeof window === "undefined") return null; try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as Value : null; } catch { return null; } };
const saveStorage = (key: string, value: unknown) => { if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value)); };

function normalizeQuestion(raw: Partial<QuestionBankQuestion> & { type?: string; options?: readonly AdminQuestionOption[]; }, index: number): QuestionBankQuestion {
  const type = legacyTypeToFormal(raw.type ?? "SJT");
  const prompt = raw.prompt ?? raw.question ?? "";
  const dimension = raw.dimension ? QUESTION_BANK_DIMENSIONS.find((item) => item.code === raw.dimension) ?? dimensionForLegacyCompetency(raw.competency ?? "") : dimensionForLegacyCompetency(raw.competency ?? "");
  const options = labelOptions(raw.options ?? []);
  const config = raw.config ?? defaultConfigFor(type, options);
  return {
    id: raw.id ?? `q-${String(index + 1).padStart(3, "0")}`,
    reference: raw.reference ?? `Q-${String(index + 1).padStart(3, "0")}`,
    dimension: dimension.code,
    dimensionLabel: dimension.label,
    type,
    qWeight: raw.qWeight ?? (scoredTypes.has(type) ? 2 : null),
    max: raw.max === 5 || raw.max === null ? raw.max : scoredTypes.has(type) ? 5 : null,
    required: raw.required ?? true,
    prompt,
    helpText: raw.helpText ?? "",
    status: raw.status ?? "Active",
    evidenceRef: raw.evidenceRef ?? "",
    flagIf: raw.flagIf ?? "",
    timeLimitSec: raw.timeLimitSec ?? null,
    usedIn: raw.usedIn ?? "Not assigned",
    config,
    competency: raw.competency ?? dimension.label,
    question: prompt,
    options,
  };
}

export function getQuestionBankQuestions(): QuestionBankQuestion[] {
  const saved = readStorage<Partial<QuestionBankQuestion>[]>(QUESTION_BANK_STORAGE_KEY);
  if (Array.isArray(saved) && saved.length) {
    const normalized = saved.map(normalizeQuestion);
    const existingIds = new Set(normalized.map((question) => question.id));
    return [...normalized, ...legacyAdditionalQuestions.filter((question) => !existingIds.has(question.id)).map(cloneQuestion), ...FRAMEWORK_QUESTIONS.filter((question) => !existingIds.has(question.id)).map(cloneQuestion)];
  }
  return [...defaultQuestions, ...legacyAdditionalQuestions, ...FRAMEWORK_QUESTIONS].map(cloneQuestion);
}
export function getQuestionBankQuestion(id: string) { return getQuestionBankQuestions().find((question) => question.id === id); }
export function getQuestionBankScores(): QuestionScoreMap { const saved = readStorage<QuestionScoreMap>(QUESTION_SCORE_STORAGE_KEY); return saved && typeof saved === "object" ? saved : {}; }
export function getQuestionScoreConfiguration(questionId: string) { return getQuestionBankScores()[questionId]; }
export function hasQuestionScoring(question: QuestionBankQuestion) {
  if (!scoredTypes.has(question.type)) return false;
  const legacyScores = getQuestionScoreConfiguration(question.id);
  if (legacyScores && question.options.length) return question.options.every((option) => typeof legacyScores[option.id] === "number" && legacyScores[option.id] >= 0 && legacyScores[option.id] <= 5);
  if (question.type === "ORDINAL") return Boolean(question.config.ordinalConfig?.options.length);
  if (question.type === "SJT") return Boolean(question.config.sjtConfig?.options.length);
  if (question.type === "MULTI") return Boolean(question.config.multiConfig?.options.length && question.config.multiConfig.scoreCap === 5);
  if (question.type === "NUMERIC") return Boolean(question.config.numericConfig?.bands.length);
  return Boolean(question.config.openConfig?.rubric.length);
}
export function getQuestionBankSummary() { const questions = getQuestionBankQuestions(); return { total: questions.length, active: questions.filter((question) => question.status === "Active").length, competencies: new Set(questions.map((question) => question.dimension)).size }; }

export function hasQuestionConfiguration(question: QuestionBankQuestion) {
  if (question.type === "GATE") return Boolean(question.config.gateConfig?.options.length === 2);
  if (question.type === "EVIDENCE") return Boolean(question.config.evidenceConfig?.pairedQuestionRef && question.config.evidenceConfig.options.length && question.config.evidenceConfig.options.every((option) => option.verificationMultiplier === 1 || option.verificationMultiplier === 0.95 || option.verificationMultiplier === 0.85));
  return hasQuestionScoring(question);
}

export function isApplicantCompatibleQuestion(question: QuestionBankQuestion): boolean {
  return question.id.startsWith("q-") && (question.type === "ORDINAL" || question.type === "SJT") && question.options.length >= 4 && question.options.length <= 5;
}

export function validateQuestionInput(input: QuestionBankInput): string[] {
  const issues: string[] = [];
  if (!input.reference?.trim()) issues.push("A stable question reference is required.");
  if (!(input.prompt ?? input.question ?? "").trim()) issues.push("A question prompt is required.");
  if (!input.dimension) issues.push("A dimension is required.");
  if (scoredTypes.has(input.type) && ![1, 2, 3].includes(input.qWeight as number)) issues.push("Scored questions require qWeight 1, 2, or 3.");
  if (scoredTypes.has(input.type) && input.max !== 5) issues.push("Scored questions must use the standard maximum of 5.");
  if (!scoredTypes.has(input.type) && input.qWeight !== null) issues.push("GATE and EVIDENCE questions cannot use qWeight.");
  if (!scoredTypes.has(input.type) && input.max !== null) issues.push("GATE and EVIDENCE questions cannot use a score ceiling.");
  const options = input.options ?? [];
  if (input.type === "GATE") { const gateOptions = input.config?.gateConfig?.options ?? options; if (gateOptions.length !== 2) issues.push("GATE questions require exactly two binary options."); if (gateOptions.some((option) => !option.gateOutcome)) issues.push("Each GATE option requires a pass, fail, or integrity-flag outcome."); }
  if (input.type === "ORDINAL") { if (options.length < 4 || options.length > 5) issues.push("ORDINAL questions require four or five options."); if (options.some((option) => option.outcome !== "close" && (option.rawPoints === undefined || option.rawPoints < 0 || option.rawPoints > 5))) issues.push("Scored ORDINAL options require raw points from 0 to 5."); }
  if (input.type === "MULTI") { if (options.length < 2) issues.push("MULTI questions require at least two options."); if (options.some((option) => option.rawPoints === undefined || option.rawPoints < -1 || option.rawPoints > 5)) issues.push("MULTI options require raw points from −1 to 5."); const cap = input.config?.multiConfig?.scoreCap; if (cap === undefined || cap <= 0 || cap > 5) issues.push("MULTI score cap must be greater than 0 and no higher than 5."); }
  if (input.type === "SJT") { if (options.length !== 4) issues.push("SJT questions require exactly four options."); if (options.some((option) => option.rawPoints === undefined || option.rawPoints < -2 || option.rawPoints > 5)) issues.push("SJT options require raw scores from −2 to 5."); }
  if (input.type === "NUMERIC") { const config = input.config?.numericConfig; if (!config?.bands.length) issues.push("NUMERIC questions require at least one scoring band."); if (config?.bands.some((band) => band.rawPoints < 0 || band.rawPoints > 5 || (band.upperBound !== undefined && band.upperBound < band.lowerBound))) issues.push("Numeric bands must have valid bounds and raw points from 0 to 5."); }
  if (input.type === "OPEN" && input.config?.openConfig?.rubric.length === 0) issues.push("OPEN questions intended for scoring require at least one rubric anchor.");
  if (input.type === "EVIDENCE") { const config = input.config?.evidenceConfig; if (!config?.pairedQuestionRef.trim()) issues.push("EVIDENCE questions require a paired question reference."); if (!config?.options.length || config.options.some((option) => ![1, 0.95, 0.85].includes(option.verificationMultiplier as number))) issues.push("Every EVIDENCE option requires a 1.00, 0.95, or 0.85 verification multiplier."); }
  return issues;
}

function nextReference(questions: QuestionBankQuestion[]) { const last = questions.reduce((highest, question) => Math.max(highest, Number(question.reference.replace("Q-", "")) || 0), 0); return `Q-${String(last + 1).padStart(3, "0")}`; }
function saveQuestions(questions: QuestionBankQuestion[]) { saveStorage(QUESTION_BANK_STORAGE_KEY, questions); return questions; }
function saveScores(scores: QuestionScoreMap) { saveStorage(QUESTION_SCORE_STORAGE_KEY, scores); return scores; }
function completeInput(input: QuestionBankInput, fallbackReference: string): QuestionBankQuestion {
  const dimension = QUESTION_BANK_DIMENSIONS.find((item) => item.code === input.dimension) ?? dimensionForLegacyCompetency(input.competency ?? "");
  const prompt = (input.prompt ?? input.question ?? "").trim();
  const options = labelOptions(input.options ?? []);
  return { ...input, id: "", reference: input.reference?.trim() || fallbackReference, dimension: dimension.code, dimensionLabel: dimension.label, type: input.type, qWeight: input.qWeight ?? (scoredTypes.has(input.type) ? 2 : null), max: scoredTypes.has(input.type) ? 5 : null, required: input.required ?? true, prompt, helpText: input.helpText?.trim() ?? "", status: input.status, evidenceRef: input.evidenceRef?.trim() ?? "", flagIf: input.flagIf?.trim() ?? "", timeLimitSec: input.timeLimitSec ?? null, usedIn: "Not assigned", config: input.config ?? defaultConfigFor(input.type, options), competency: dimension.label, question: prompt, options };
}
export function createQuestionBankQuestion(input: QuestionBankInput, scores: Record<string, number> = {}) { const questions = getQuestionBankQuestions(); const question = completeInput(input, nextReference(questions)); const id = `q-${crypto.randomUUID().slice(0, 8)}`; const created = { ...question, id }; saveQuestions([...questions, created]); saveScores({ ...getQuestionBankScores(), [id]: scores }); return created; }
export function updateQuestionBankQuestion(id: string, input: QuestionBankInput, scores: Record<string, number> = {}) { let updated: QuestionBankQuestion | undefined; const questions = getQuestionBankQuestions().map((question) => { if (question.id !== id) return question; const replacement = completeInput(input, question.reference); updated = { ...replacement, id: question.id, reference: question.reference, usedIn: question.usedIn }; return updated; }); if (!updated) return undefined; saveQuestions(questions); saveScores({ ...getQuestionBankScores(), [id]: scores }); return updated; }
