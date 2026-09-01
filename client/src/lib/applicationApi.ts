/**
 * Task 24D-1 — client application API module.
 *
 * Single fetch layer for the public applicant runtime. All calls use the
 * applicant access token via the X-Application-Token header (never cookies).
 * The database is the source of truth: NO fallback to localStorage mock data.
 *
 * Token storage is managed by the applicantSession module; this module only
 * handles the transport.
 */
import type {
  ApplicantAssessmentState,
  ApplicantSafeQuestion,
  ApplicationState,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationResponse,
  EligibilityStatus,
  SaveAssessmentResponseInput,
  ServerEligibilityResult,
} from "@shared/applicationApi";

export type {
  ApplicantAssessmentState,
  ApplicantEligibilityAnswers,
  ApplicantGateAnswer,
  ApplicantSafeOption,
  ApplicantSafeQuestion,
  ApplicationState,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationResponse,
  EligibilityStatus,
  SaveAssessmentResponseInput,
  ServerEligibilityGateResult,
  ServerEligibilityResult,
} from "@shared/applicationApi";

export class ApplicationApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApplicationApiError";
    this.status = status;
  }
}

function readApplicantToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("recruitment-portal:applicant-token");
    return stored || null;
  } catch {
    return null;
  }
}

function readApplicationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("recruitment-portal:application-id");
    return stored || null;
  } catch {
    return null;
  }
}

export function saveApplicantSession(applicationId: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("recruitment-portal:application-id", applicationId);
  window.localStorage.setItem("recruitment-portal:applicant-token", token);
}

export function loadApplicantSession(): { applicationId: string; token: string } | null {
  const id = readApplicationId();
  const token = readApplicantToken();
  return id && token ? { applicationId: id, token } : null;
}

export function clearApplicantSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("recruitment-portal:application-id");
  window.localStorage.removeItem("recruitment-portal:applicant-token");
}

async function applicationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readApplicantToken();
  if (!token) throw new ApplicationApiError(401, "No active application session.");

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
    "X-Application-Token": token,
  };
  if (init?.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, { ...init, headers });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const serverMessage = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null;
    throw new ApplicationApiError(response.status, serverMessage ?? "Unable to process your request.");
  }
  return body as T;
}

const jsonBody = (input: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

// ── Create application ───────────────────────────────────────────────────────

export async function createApplication(input: CreateApplicationInput): Promise<CreateApplicationResponse> {
  const response = await fetch("/api/public/applications", {
    ...jsonBody(input),
  });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const serverMessage = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null;
    throw new ApplicationApiError(response.status, serverMessage ?? "Unable to create your application.");
  }
  return body as CreateApplicationResponse;
}

// ── Resume application ───────────────────────────────────────────────────────

export async function fetchApplication(): Promise<ApplicationState> {
  const payload = await applicationRequest<{ ok: boolean } & ApplicationState>("/api/public/applications/me");
  return payload;
}

// ── Assessment ───────────────────────────────────────────────────────────────

export async function fetchLiveAssessment(): Promise<ApplicantAssessmentState & { completed?: boolean }> {
  const payload = await applicationRequest<{ ok: boolean; completed?: boolean } & ApplicantAssessmentState>("/api/public/applications/me/assessment");
  return payload;
}

export async function saveAssessmentResponse(questionId: string, input: SaveAssessmentResponseInput): Promise<{ ok: boolean; closed?: boolean }> {
  const payload = await applicationRequest<{ ok: boolean; closed?: boolean }>(
    `/api/public/applications/me/assessment/responses/${encodeURIComponent(questionId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return payload;
}

export async function startOpenTimer(questionId: string): Promise<{ ok: boolean; timerStartedAt: string | null }> {
  const payload = await applicationRequest<{ ok: boolean; timerStartedAt: string | null }>(
    `/api/public/applications/me/assessment/responses/${encodeURIComponent(questionId)}/timer`,
    { method: "POST" },
  );
  return payload;
}

export async function completeAssessment(): Promise<{ ok: boolean; alreadyComplete?: boolean }> {
  const payload = await applicationRequest<{ ok: boolean; alreadyComplete?: boolean }>(
    "/api/public/applications/me/assessment/complete",
    { method: "POST" },
  );
  return payload;
}

// ── Submit ───────────────────────────────────────────────────────────────────

export async function submitApplication(): Promise<{ ok: boolean; submittedAt: string; alreadySubmitted?: boolean }> {
  const payload = await applicationRequest<{ ok: boolean; submittedAt: string; alreadySubmitted?: boolean }>(
    "/api/public/applications/me/submit",
    { method: "POST" },
  );
  return payload;
}

// ── Review ───────────────────────────────────────────────────────────────────

export async function fetchReviewData(): Promise<{
  ok: boolean;
  applicant: ApplicationState["applicant"];
  eligibility: ApplicationState["eligibility"];
  assessmentResponses: Record<string, string>;
  submittedAt: string | null;
}> {
  return applicationRequest("/api/public/applications/me/review");
}

// ── CV upload (Task 24G) ──────────────────────────────────────────────────────
// In deployments the file bytes travel DIRECTLY from the browser to the
// private Blob store: the API only issues a scoped, short-lived client
// upload token and later persists metadata. The raw-bytes PUT path exists
// for local development only (there is no object-store CDN locally).

import type { ApplicantCvResponse, CvUploadAuthorizationResponse } from "@shared/cvApi";
import { CV_MIME_TYPES, cvExtensionOf, type CvExtension } from "@shared/cvApi";

export type { CvFileMetadata as ApplicantCvFileMetadata } from "@shared/cvApi";

export async function fetchApplicantCv(): Promise<ApplicantCvResponse> {
  return applicationRequest<ApplicantCvResponse>("/api/public/applications/me/cv");
}

async function rawPutApplicantCv(token: string, file: File): Promise<ApplicantCvResponse> {
  const response = await fetch("/api/public/applications/me/cv", {
    method: "PUT",
    headers: {
      "X-Application-Token": token,
      "Content-Type": "application/octet-stream",
      "x-cv-filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const serverMessage = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null;
    throw new ApplicationApiError(response.status, serverMessage ?? "Unable to upload your CV.");
  }
  return body as ApplicantCvResponse;
}

export async function uploadApplicantCv(file: File): Promise<ApplicantCvResponse> {
  const token = readApplicantToken();
  if (!token) throw new ApplicationApiError(401, "No active application session.");

  // 1. Ask the API for a scoped direct-upload authorization (the server
  //    validates the session, status and declared filename/size first).
  const authorization = await applicationRequest<CvUploadAuthorizationResponse>("/api/public/applications/me/cv/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size }),
  });

  if (authorization.mode === "local") {
    return rawPutApplicantCv(token, file);
  }

  // 2. Upload the bytes straight to the PRIVATE Blob store using the scoped
  //    client token — the file never passes through the application server.
  const contentType = CV_MIME_TYPES[cvExtensionOf(file.name) as CvExtension] ?? "application/octet-stream";
  try {
    const { put } = await import("@vercel/blob/client");
    await put(authorization.pathname, file, {
      access: "private",
      token: authorization.clientToken,
      contentType,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "BlobFileTooLargeError") throw new ApplicationApiError(400, "The file is too large. CVs must be 10 MB or smaller.");
    if (name === "BlobContentTypeNotAllowedError") throw new ApplicationApiError(400, "Unsupported file type. Please upload a PDF, DOC or DOCX file.");
    if (name === "BlobClientTokenExpiredError") throw new ApplicationApiError(400, "The upload authorization expired. Please try again.");
    throw new ApplicationApiError(503, "Unable to upload your CV. Please try again.");
  }

  // 3. Persist the metadata now that the blob exists.
  return applicationRequest<ApplicantCvResponse>("/api/public/applications/me/cv/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname: authorization.pathname, filename: file.name, contentType, size: file.size }),
  });
}

export async function removeApplicantCv(): Promise<ApplicantCvResponse> {
  return applicationRequest<ApplicantCvResponse>("/api/public/applications/me/cv", { method: "DELETE" });
}
