/**
 * Task 24D-2 — shared Admin Application API contract.
 *
 * Types, validation and constants for the Admin scoring, review and
 * shortlisting endpoints. This module is shared between server and client
 * to keep the API contract consistent.
 */

// ── Admin application status ──────────────────────────────────────────────────

export const ADMIN_APPLICATION_STATUSES = [
  "Submitted",
  "Under Review",
  "Shortlisted",
  "Hold",
  "Closed",
] as const;

export type AdminApplicationStatus = (typeof ADMIN_APPLICATION_STATUSES)[number];

// ── Scoring status ────────────────────────────────────────────────────────────

export const EVALUATION_STATUSES = [
  "Pending Assessment",
  "Pending OPEN Review",
  "Scored",
  "Manual Review Required",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

// ── Band types ────────────────────────────────────────────────────────────────

export const SCREENING_BANDS = ["A", "B", "C", "D"] as const;
export type ScreeningBand = (typeof SCREENING_BANDS)[number];

// ── Integrity flag status ─────────────────────────────────────────────────────

export const INTEGRITY_FLAG_STATUSES = ["Clear", "Flagged", "Confirmed", "Dismissed"] as const;
export type IntegrityFlagStatus = (typeof INTEGRITY_FLAG_STATUSES)[number];

// ── Bonus types ───────────────────────────────────────────────────────────────

export const BONUS_TYPES = [
  { code: "diplomatic-account", label: "Direct ownership of embassy/diplomatic account", points: 3 },
  { code: "french-arabic", label: "French or Arabic working proficiency", points: 2 },
  { code: "commercial-certification", label: "Revenue-management / hospitality commercial certification", points: 2 },
] as const;

export const BONUS_CAP = 5;
export const INTEGRITY_PENALTY_PER_FLAG = 10;

export type BonusTypeCode = (typeof BONUS_TYPES)[number]["code"];

// ── Dimension floor rules (BDO reference — scorer reads from DB) ──────────────
// The scoring engine loads weights and floors from the assessmentDimensions
// table, so these constants are never used in production scoring. They
// document the original BDO seed values only.
// @deprecated — use assessmentDimensions table rows instead.
export const DIMENSION_FLOORS: Record<string, number> = { D1: 50, D2: 40, D5: 50 };

// @deprecated — use assessmentDimensions table rows instead.
export const DIMENSION_WEIGHTS: Record<string, number> = {
  D1: 22, D2: 18, D3: 14, D4: 12, D5: 12, D6: 8, D7: 8, D8: 6,
};

// ── Band thresholds ───────────────────────────────────────────────────────────

export const BAND_THRESHOLDS = [
  { band: "A" as const, minimum: 80, label: "Fast-track review" },
  { band: "B" as const, minimum: 65, label: "Interview pool" },
  { band: "C" as const, minimum: 50, label: "Hold / further review" },
  { band: "D" as const, minimum: 0, label: "Close-out review" },
];

export interface AdminApplicationSummary {
  id: string;
  fullName: string;
  email: string;
  roleTitle: string;
  eligibilityStatus: string;
  assessmentStatus: string;
  applicationStatus: string;
  finalScore: number | null;
  appliedBand: ScreeningBand | null;
  evaluationStatus: EvaluationStatus | null;
  /** Task 24G — manually assigned CV score (0–100); null until reviewed. */
  cvScore: number | null;
  /** Task 24G — whether the applicant uploaded a CV. */
  cvUploaded: boolean;
  shortlisted: boolean;
  submittedAt: string | null;
  createdAt: string;
}

/** Task 24G — applicant-safe CV metadata surfaced to Admin (no storage key). */
export interface AdminCvFileDetail {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

/** Task 24G — manual CV review record (never part of the assessment engine). */
export interface AdminCvReviewDetail {
  score: number;
  reviewNote: string | null;
  reviewedAt: string;
}

export interface AdminApplicationDetail extends AdminApplicationSummary {
  phone: string;
  city: string;
  /**
   * New: current employment/career status (stored in the recent_role column).
   * For applications created after the form update this holds a status option
   * such as "Currently employed". For historical records it holds the old
   * freetext job title. Use currentStatus for display; fall back to recentRole
   * for compatibility when rendering historical records.
   */
  currentStatus: string;
  /**
   * New: free-text detail when currentStatus is "Other" (stored in
   * recent_employer column). For historical records recentEmployer holds the
   * old employer name. Both are surfaced so consumers can decide which to show.
   */
  currentStatusOther: string | null;
  /** Legacy alias — same value as currentStatus; retained for backward-compat. */
  recentRole: string;
  /** Legacy alias — same value as currentStatusOther; retained for backward-compat. */
  recentEmployer: string | null;
  totalExperience: string;
  /** Historical BD experience field — no longer collected for new applications. */
  relevantExperience: string;
  linkedinUrl: string | null;
  eligibilityResponses: Array<{
    gateReference: string;
    outcome: string;
    internalFlag: string | null;
  }>;
  assessmentResponses: Array<{
    questionId: string;
    questionReference: string;
    questionType: string;
    prompt: string;
    responsePayload: unknown;
    elapsedSeconds: number | null;
  }>;
  /** Task 24G — uploaded CV metadata, or null when no CV was uploaded. */
  cv: AdminCvFileDetail | null;
  /** Task 24G — saved manual CV review, or null until reviewed. */
  cvReview: AdminCvReviewDetail | null;
}

export interface AdminEvaluationDetail {
  applicationId: string;
  evaluationStatus: EvaluationStatus;
  baseAssessmentScore: number | null;
  verificationMultiplier: number | null;
  integrityPenalty: number | null;
  bonus: number | null;
  finalScreeningScore: number | null;
  rawBand: ScreeningBand | null;
  appliedBand: ScreeningBand | null;
  floorMissed: string | null;
  manualReviewRequired: boolean;
  dimensions: Array<{
    dimensionId: string;
    dimensionReference: string;
    normalizedScore: number;
    weight: number;
    weightedContribution: number;
    floor: number | null;
    floorStatus: string | null;
  }>;
  openReviews: Array<{
    questionId: string;
    questionReference: string;
    prompt: string;
    candidateResponse: string;
    rawScore: number;
    reviewNote: string | null;
    rubricAnchors: Array<{ scoreMin: number; scoreMax: number; anchorText: string }>;
  }>;
  pendingOpenQuestions: Array<{
    questionId: string;
    questionReference: string;
    prompt: string;
    candidateResponse: string;
    rubricAnchors: Array<{ scoreMin: number; scoreMax: number; anchorText: string }>;
  }>;
  integrityFlags: Array<{
    id: string;
    source: string;
    description: string;
    status: IntegrityFlagStatus;
  }>;
  bonusReviews: Array<{
    bonusType: string;
    label: string;
    points: number;
    confirmed: boolean;
    note: string | null;
  }>;
  questionScores: Array<{
    questionId: string;
    questionReference: string;
    questionType: string;
    rawScore: number | null;
    maxScore: number | null;
    qWeight: number | null;
    dimensionReference: string | null;
  }>;
}

export interface AdminApplicationListResponse {
  ok: true;
  applications: AdminApplicationSummary[];
  counts: {
    total: number;
    submitted: number;
    pendingReview: number;
    shortlisted: number;
  };
}

// ── Input validation ──────────────────────────────────────────────────────────

export interface SaveOpenReviewInput {
  rawScore: number;
  note?: string;
}

export interface UpdateIntegrityFlagInput {
  status: "Confirmed" | "Dismissed";
}

export interface UpdateBonusInput {
  confirmed: boolean;
  note?: string;
}

export interface UpdateShortlistInput {
  shortlisted: boolean;
}

export interface UpdateApplicationStatusInput {
  status: AdminApplicationStatus;
}

export function validateOpenReviewInput(input: unknown): { ok: true; input: SaveOpenReviewInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input as Record<string, unknown>;
  if (typeof obj.rawScore !== "number" || !Number.isInteger(obj.rawScore) || obj.rawScore < 0 || obj.rawScore > 5) {
    errors.push("Raw score must be an integer between 0 and 5.");
  }
  if (obj.note !== undefined && typeof obj.note !== "string") {
    errors.push("Note must be a string.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { rawScore: obj.rawScore as number, note: typeof obj.note === "string" ? obj.note : undefined } };
}

export function validateIntegrityFlagInput(input: unknown): { ok: true; input: UpdateIntegrityFlagInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input as Record<string, unknown>;
  if (obj.status !== "Confirmed" && obj.status !== "Dismissed") {
    errors.push("Status must be Confirmed or Dismissed.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { status: obj.status as "Confirmed" | "Dismissed" } };
}

export function validateBonusInput(input: unknown): { ok: true; input: UpdateBonusInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input as Record<string, unknown>;
  if (typeof obj.confirmed !== "boolean") errors.push("Confirmed must be a boolean.");
  if (obj.note !== undefined && typeof obj.note !== "string") errors.push("Note must be a string.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { confirmed: obj.confirmed as boolean, note: typeof obj.note === "string" ? obj.note : undefined } };
}

export function validateShortlistInput(input: unknown): { ok: true; input: UpdateShortlistInput } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || typeof (input as Record<string, unknown>).shortlisted !== "boolean") {
    return { ok: false, errors: ["Shortlisted must be a boolean."] };
  }
  return { ok: true, input: { shortlisted: (input as Record<string, unknown>).shortlisted as boolean } };
}

export function validateApplicationStatusInput(input: unknown): { ok: true; input: UpdateApplicationStatusInput } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input as Record<string, unknown>;
  if (typeof obj.status !== "string" || !ADMIN_APPLICATION_STATUSES.includes(obj.status as AdminApplicationStatus)) {
    return { ok: false, errors: [`Status must be one of: ${ADMIN_APPLICATION_STATUSES.join(", ")}`] };
  }
  return { ok: true, input: { status: obj.status as AdminApplicationStatus } };
}

// ── Scoring helpers (shared between server and tests) ─────────────────────────

export function resolveBand(score: number): ScreeningBand {
  for (const threshold of BAND_THRESHOLDS) {
    if (score >= threshold.minimum) return threshold.band;
  }
  return "D";
}

export function applyFloorCap(rawBand: ScreeningBand, floorMissed: boolean): { appliedBand: ScreeningBand; reason?: string } {
  if (floorMissed && (rawBand === "A" || rawBand === "B")) {
    return { appliedBand: "C", reason: "Dimension floor missed" };
  }
  return { appliedBand: rawBand };
}

export function calculateFinalScore(base: number, verification: number, penalty: number, bonus: number): number {
  return Math.min(100, Math.max(0, base * verification - penalty + bonus));
}
