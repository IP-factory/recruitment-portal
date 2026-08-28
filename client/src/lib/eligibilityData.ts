/**
 * Business Development Officer eligibility: browser-local, score-free gate outcomes.
 *
 * Task 24C-1 boundary: the gate *configuration* (e.g. the G3 minimum relevant
 * experience) now comes from TiDB via the public eligibility endpoint and is
 * passed into the evaluator — nothing is hard-coded here anymore. The
 * evaluation itself remains client-side until the application-persistence
 * phase. The per-application summaries below serve the mock candidate domain
 * only and are not the applicant gate configuration source.
 */
import type { AdminApplication } from "@/lib/adminMockData";

export type EligibilityGateStatus = "Passed" | "Failed" | "Flagged" | "Configuration required" | "Pending";
export type EligibilityOutcome = "Eligible" | "Closed — Eligibility" | "Pending";
export type EligibilityGateId = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";
export type EligibilityGate = {
  id: EligibilityGateId;
  title: string;
  question: string;
  status: EligibilityGateStatus;
  detail: string;
  flagReason?: string;
};
export type EligibilitySummary = {
  outcome: EligibilityOutcome;
  gates: EligibilityGate[];
  activeGateIds: EligibilityGateId[];
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
export const ACTIVE_ELIGIBILITY_GATE_IDS: EligibilityGateId[] = ["G1", "G2", "G3", "G6", "G7"];

const gateDefinitions: Array<Pick<EligibilityGate, "id" | "title" | "question">> = [
  { id: "G1", title: "Abuja presence", question: "Which statement best describes your current location and availability to work in Abuja?" },
  { id: "G2", title: "Right to work", question: "Do you have the legal right to work in Nigeria?" },
  { id: "G3", title: "Relevant experience", question: "Minimum 3 years in a Business Development, corporate sales or account management role." },
  { id: "G4", title: "Start availability", question: "Available to start within the stated recruitment window." },
  { id: "G5", title: "Compensation band", question: "Compensation expectations fall within the published band." },
  { id: "G6", title: "Outbound work", question: "Are you willing to work in an outbound Business Development role that may involve client visits, site tours, evening events and occasional weekend events?" },
  { id: "G7", title: "Verification consent", question: "Do you consent to reference and employment verification as part of the recruitment process?" },
];

const configurationRequired: Record<EligibilityGateId, Pick<EligibilityGate, "status" | "detail">> = {
  G4: { status: "Configuration required", detail: "Required start window has not been configured." },
  G5: { status: "Configuration required", detail: "Compensation band has not been configured." },
  G1: { status: "Passed", detail: "Abuja availability confirmed." },
  G2: { status: "Passed", detail: "Right to work confirmed." },
  G3: { status: "Passed", detail: "Minimum relevant experience confirmed." },
  G6: { status: "Passed", detail: "Outbound work expectation acknowledged." },
  G7: { status: "Passed", detail: "Verification consent recorded." },
};

const seededStates: Record<string, Partial<Record<EligibilityGateId, Pick<EligibilityGate, "status" | "detail" | "flagReason">>>> = {
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
  const gates = gateDefinitions.map((definition) => ({ ...definition, ...(seeded?.[definition.id] ?? configurationRequired[definition.id]) }));
  const failedCount = gates.filter((gate) => gate.status === "Failed").length;
  const flaggedCount = gates.filter((gate) => gate.status === "Flagged").length;
  const passedCount = gates.filter((gate) => gate.status === "Passed").length;
  const activeGates = gates.filter((gate) => ACTIVE_ELIGIBILITY_GATE_IDS.includes(gate.id));
  const completedCount = activeGates.filter((gate) => ["Passed", "Failed", "Flagged"].includes(gate.status)).length;
  const outcome: EligibilityOutcome = failedCount ? "Closed — Eligibility" : activeGates.some((gate) => gate.status === "Pending") ? "Pending" : "Eligible";
  const g1 = gates.find((gate) => gate.id === "G1");
  return {
    outcome,
    gates,
    activeGateIds: ACTIVE_ELIGIBILITY_GATE_IDS,
    activeCount: ACTIVE_ELIGIBILITY_GATE_IDS.length,
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

export type ApplicantEligibilityAnswers = {
  abujaAvailability: "abuja" | "relocate" | "not-relocate" | "";
  plannedRelocationDate: string;
  rightToWork: "yes" | "no" | "";
  outboundWork: "yes" | "no" | "";
  verificationConsent: "yes" | "no" | "";
};

/** Database-provided gate configuration consumed by the evaluator. */
export interface ApplicantEligibilityGateConfiguration {
  /** G3 minimum relevant experience in years (from the gate configuration). */
  minimumYears: number;
}

/** Minimum years represented by each approved experience option. */
const EXPERIENCE_OPTION_MINIMUM_YEARS: Record<string, number> = {
  "No direct experience": 0,
  "Less than 1 year": 0,
  "1–2 years": 1,
  "3–5 years": 3,
  "6–8 years": 6,
  "9+ years": 9,
};

/** Does an approved experience option satisfy the configured minimum? */
export function experienceOptionMeetsMinimumYears(option: string, minimumYears: number): boolean {
  const represented = EXPERIENCE_OPTION_MINIMUM_YEARS[option];
  return typeof represented === "number" && represented >= minimumYears;
}

export const emptyApplicantEligibilityAnswers: ApplicantEligibilityAnswers = {
  abujaAvailability: "",
  plannedRelocationDate: "",
  rightToWork: "",
  outboundWork: "",
  verificationConsent: "",
};

export type ApplicantEligibilityGateOutcome = {
  gateId: EligibilityGateId;
  response: string;
  status: "Passed" | "Failed" | "Flagged" | "Configuration required";
  flagReason?: string;
};

export type ApplicantEligibilityEvaluation = {
  outcome: EligibilityOutcome | "Incomplete";
  gates: ApplicantEligibilityGateOutcome[];
  failedGate: EligibilityGateId | null;
  incomplete: boolean;
};

export function evaluateApplicantEligibility(answers: ApplicantEligibilityAnswers, relevantExperience: string, configuration: ApplicantEligibilityGateConfiguration): ApplicantEligibilityEvaluation {
  const required = [answers.abujaAvailability, answers.rightToWork, relevantExperience, answers.outboundWork, answers.verificationConsent];
  if (required.some((answer) => !answer) || (answers.abujaAvailability === "relocate" && !answers.plannedRelocationDate)) return { outcome: "Incomplete", gates: [], failedGate: null, incomplete: true };
  const gates: ApplicantEligibilityGateOutcome[] = [
    { gateId: "G1", response: answers.abujaAvailability, status: answers.abujaAvailability === "not-relocate" ? "Failed" : answers.abujaAvailability === "relocate" ? "Flagged" : "Passed", ...(answers.abujaAvailability === "relocate" ? { flagReason: "Relocation commitment" } : {}) },
    { gateId: "G2", response: answers.rightToWork, status: answers.rightToWork === "yes" ? "Passed" : "Failed" },
    { gateId: "G3", response: relevantExperience, status: experienceOptionMeetsMinimumYears(relevantExperience, configuration.minimumYears) ? "Passed" : "Failed" },
    { gateId: "G6", response: answers.outboundWork, status: answers.outboundWork === "yes" ? "Passed" : "Failed" },
    { gateId: "G7", response: answers.verificationConsent, status: answers.verificationConsent === "yes" ? "Passed" : "Failed" },
  ];
  const failedGate = gates.find((gate) => gate.status === "Failed")?.gateId ?? null;
  return { outcome: failedGate ? "Closed — Eligibility" : "Eligible", gates, failedGate, incomplete: false };
}
