/** Admin-only screening data: v2-ready state fields with explicit Legacy compatibility for prototype applications. */
import { getAdminApplications, updateAdminApplicationStatus, type AdminApplication, type AdminStatus } from "@/lib/adminMockData";
import { getEligibilitySummary } from "@/lib/eligibilityData";

export const SHORTLIST_STORAGE_KEY = "recruitment-portal:admin-demo-shortlist";
export type ShortlistRecord = { applicationId: string; shortlistStatus: true; shortlistedAt: string; previousApplicationStatus: AdminStatus };
export type ScreeningReadiness = "Ready" | "Awaiting Review" | "Legacy";
export type ScreeningBand = "A" | "B" | "C" | "D" | "Pending" | "Legacy";
export type ScreeningIntegrity = "Clear" | "Awaiting review" | "Manual review required" | "Legacy";
export type ScreeningRecord = {
  application: AdminApplication;
  eligibility: "Eligible" | "Pending" | "Closed";
  finalScore: number | null;
  appliedBand: ScreeningBand;
  bandLabel?: string;
  floorStatus: "All floors met" | "Floor missed" | "Pending" | "Legacy";
  integrity: ScreeningIntegrity;
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
export function addApplicationToShortlist(application: AdminApplication) { const shortlist = readShortlist(); const existing = shortlist[application.id]; if (existing) return existing; const record: ShortlistRecord = { applicationId: application.id, shortlistStatus: true, shortlistedAt: new Date().toISOString(), previousApplicationStatus: application.applicationStatus }; saveShortlist({ ...shortlist, [application.id]: record }); updateAdminApplicationStatus(application.id, "Shortlisted"); return record; }
export function removeApplicationFromShortlist(application: AdminApplication) { const shortlist = readShortlist(); const record = shortlist[application.id]; const { [application.id]: removed, ...remaining } = shortlist; saveShortlist(remaining); updateAdminApplicationStatus(application.id, record?.previousApplicationStatus ?? "Under Review"); return removed; }

export function getScreeningRecord(application: AdminApplication): ScreeningRecord {
  const eligibilityOutcome = getEligibilitySummary(application.id).outcome;
  const eligibility = eligibilityOutcome === "Closed — Eligibility" ? "Closed" : eligibilityOutcome === "Pending" ? "Pending" : "Eligible";
  return { application, eligibility, finalScore: null, appliedBand: "Legacy", bandLabel: "Legacy", floorStatus: "Legacy", integrity: "Legacy", readiness: "Legacy", shortlisted: isShortlisted(application.id) };
}
export function getScreeningRecords(role?: string) { return getAdminApplications().filter((application) => !role || application.role === role).map(getScreeningRecord); }
export function getScreeningSummary(records: ScreeningRecord[]) { return { applications: records.length, ready: records.filter((record) => record.readiness === "Ready").length, shortlisted: records.filter((record) => record.shortlisted).length, awaitingReview: records.filter((record) => record.readiness === "Awaiting Review").length, legacy: records.filter((record) => record.readiness === "Legacy").length }; }
