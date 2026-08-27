/** Quiet Authority CV Evidence scoring: deterministic Admin-only arithmetic over configured active criteria and explicit manual ratings. */
import { getCandidateCvEvidenceReviewSummary, type CandidateCriterionEvidence } from "@/lib/candidateCvEvidenceData";
import { BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID } from "@/lib/adminRoleData";
import { getRoleCvCriteria, type CvEvidenceCriterion } from "@/lib/roleCvCriteriaData";

export type CvEvidenceScoreUnavailableReason = "incomplete-ratings" | "invalid-total-weight" | "no-active-criteria";
export type CvEvidenceCriterionBreakdown = { criterionId: string; criterionName: string; rating: number; weight: number; contribution: number };
export type CvEvidenceScoreResult = {
  state: "available" | "unavailable";
  scoringReady: boolean;
  cvEvidenceScore: number | null;
  cvEvidenceScoreDisplay: number | null;
  interpretation: "Strong" | "Good" | "Moderate" | "Limited" | null;
  activeCriteriaCount: number;
  ratedCriteriaCount: number;
  totalActiveWeight: number;
  criterionBreakdown: CvEvidenceCriterionBreakdown[];
  reasonUnavailable: CvEvidenceScoreUnavailableReason | null;
};

const scoreInterpretation = (score: number) => score >= 80 ? "Strong" : score >= 65 ? "Good" : score >= 50 ? "Moderate" : "Limited";
const criteriaForRole = () => getRoleCvCriteria(BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID);

export function formatCvEvidenceContribution(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ""); }

export function calculateCvEvidenceScore(applicationId: string, configuredCriteria: CvEvidenceCriterion[] = criteriaForRole(), currentReviews?: CandidateCriterionEvidence[]): CvEvidenceScoreResult {
  const review = getCandidateCvEvidenceReviewSummary(applicationId, configuredCriteria);
  const activeCriteria = review.activeCriteria;
  const reviews = currentReviews ?? review.reviews;
  const totalActiveWeight = activeCriteria.reduce((total, criterion) => total + criterion.weight, 0);
  const ratedCriteriaCount = reviews.filter((item) => item.rating !== null).length;
  const allRated = activeCriteria.length > 0 && ratedCriteriaCount === activeCriteria.length;
  const base = { activeCriteriaCount: activeCriteria.length, ratedCriteriaCount, totalActiveWeight, criterionBreakdown: [] as CvEvidenceCriterionBreakdown[] };
  if (!activeCriteria.length) return { ...base, state: "unavailable", scoringReady: false, cvEvidenceScore: null, cvEvidenceScoreDisplay: null, interpretation: null, reasonUnavailable: "no-active-criteria" };
  if (totalActiveWeight !== 100) return { ...base, state: "unavailable", scoringReady: false, cvEvidenceScore: null, cvEvidenceScoreDisplay: null, interpretation: null, reasonUnavailable: "invalid-total-weight" };
  if (!allRated) return { ...base, state: "unavailable", scoringReady: false, cvEvidenceScore: null, cvEvidenceScoreDisplay: null, interpretation: null, reasonUnavailable: "incomplete-ratings" };
  const criterionBreakdown = activeCriteria.map((criterion) => { const rating = reviews.find((item) => item.criterionId === criterion.id)?.rating; const safeRating = typeof rating === "number" ? rating : 0; return { criterionId: criterion.id, criterionName: criterion.name, rating: safeRating, weight: criterion.weight, contribution: safeRating / 5 * criterion.weight }; });
  const cvEvidenceScore = criterionBreakdown.reduce((total, item) => total + item.contribution, 0); const cvEvidenceScoreDisplay = Math.round(cvEvidenceScore);
  return { ...base, criterionBreakdown, state: "available", scoringReady: true, cvEvidenceScore, cvEvidenceScoreDisplay, interpretation: scoreInterpretation(cvEvidenceScoreDisplay), reasonUnavailable: null };
}
