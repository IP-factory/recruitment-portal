/**
 * Role eligibility: generic, role-specific gate support (Task 24E).
 *
 * The applicant form and the evaluator no longer assume any fixed G1–G7 set.
 * Each recruitment role loads its own active gate configuration from TiDB via
 * the public eligibility endpoint, and the form renders one input per gate
 * based on its configured `inputType`. APPLICATION_FIELD gates (such as the
 * BDO minimum-experience gate) are derived from the Applicant Information
 * fields and are never rendered as duplicate questions.
 *
 * Server-side evaluation is authoritative — the client only collects answers.
 *
 * The per-application summaries below serve the mock candidate domain only
 * and are not the applicant gate configuration source.
 */
import type { AdminApplication } from "@/lib/adminMockData";
import type { ApplicantEligibilityAnswers } from "@shared/applicationApi";

export type { ApplicantEligibilityAnswers, ApplicantGateAnswer } from "@shared/applicationApi";

export type EligibilityGateStatus = "Passed" | "Failed" | "Flagged" | "Configuration required" | "Pending";
export type EligibilityOutcome = "Eligible" | "Closed — Eligibility" | "Pending";
export type EligibilityGate = {
  id: string;
  title: string;
  question: string;
  status: EligibilityGateStatus;
  detail: string;
  flagReason?: string;
};
export type EligibilitySummary = {
  outcome: EligibilityOutcome;
  gates: EligibilityGate[];
  activeGateIds: string[];
  activeCount: number;
  passedCount: number;
  failedCount: number;
  flaggedCount: number;
  completedCount: number;
  totalCount: number;
  relocationStatus: "Confirmed" | "Flagged" | "Not answered";
};

export const ELIGIBILITY_STORAGE_KEY = "recruitment-portal:bd-officer:eligibility";
export const BUSINESS_DEVELOPMENT_OFFICER_ROUTE = "business-development-officer";

// ── Mock candidate domain (legacy summary helpers) ──────────────────────────

const mockGateDefinitions: Array<Pick<EligibilityGate, "id" | "title" | "question">> = [
  { id: "G1", title: "Abuja availability", question: "Which statement best describes your current location and availability to work in Abuja?" },
  { id: "G2", title: "Right to work in Nigeria", question: "Do you have the legal right to work in Nigeria?" },
  { id: "G3", title: "Minimum Business Development experience", question: "Minimum 3 years in a Business Development, corporate sales or account management role." },
  { id: "G4", title: "Start availability", question: "Are you available to start by 1 September 2026 or earlier?" },
  { id: "G5", title: "Compensation expectation", question: "Is your gross annual salary expectation within the range of ₦6,000,000 – ₦9,600,000?" },
  { id: "G6", title: "Outbound work", question: "Are you willing to work in an outbound Business Development role that may involve client visits, site tours, evening events and occasional weekend events?" },
  { id: "G7", title: "Reference and employment verification", question: "Do you consent to reference and employment verification as part of the recruitment process?" },
];

const mockDefaultState: Record<string, Pick<EligibilityGate, "status" | "detail">> = {
  G1: { status: "Passed", detail: "Abuja availability confirmed." },
  G2: { status: "Passed", detail: "Right to work confirmed." },
  G3: { status: "Passed", detail: "Minimum relevant experience confirmed." },
  G4: { status: "Passed", detail: "Start availability confirmed." },
  G5: { status: "Passed", detail: "Compensation expectation within band." },
  G6: { status: "Passed", detail: "Outbound work expectation acknowledged." },
  G7: { status: "Passed", detail: "Verification consent recorded." },
};

const seededStates: Record<string, Partial<Record<string, Pick<EligibilityGate, "status" | "detail" | "flagReason">>>> = {
  "app-amina-bello": {},
  "app-chinedu-okafor": {
    G1: { status: "Flagged", detail: "Relocation commitment recorded for Abuja.", flagReason: "Relocation commitment" },
  },
  "app-david-johnson": {
    G3: { status: "Failed", detail: "The minimum relevant-experience requirement was not met." },
  },
};

function readOverrides(): Record<string, EligibilitySummary> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ELIGIBILITY_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, EligibilitySummary> : {};
  } catch {
    return {};
  }
}

function buildSummary(applicationId: string): EligibilitySummary {
  const seeded = seededStates[applicationId];
  const gates = mockGateDefinitions.map((definition) => ({ ...definition, ...(seeded?.[definition.id] ?? mockDefaultState[definition.id] ?? { status: "Pending" as const, detail: "" }) }));
  const failedCount = gates.filter((gate) => gate.status === "Failed").length;
  const flaggedCount = gates.filter((gate) => gate.status === "Flagged").length;
  const passedCount = gates.filter((gate) => gate.status === "Passed").length;
  const completedCount = gates.filter((gate) => ["Passed", "Failed", "Flagged"].includes(gate.status)).length;
  const outcome: EligibilityOutcome = failedCount ? "Closed — Eligibility" : gates.some((gate) => gate.status === "Pending") ? "Pending" : "Eligible";
  const g1 = gates.find((gate) => gate.id === "G1");
  return {
    outcome,
    gates,
    activeGateIds: gates.map((gate) => gate.id),
    activeCount: gates.length,
    passedCount,
    failedCount,
    flaggedCount,
    completedCount,
    totalCount: gates.length,
    relocationStatus: g1?.status === "Flagged" ? "Flagged" : g1?.status === "Passed" ? "Confirmed" : "Not answered",
  };
}

export function getEligibilitySummary(applicationId: string): EligibilitySummary {
  return readOverrides()[applicationId] ?? buildSummary(applicationId);
}

export function getEligibilityOutcome(applicationId: string): EligibilityOutcome {
  return getEligibilitySummary(applicationId).outcome;
}

export function isEligibilityClosed(application: Pick<AdminApplication, "id">): boolean {
  return getEligibilityOutcome(application.id) === "Closed — Eligibility";
}

export function saveEligibilitySummary(applicationId: string, summary: EligibilitySummary) {
  if (typeof window === "undefined") return summary;
  const overrides = readOverrides();
  window.localStorage.setItem(ELIGIBILITY_STORAGE_KEY, JSON.stringify({ ...overrides, [applicationId]: summary }));
  return summary;
}

export function clearEligibilityOverrides() {
  if (typeof window !== "undefined") window.localStorage.removeItem(ELIGIBILITY_STORAGE_KEY);
}

// ── Generic applicant answers ────────────────────────────────────────────────

/** Empty answer set: gate references are only known once configuration loads. */
export const emptyApplicantEligibilityAnswers: ApplicantEligibilityAnswers = {};
