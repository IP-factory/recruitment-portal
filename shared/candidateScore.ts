/**
 * Task 24G — Overall Candidate Score derivation.
 *
 * This helper lives COMPLETELY OUTSIDE the assessment scoring engine. The
 * engine (Base Assessment Score, dimensions, verification, integrity, bonus,
 * Applied Band) never sees the CV score; the CV score never feeds back into
 * it. The Overall Candidate Score is a derived, display-level value:
 *
 *   Overall Candidate Score = (Assessment Score + CV Score) / 2
 *
 * Missing values are never coerced to zero — the Overall score only exists
 * once BOTH inputs exist. A CV score of exactly 0 is a valid reviewed score.
 */

/**
 * Equal 50/50 average, only when both scores exist.
 * Returns null when either score is missing (never treats missing as 0).
 */
export function calculateOverallCandidateScore(
  assessmentScore: number | null | undefined,
  cvScore: number | null | undefined,
): number | null {
  if (assessmentScore === null || assessmentScore === undefined) return null;
  if (cvScore === null || cvScore === undefined) return null;
  return (assessmentScore + cvScore) / 2;
}

/** Format an existing score consistently with the portal's 1-decimal display. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Human label for the CV score column.
 * - reviewed → formatted score (0 is valid and displays "0.0")
 * - uploaded but not reviewed → "Pending review"
 * - no CV at all → "Not uploaded"
 */
export function describeCvScore(cvScore: number | null | undefined, cvUploaded: boolean): string {
  if (cvScore !== null && cvScore !== undefined) return formatScore(cvScore);
  return cvUploaded ? "Pending review" : "Not uploaded";
}

/**
 * Human label for the Overall Candidate Score column:
 * - both scores exist → formatted average
 * - assessment exists, CV missing → "Pending CV review"
 * - CV exists, assessment missing → "Pending assessment"
 * - neither → "Pending"
 */
export function describeOverallCandidateScore(
  assessmentScore: number | null | undefined,
  cvScore: number | null | undefined,
): string {
  const overall = calculateOverallCandidateScore(assessmentScore, cvScore);
  if (overall !== null) return formatScore(overall);
  const hasAssessment = assessmentScore !== null && assessmentScore !== undefined;
  const hasCv = cvScore !== null && cvScore !== undefined;
  if (hasAssessment && !hasCv) return "Pending CV review";
  if (hasCv && !hasAssessment) return "Pending assessment";
  return "Pending";
}

/**
 * Server-authoritative CV score validation: numeric, 0–100 inclusive, at most
 * one decimal place (matches the decimal(5,1) column). 0 is a valid reviewed
 * score and must not be mistaken for "missing".
 */
export function validateCvScoreInput(candidate: unknown): { score: number } | { error: string } {
  const value = typeof candidate === "string" && candidate.trim() !== "" ? Number(candidate.trim()) : typeof candidate === "number" ? candidate : NaN;
  if (!Number.isFinite(value)) return { error: "Enter a numeric CV score." };
  if (value < 0 || value > 100) return { error: "The CV score must be between 0 and 100." };
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(value - rounded) > 1e-9) return { error: "The CV score may have at most one decimal place." };
  return { score: rounded };
}
