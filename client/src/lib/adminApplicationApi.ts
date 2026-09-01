/**
 * Task 24D-2 — client Admin Application API module.
 *
 * Fetch layer for real application listing, candidate detail, evaluation,
 * OPEN review, integrity flags, bonuses, shortlisting, and status management.
 * All endpoints require Task 24B Admin session cookie.
 */
import type {
  AdminApplicationDetail,
  AdminApplicationListResponse,
  AdminApplicationSummary,
  AdminEvaluationDetail,
  SaveOpenReviewInput,
  UpdateIntegrityFlagInput,
  UpdateBonusInput,
  UpdateShortlistInput,
  UpdateApplicationStatusInput,
  EvaluationStatus,
  ScreeningBand,
  AdminApplicationStatus,
  IntegrityFlagStatus,
} from "@shared/adminApplicationApi";

export type {
  AdminApplicationDetail,
  AdminApplicationListResponse,
  AdminApplicationSummary,
  AdminApplicationStatus,
  AdminCvFileDetail,
  AdminCvReviewDetail,
  AdminEvaluationDetail,
  EvaluationStatus,
  IntegrityFlagStatus,
  SaveOpenReviewInput,
  ScreeningBand,
  UpdateApplicationStatusInput,
  UpdateBonusInput,
  UpdateIntegrityFlagInput,
  UpdateShortlistInput,
} from "@shared/adminApplicationApi";

export {
  ADMIN_APPLICATION_STATUSES,
  BAND_THRESHOLDS,
  BONUS_CAP,
  BONUS_TYPES,
  DIMENSION_FLOORS,
  DIMENSION_WEIGHTS,
  EVALUATION_STATUSES,
  INTEGRITY_FLAG_STATUSES,
  INTEGRITY_PENALTY_PER_FLAG,
  SCREENING_BANDS,
  applyFloorCap,
  calculateFinalScore,
  resolveBand,
} from "@shared/adminApplicationApi";

export class AdminApplicationApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApplicationApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const msg = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : "Unable to load application data.";
    throw new AdminApplicationApiError(response.status, msg);
  }
  return body as T;
}

const jsonBody = (input: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

// ── Application list ──────────────────────────────────────────────────────────

export async function fetchAdminApplications(): Promise<AdminApplicationListResponse> {
  return request<AdminApplicationListResponse>("/api/admin/applications");
}

// ── Application detail ────────────────────────────────────────────────────────

export interface AdminApplicationDetailResponse {
  ok: true;
  application: AdminApplicationDetail & {
    finalScore: number | null;
    appliedBand: ScreeningBand | null;
    evaluationStatus: EvaluationStatus | null;
    shortlisted: boolean;
  };
  evaluation: AdminEvaluationDetail;
}

export async function fetchAdminApplicationDetail(id: string): Promise<AdminApplicationDetailResponse> {
  return request<AdminApplicationDetailResponse>(`/api/admin/applications/${encodeURIComponent(id)}`);
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export async function recalculateEvaluation(applicationId: string): Promise<AdminEvaluationDetail> {
  const payload = await request<{ ok: true; evaluation: AdminEvaluationDetail }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/evaluation`,
  );
  return payload.evaluation;
}

// ── OPEN reviews ──────────────────────────────────────────────────────────────

export async function saveOpenReview(applicationId: string, questionId: string, input: SaveOpenReviewInput): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/open-reviews/${encodeURIComponent(questionId)}`,
    { ...jsonBody(input), method: "PUT" },
  );
}

// ── Integrity flags ───────────────────────────────────────────────────────────

export async function updateIntegrityFlag(applicationId: string, flagId: string, input: UpdateIntegrityFlagInput): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/integrity/${encodeURIComponent(flagId)}`,
    { ...jsonBody(input), method: "PUT" },
  );
}

// ── Bonuses ───────────────────────────────────────────────────────────────────

export async function updateBonus(applicationId: string, bonusType: string, input: UpdateBonusInput): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/bonuses/${encodeURIComponent(bonusType)}`,
    { ...jsonBody(input), method: "PUT" },
  );
}

// ── Shortlist ─────────────────────────────────────────────────────────────────

export async function updateShortlist(applicationId: string, input: UpdateShortlistInput): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/shortlist`,
    { ...jsonBody(input), method: "PUT" },
  );
}

// ── Application status ────────────────────────────────────────────────────────

export async function updateApplicationStatus(applicationId: string, input: UpdateApplicationStatusInput): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/status`,
    { ...jsonBody(input), method: "PUT" },
  );
}

// ── CV review (Task 24G) ─────────────────────────────────────────────────────────
// CV scoring is fully separate from the assessment engine: these calls only
// read/write the application_cv_reviews record.

import type { AdminCvFileResponse, CvReviewRecord } from "@shared/cvApi";

/** Authenticated CV file route — never a public/permanent storage URL. */
export function adminCvFileUrl(applicationId: string, download = false): string {
  return `/api/admin/applications/${encodeURIComponent(applicationId)}/cv/file${download ? "?download=1" : ""}`;
}

export interface AdminCvFileAccess {
  /** "url" = signed private blob URL; "bytes" = same-origin streaming route. */
  kind: "url" | "bytes";
  url: string;
  filename: string | null;
  expiresAt: number | null;
}

/**
 * Resolve private CV file access after Admin authentication. Deployments
 * return a short-lived signed URL for the PRIVATE blob (bytes stream from
 * Blob storage, never through the API); local development returns the
 * authenticated same-origin route which streams the bytes itself.
 */
export async function fetchAdminCvFileAccess(applicationId: string, download = false): Promise<AdminCvFileAccess> {
  const routeUrl = adminCvFileUrl(applicationId, download);
  const body = await request<AdminCvFileResponse>(routeUrl);
  if (body.kind === "url") {
    return { kind: "url", url: body.url, filename: body.filename, expiresAt: body.expiresAt };
  }
  return { kind: "bytes", url: routeUrl, filename: null, expiresAt: null };
}

export async function saveCvReview(applicationId: string, input: { score: number; note?: string }): Promise<CvReviewRecord> {
  const payload = await request<{ ok: true; review: CvReviewRecord }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/cv-review`,
    { ...jsonBody(input), method: "PUT" },
  );
  return payload.review;
}

export async function resetCvReview(applicationId: string): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/applications/${encodeURIComponent(applicationId)}/cv-review`,
    { method: "DELETE" },
  );
}
