/** Quiet Authority screening data: Admin-only, browser-local manual shortlist records and transparent score-derived readiness; never automated selection or recommendation. */
import { calculateAssessmentScore } from "@/lib/assessmentScoring";
import { calculateCvEvidenceScore } from "@/lib/cvEvidenceScoring";
import { calculateOverallFit } from "@/lib/overallFitScoring";
import { getAdminApplications, updateAdminApplicationStatus, type AdminApplication, type AdminStatus } from "@/lib/adminMockData";

export const SHORTLIST_STORAGE_KEY = "recruitment-portal:admin-demo-shortlist";
export type ShortlistRecord = { applicationId: string; shortlistStatus: true; shortlistedAt: string; previousApplicationStatus: AdminStatus };
export type ScreeningReadiness = "Ready" | "Awaiting Review";
export type ScreeningRecord = {
  application: AdminApplication;
  assessment: ReturnType<typeof calculateAssessmentScore>;
  cvEvidence: ReturnType<typeof calculateCvEvidenceScore>;
  overallFit: ReturnType<typeof calculateOverallFit>;
  readiness: ScreeningReadiness;
  shortlisted: boolean;
};

function readShortlist(): Record<string, ShortlistRecord> {
  if (typeof window === "undefined") return {};
  try { const stored = window.localStorage.getItem(SHORTLIST_STORAGE_KEY); const parsed = stored ? JSON.parse(stored) : null; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, ShortlistRecord> : {}; } catch { return {}; }
}
function saveShortlist(records: Record<string, ShortlistRecord>) { if (typeof window !== "undefined") window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(records)); return records; }

export function getShortlistRecord(applicationId: string) { return readShortlist()[applicationId] ?? null; }
export function isShortlisted(applicationId: string) { return Boolean(getShortlistRecord(applicationId)); }
export function getShortlistedCount() { return Object.keys(readShortlist()).length; }
export function addApplicationToShortlist(application: AdminApplication) {
  const shortlist = readShortlist(); const existing = shortlist[application.id];
  if (existing) return existing;
  const record: ShortlistRecord = { applicationId: application.id, shortlistStatus: true, shortlistedAt: new Date().toISOString(), previousApplicationStatus: application.applicationStatus };
  saveShortlist({ ...shortlist, [application.id]: record }); updateAdminApplicationStatus(application.id, "Shortlisted"); return record;
}
export function removeApplicationFromShortlist(application: AdminApplication) {
  const shortlist = readShortlist(); const record = shortlist[application.id]; const { [application.id]: removed, ...remaining } = shortlist;
  saveShortlist(remaining); updateAdminApplicationStatus(application.id, record?.previousApplicationStatus ?? "Under Review"); return removed;
}

export function getScreeningRecord(application: AdminApplication): ScreeningRecord {
  const assessment = calculateAssessmentScore(application); const cvEvidence = calculateCvEvidenceScore(application.id); const overallFit = calculateOverallFit(application);
  return { application, assessment, cvEvidence, overallFit, readiness: overallFit.overallFitReady ? "Ready" : "Awaiting Review", shortlisted: isShortlisted(application.id) };
}
export function getScreeningRecords(role?: string) { return getAdminApplications().filter((application) => !role || application.role === role).map(getScreeningRecord); }
export function getScreeningSummary(records: ScreeningRecord[]) { return { applications: records.length, ready: records.filter((record) => record.readiness === "Ready").length, shortlisted: records.filter((record) => record.shortlisted).length, awaitingReview: records.filter((record) => record.readiness === "Awaiting Review").length }; }
