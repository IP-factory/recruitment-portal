export type NumericPreviewAnswer = { year?: string; target?: string; actual?: string; never?: boolean };
export type PreviewAnswer = string | string[] | NumericPreviewAnswer;
export type PreviewState = { answers: Record<string, PreviewAnswer>; currentQuestionIndex: number };
export type PreviewTimerState = { startedAt: number; expiresAt: number; submitted: boolean };

export const EMPTY_PREVIEW_STATE: PreviewState = { answers: {}, currentQuestionIndex: 0 };
export const ASSESSMENT_V2_PREVIEW_STORAGE_KEY = "recruitment-portal:assessment-v2-preview-responses";
export const ASSESSMENT_V2_PREVIEW_TIMERS_KEY = "recruitment-portal:assessment-v2-preview-timers";

export function countPreviewWords(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
export function trimPreviewWords(value: string, limit: number) { return countPreviewWords(value) > limit ? value.trim().split(/\s+/).slice(0, limit).join(" ") : value; }
export function formatPreviewRemaining(seconds: number) { const safe = Math.max(0, seconds); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }

export function loadPreviewJson<Value>(key: string, fallback: Value): Value {
  if (typeof window === "undefined") return fallback;
  try { const stored = window.localStorage.getItem(key); return stored ? JSON.parse(stored) as Value : fallback; } catch { return fallback; }
}
export function savePreviewJson(key: string, value: unknown) { if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value)); }
