/**
 * Task 24G — shared CV upload / review API contract.
 *
 * Pure DTO types and constants shared between the Express API and the client.
 * CV file bytes never travel through TiDB — only metadata is persisted, and
 * the file itself lives in object/file storage accessed via authenticated,
 * proxied endpoints (never a public URL).
 */

/** Maximum CV file size: 10 MB. */
export const CV_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted CV extensions (lower-cased, leading dot). */
export const CV_ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

/** Accepted CV MIME types mapped from detected content, not browser claims. */
export const CV_MIME_TYPES = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type CvExtension = (typeof CV_ACCEPTED_EXTENSIONS)[number];

/** Applicant-safe CV metadata — storage keys are never exposed. */
export interface CvFileMetadata {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface CvReviewRecord {
  score: number;
  reviewNote: string | null;
  reviewedAt: string;
}

/** Applicant-facing responses. */
export interface ApplicantCvResponse {
  ok: boolean;
  cv: CvFileMetadata | null;
}

/** Admin-facing CV review payload. */
export interface AdminCvDetail {
  cv: CvFileMetadata | null;
  review: CvReviewRecord | null;
}

export interface SaveCvReviewInput {
  score: unknown;
  note?: string;
}

/** Derive the lower-cased extension from a filename ("" when absent). */
export function cvExtensionOf(filename: string): string {
  const trimmed = filename.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  if (dot < 0) return "";
  return trimmed.slice(dot);
}

/**
 * Human-readable byte label (e.g. "1.2 MB") used by applicant and Admin UI.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
