/**
 * CSV Assessment Question Import — client API module.
 *
 * Mirrors the recruitment API conventions: `credentials: "include"` so the
 * Task 24B HttpOnly `app_session_id` cookie authorizes each Admin call, and a
 * restrained error surface. The CSV travels as a raw `text/csv` body (never
 * JSON) to match the server's route-level text parser.
 */
import type { CsvFrameworkPreviewDto, CsvImportPreviewDto, CsvImportResultDto, CsvScope } from "@shared/csvImport";
import { RecruitmentApiError } from "./recruitmentApi";

export type { CsvFrameworkDimensionDto, CsvFrameworkPreviewDto, CsvFrameworkState, CsvImportPreviewDto, CsvImportResultDto, CsvPreviewRowDto, CsvScope } from "@shared/csvImport";
export { CSV_SCOPES } from "@shared/csvImport";

export interface CsvTemplatePayload {
  filename: string;
  template: string;
  instructions: string[];
  columns: string[];
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const serverMessage =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null;
    throw new RecruitmentApiError(response.status, serverMessage ?? "Unable to process the CSV import request.");
  }
  return body as T;
}

const roleBase = (idOrSlug: string) => `/api/admin/recruitment-roles/${encodeURIComponent(idOrSlug)}/assessment`;

/** Fetch the downloadable CSV template plus plain-language instructions. */
export async function fetchCsvTemplate(idOrSlug: string): Promise<CsvTemplatePayload> {
  const payload = await requestJson<{ ok: boolean } & CsvTemplatePayload>(`${roleBase(idOrSlug)}/csv-template`);
  return { filename: payload.filename, template: payload.template, instructions: payload.instructions, columns: payload.columns };
}

/** Validate an uploaded CSV against the role; writes nothing. */
export async function previewCsvImport(idOrSlug: string, csvText: string): Promise<CsvImportPreviewDto> {
  const payload = await requestJson<{ preview: CsvImportPreviewDto }>(`${roleBase(idOrSlug)}/csv-preview`, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  });
  return payload.preview;
}

/** Re-validate server-side and atomically import into the role's assessment. */
export async function confirmCsvImport(idOrSlug: string, csvText: string, scope: CsvScope): Promise<CsvImportResultDto> {
  const payload = await requestJson<{ result: CsvImportResultDto }>(
    `${roleBase(idOrSlug)}/csv-import?scope=${encodeURIComponent(scope)}`,
    {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csvText,
    },
  );
  return payload.result;
}

/**
 * Create missing Evaluation Framework dimensions from the uploaded CSV.
 * Returns a refreshed CsvImportPreviewDto validated against the now-existing
 * dimensions, so the client can re-render in one round trip.
 */
export async function createFrameworkFromCsv(idOrSlug: string, csvText: string): Promise<CsvImportPreviewDto> {
  const payload = await requestJson<{ preview: CsvImportPreviewDto }>(
    `${roleBase(idOrSlug)}/csv-framework`,
    {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csvText,
    },
  );
  return payload.preview;
}

/** Trigger a client-side download of the CSV template text. */
export function downloadCsvTemplate(filename: string, template: string): void {
  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Read a user-selected File into text for upload. */
export async function readCsvFile(file: File): Promise<string> {
  return file.text();
}
