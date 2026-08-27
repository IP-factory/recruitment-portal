/** Quiet Authority Overall Fit scoring: Admin-only deterministic combination of existing Assessment and CV Evidence results; never a decision, ranking, or applicant-facing score. */
import { calculateAssessmentScore, getAssessmentInterpretation, type AssessmentScoreResult } from "@/lib/assessmentScoring";
import { calculateCvEvidenceScore, type CvEvidenceScoreResult } from "@/lib/cvEvidenceScoring";
import type { AdminApplication } from "@/lib/adminMockData";

export const overallFitWeights = { assessment: 70, cvEvidence: 30 } as const;
export type OverallFitUnavailableReason = "invalid-component-weights" | "assessment-unavailable" | "cv-evidence-unavailable";
export type OverallFitResult = {
  overallFitReady: boolean;
  assessmentScore: number | null;
  assessmentWeight: number;
  assessmentContribution: number | null;
  cvEvidenceScore: number | null;
  cvEvidenceWeight: number;
  cvEvidenceContribution: number | null;
  overallFitScore: number | null;
  overallFitScoreDisplay: number | null;
  interpretation: "Strong" | "Good" | "Moderate" | "Limited" | null;
  reasonUnavailable: OverallFitUnavailableReason | null;
  assessmentResult: AssessmentScoreResult;
  cvEvidenceResult: CvEvidenceScoreResult;
};

export function formatOverallFitContribution(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ""); }

export function calculateOverallFit(application: AdminApplication): OverallFitResult {
  const assessmentResult = calculateAssessmentScore(application);
  const cvEvidenceResult = calculateCvEvidenceScore(application.id);
  const base = {
    assessmentWeight: overallFitWeights.assessment,
    cvEvidenceWeight: overallFitWeights.cvEvidence,
    assessmentResult,
    cvEvidenceResult,
  };
  if (overallFitWeights.assessment + overallFitWeights.cvEvidence !== 100) {
    return { ...base, overallFitReady: false, assessmentScore: null, assessmentContribution: null, cvEvidenceScore: null, cvEvidenceContribution: null, overallFitScore: null, overallFitScoreDisplay: null, interpretation: null, reasonUnavailable: "invalid-component-weights" };
  }
  if (assessmentResult.state !== "available") {
    return { ...base, overallFitReady: false, assessmentScore: null, assessmentContribution: null, cvEvidenceScore: cvEvidenceResult.cvEvidenceScore, cvEvidenceContribution: null, overallFitScore: null, overallFitScoreDisplay: null, interpretation: null, reasonUnavailable: "assessment-unavailable" };
  }
  if (cvEvidenceResult.state !== "available") {
    return { ...base, overallFitReady: false, assessmentScore: assessmentResult.rawPercentage, assessmentContribution: null, cvEvidenceScore: null, cvEvidenceContribution: null, overallFitScore: null, overallFitScoreDisplay: null, interpretation: null, reasonUnavailable: "cv-evidence-unavailable" };
  }
  const assessmentScore = assessmentResult.rawPercentage!;
  const cvEvidenceScore = cvEvidenceResult.cvEvidenceScore!;
  const assessmentContribution = assessmentScore * overallFitWeights.assessment / 100;
  const cvEvidenceContribution = cvEvidenceScore * overallFitWeights.cvEvidence / 100;
  const overallFitScore = assessmentContribution + cvEvidenceContribution;
  const overallFitScoreDisplay = Math.round(overallFitScore);
  return { ...base, overallFitReady: true, assessmentScore, assessmentContribution, cvEvidenceScore, cvEvidenceContribution, overallFitScore, overallFitScoreDisplay, interpretation: getAssessmentInterpretation(overallFitScoreDisplay), reasonUnavailable: null };
}

export function getOverallFitDisplay(application: AdminApplication) {
  const result = calculateOverallFit(application);
  return result.overallFitReady ? `${result.overallFitScoreDisplay}%` : null;
}
