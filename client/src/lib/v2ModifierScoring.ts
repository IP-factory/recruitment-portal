import type { QuestionBankQuestion } from "@/lib/questionBankData";
import type { V2Answers, V2BaseScoringResult } from "@/lib/v2BaseScoring";

export const V2_VERIFICATION_MULTIPLIERS = { fully: 1, partial: 0.95, materialClaimsUnverified: 0.85 } as const;
export const V2_INTEGRITY_PENALTY = 10;
export const V2_BONUS_CAP = 5;
export const V2_DIMENSION_FLOORS = { D1: 50, D2: 40, D5: 50 } as const;
export const V2_SCREENING_BANDS = [
  { band: "A", minimum: 80, label: "Fast-track review" },
  { band: "B", minimum: 65, label: "Interview pool" },
  { band: "C", minimum: 50, label: "Hold / further review" },
  { band: "D", minimum: 0, label: "Close-out review" },
] as const;
export const V2_BONUS_ITEMS = [
  { id: "diplomatic-account", label: "Owned a diplomatic or embassy account directly", points: 3 },
  { id: "french-arabic", label: "French or Arabic working proficiency", points: 2 },
  { id: "commercial-certification", label: "Revenue-management or hospitality commercial certification", points: 2 },
] as const;

export type V2IntegrityStatus = "Clear" | "Flagged" | "Confirmed" | "Dismissed";
export type V2IntegrityFlag = { id: string; source: string; description: string; status: V2IntegrityStatus; penalty: number };
export type V2VerificationResult = { multiplier?: number; label: string; evidenceResults: Array<{ reference: string; multiplier?: number; label: string; state: "completed" | "unresolved" }>; reason?: string };
export type V2BonusResult = { items: Array<(typeof V2_BONUS_ITEMS)[number] & { confirmed: boolean }>; rawBonus: number; appliedBonus: number };
export type V2FloorResult = { dimensionId: keyof typeof V2_DIMENSION_FLOORS; score?: number; floor: number; passed: boolean };
export type V2ModifierResult = {
  scoringReady: boolean;
  verification: V2VerificationResult;
  integrity: { flags: V2IntegrityFlag[]; confirmedCount: number; totalPenalty: number; manualReviewRequired: boolean };
  bonus: V2BonusResult;
  finalScoreBeforeBounds?: number;
  finalScore?: number;
  floorResults: V2FloorResult[];
  rawBand?: (typeof V2_SCREENING_BANDS)[number];
  appliedBand?: (typeof V2_SCREENING_BANDS)[number];
  bandCapReason?: string;
  unresolvedItems: string[];
};

const evidenceMultiplierLabel = (multiplier: number) => multiplier === 1 ? "Fully verified" : multiplier === 0.95 ? "Partial verification" : "Material claims not verified";
const optionFor = (question: QuestionBankQuestion, id: string) => (question.config.evidenceConfig?.options ?? question.options).find((option) => option.id === id);
const asRecord = (answer: V2Answers[string]) => answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
const yearsFromAnswer = (question: QuestionBankQuestion | undefined, answer: V2Answers[string], currentYear: number) => {
  if (!question || question.type !== "NUMERIC") return undefined;
  const value = asRecord(answer);
  if (question.config.numericConfig?.mode !== "calendarYearExperience") return undefined;
  if (value.never === true) return 0;
  if (typeof value.year !== "string" || !/^\d{4}$/.test(value.year)) return undefined;
  return currentYear - Number(value.year);
};
const attainmentFromAnswer = (question: QuestionBankQuestion | undefined, answer: V2Answers[string]) => {
  if (!question || question.type !== "NUMERIC" || question.config.numericConfig?.mode !== "twoValueDerived") return undefined;
  const value = asRecord(answer);
  const target = Number(value.target); const actual = Number(value.actual);
  return Number.isFinite(target) && target > 0 && Number.isFinite(actual) && actual >= 0 ? actual / target * 100 : undefined;
};
const findBandFor = (question: QuestionBankQuestion, value: number) => question.config.numericConfig?.bands.find((band) => value >= band.lowerBound && (band.upperBound === undefined || value <= band.upperBound));
const rounded = (value: number) => Number(value.toFixed(1));

export function deriveV2Verification(questions: readonly QuestionBankQuestion[], answers: V2Answers): V2VerificationResult {
  const evidenceQuestions = questions.filter((question) => question.type === "EVIDENCE");
  const evidenceResults = evidenceQuestions.map((question) => {
    const answer = answers[question.id];
    const option = typeof answer === "string" ? optionFor(question, answer) : undefined;
    const multiplier = option?.verificationMultiplier;
    return { reference: question.reference, multiplier, label: multiplier === undefined ? "Awaiting evidence response" : evidenceMultiplierLabel(multiplier), state: multiplier === undefined ? "unresolved" as const : "completed" as const };
  });
  if (evidenceResults.some((result) => result.state === "unresolved")) return { label: "Verification multiplier · current evidence set", evidenceResults, reason: "Evidence response unresolved." };
  const multiplier = evidenceResults.length ? Math.min(...evidenceResults.map((result) => result.multiplier!)) : 1;
  return { multiplier, label: `Verification multiplier · current evidence set · ${evidenceMultiplierLabel(multiplier)}`, evidenceResults };
}

export function evaluateV2IntegrityFlags(questions: readonly QuestionBankQuestion[], answers: V2Answers, statuses: Record<string, V2IntegrityStatus> = {}, currentYear = new Date().getFullYear()): V2IntegrityFlag[] {
  const byReference = (reference: string) => questions.find((question) => question.reference === reference);
  const flags: V2IntegrityFlag[] = [];
  const d1q1 = byReference("D1.Q1"); const d1q2 = byReference("D1.Q2");
  const d1Answer = answers[d1q1?.id ?? ""]; const d1Years = yearsFromAnswer(d1q2, answers[d1q2?.id ?? ""], currentYear);
  const expectedYears: Record<string, number> = { a: 10, b: 4, c: 0 };
  if (typeof d1Answer === "string" && d1Years !== undefined && expectedYears[d1Answer] !== undefined && Math.abs(d1Years - expectedYears[d1Answer]) > 2) flags.push({ id: "integrity-d1-history", source: "D1.Q1 / D1.Q2", description: "Business Development target-ownership history is inconsistent across responses.", status: statuses["integrity-d1-history"] ?? "Flagged", penalty: V2_INTEGRITY_PENALTY });
  const d2q3 = byReference("D2.Q3"); const d2q2 = byReference("D2.Q2");
  const d2q3Answer = answers[d2q3?.id ?? ""]; const d2q3Options = d2q3 ? (d2q3.config.ordinalConfig?.options ?? d2q3.options) : []; const d2q3Option = typeof d2q3Answer === "string" ? d2q3Options.find((option) => option.id === d2q3Answer) : undefined;
  const attainment = attainmentFromAnswer(d2q2, answers[d2q2?.id ?? ""]);
  if (d2q3Option?.text === "I consistently exceeded my targets" && attainment !== undefined && attainment < 100) flags.push({ id: "integrity-d2-attainment", source: "D2.Q3 / D2.Q2", description: "Self-described target performance conflicts with the submitted target-attainment figures.", status: statuses["integrity-d2-attainment"] ?? "Flagged", penalty: V2_INTEGRITY_PENALTY });
  if (byReference("D4.Q1") && byReference("D4.Q2")) flags.push({ id: "integrity-d4-manual", source: "D4.Q1 / D4.Q2", description: "Manual review required for the Abuja relationship selection and written response.", status: statuses["integrity-d4-manual"] ?? "Clear", penalty: V2_INTEGRITY_PENALTY });
  return flags;
}

export function calculateV2Modifiers(base: V2BaseScoringResult, questions: readonly QuestionBankQuestion[], answers: V2Answers, integrityStatuses: Record<string, V2IntegrityStatus> = {}, bonusConfirmed: Record<string, boolean> = {}, currentYear = new Date().getFullYear()): V2ModifierResult {
  const verification = deriveV2Verification(questions, answers);
  const flags = evaluateV2IntegrityFlags(questions, answers, integrityStatuses, currentYear);
  const confirmedFlags = flags.filter((flag) => flag.status === "Confirmed");
  const bonusItems = V2_BONUS_ITEMS.map((item) => ({ ...item, confirmed: bonusConfirmed[item.id] === true }));
  const rawBonus = bonusItems.filter((item) => item.confirmed).reduce((sum, item) => sum + item.points, 0);
  const appliedBonus = Math.min(V2_BONUS_CAP, rawBonus);
  const floorResults = (Object.keys(V2_DIMENSION_FLOORS) as Array<keyof typeof V2_DIMENSION_FLOORS>).map((dimensionId) => { const dimension = base.dimensionResults.find((item) => item.dimensionId === dimensionId); const floor = V2_DIMENSION_FLOORS[dimensionId]; return { dimensionId, score: dimension?.score, floor, passed: typeof dimension?.score === "number" && dimension.score >= floor }; });
  const unresolvedItems = [...base.unresolvedItems.map((item) => item.reason), ...(verification.reason ? [verification.reason] : [])];
  const multiplier = verification.multiplier;
  const scoringReady = base.scoringReady && multiplier !== undefined;
  if (!scoringReady) return { scoringReady: false, verification, integrity: { flags, confirmedCount: confirmedFlags.length, totalPenalty: confirmedFlags.length * V2_INTEGRITY_PENALTY, manualReviewRequired: confirmedFlags.length >= 2 }, bonus: { items: bonusItems, rawBonus, appliedBonus }, floorResults, unresolvedItems };
  const finalScoreBeforeBounds = base.baseAssessmentScore! * multiplier - confirmedFlags.length * V2_INTEGRITY_PENALTY + appliedBonus;
  const finalScore = Math.min(100, Math.max(0, finalScoreBeforeBounds));
  const rawBand = V2_SCREENING_BANDS.find((band) => finalScore >= band.minimum) ?? V2_SCREENING_BANDS[V2_SCREENING_BANDS.length - 1];
  const failedFloors = floorResults.filter((floor) => !floor.passed);
  const appliedBand = failedFloors.length && rawBand.band < "C" ? V2_SCREENING_BANDS.find((band) => band.band === "C")! : rawBand;
  return { scoringReady: true, verification, integrity: { flags, confirmedCount: confirmedFlags.length, totalPenalty: confirmedFlags.length * V2_INTEGRITY_PENALTY, manualReviewRequired: confirmedFlags.length >= 2 }, bonus: { items: bonusItems, rawBonus, appliedBonus }, finalScoreBeforeBounds, finalScore, floorResults, rawBand, appliedBand, bandCapReason: failedFloors.length ? failedFloors.map((floor) => `${floor.dimensionId} minimum floor not met`).join("; ") : undefined, unresolvedItems };
}
