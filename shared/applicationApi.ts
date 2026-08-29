/**
 * Task 24D-1 — shared Application API contract.
 *
 * Pure DTO types and validation helpers for the public applicant runtime.
 * These types are shared between the Express API and the client. Applicant
 * shapes never carry scoring internals, weights, rubric anchors, or Admin
 * metadata.
 */

export const APPLICATION_STATUSES = [
  "In Progress",
  "Eligibility Closed",
  "Assessment In Progress",
  "Assessment Complete",
  "Submitted",
  "Shortlisted",
  "Hold",
  "Closed",
] as const;

export const ELIGIBILITY_STATUSES = ["Pending", "Eligible", "Closed"] as const;

export const ATTEMPT_STATUSES = ["Not Started", "In Progress", "Complete"] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

// ── Applicant information input ──────────────────────────────────────────────

export interface CreateApplicationInput {
  roleSlug: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  recentRole: string;
  recentEmployer: string;
  totalExperience: string;
  relevantExperience: string;
  linkedinUrl: string;
  /** Generic per-gate answers keyed by gate reference (e.g. "G1"). */
  eligibility: ApplicantEligibilityAnswers;
}

/**
 * One applicant answer for a single eligibility gate. `value` is the selected
 * option value (YES_NO: "yes"/"no"; SINGLE_SELECT: configured option value).
 * `supplementary` carries follow-up field values such as a planned relocation
 * date. Gates with inputType APPLICATION_FIELD are evaluated server-side from
 * the applicant information fields and carry no applicant answer.
 */
export interface ApplicantGateAnswer {
  value: string;
  supplementary?: string;
}

export type ApplicantEligibilityAnswers = Record<string, ApplicantGateAnswer>;

// ── Server-side eligibility evaluation result ────────────────────────────────

export interface ServerEligibilityGateResult {
  gateId: string;
  gateReference: string;
  response: string;
  outcome: "Passed" | "Failed" | "Flagged" | "Configuration required";
  flagReason?: string;
}

export interface ServerEligibilityResult {
  eligible: boolean;
  gates: ServerEligibilityGateResult[];
  failedGateId: string | null;
}

// ── Application response shapes ─────────────────────────────────────────────

export interface CreateApplicationResponse {
  ok: boolean;
  applicationId: string;
  applicantToken: string;
  eligibilityStatus: EligibilityStatus;
  applicationStatus: ApplicationStatus;
  eligibility: ServerEligibilityResult;
  nextStep: string;
}

export interface ApplicationState {
  applicationId: string;
  currentStep: string;
  applicationStatus: ApplicationStatus;
  eligibilityStatus: EligibilityStatus;
  applicant: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    recentRole: string;
    recentEmployer: string;
    totalExperience: string;
    relevantExperience: string;
    linkedinUrl: string;
  };
  eligibility: {
    gates: ServerEligibilityGateResult[];
    eligible: boolean;
  };
  assessment: ApplicantAssessmentState | null;
  submittedAt: string | null;
}

// ── Applicant-safe assessment shapes ────────────────────────────────────────

export interface ApplicantAssessmentState {
  attemptId: string;
  assessmentName: string;
  questionCount: number;
  currentProgress: number;
  questions: ApplicantSafeQuestion[];
}

/** Applicant-safe option: id and text only, never points/decoys/explanations. */
export interface ApplicantSafeOption {
  id: string;
  text: string;
}

/** Applicant-safe question: type-specific shapes, never scoring internals. */
export type ApplicantSafeQuestion =
  | { id: string; type: "ORDINAL"; prompt: string; options: ApplicantSafeOption[] }
  | { id: string; type: "MULTI"; prompt: string; options: ApplicantSafeOption[] }
  | { id: string; type: "NUMERIC"; prompt: string; inputLabels: string[]; unit: string | null }
  | { id: string; type: "SJT"; prompt: string; options: ApplicantSafeOption[] }
  | { id: string; type: "OPEN"; prompt: string; maximumWords: number | null; timeLimitSec: number | null; pasteAllowed: boolean; timerStartedAt: string | null }
  | { id: string; type: "EVIDENCE"; prompt: string; options: ApplicantSafeOption[] };

// ── Assessment response input ───────────────────────────────────────────────

export interface SaveAssessmentResponseInput {
  responseType: "ORDINAL" | "MULTI" | "NUMERIC" | "SJT" | "OPEN" | "EVIDENCE";
  responsePayload: unknown;
  elapsedSeconds?: number;
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateCreateApplicationInput(candidate: unknown): { input: CreateApplicationInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Application data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const roleSlug = typeof value.roleSlug === "string" ? value.roleSlug.trim() : "";
  if (!roleSlug) errors.push("Role is missing.");

  const fullName = typeof value.fullName === "string" ? value.fullName.trim() : "";
  if (!fullName) errors.push("Enter your full name.");
  else if (fullName.length > 180) errors.push("Full name is too long.");

  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  if (!email) errors.push("Enter your email address.");
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Enter a valid email address.");

  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  if (!phone) errors.push("Enter your phone number.");

  const city = typeof value.city === "string" ? value.city.trim() : "";
  if (!city) errors.push("Enter your current location.");

  const recentRole = typeof value.recentRole === "string" ? value.recentRole.trim() : "";
  if (!recentRole) errors.push("Enter your current or most recent job title.");

  const recentEmployer = typeof value.recentEmployer === "string" ? value.recentEmployer.trim() : "";
  const totalExperience = typeof value.totalExperience === "string" ? value.totalExperience.trim() : "";
  if (!totalExperience) errors.push("Select your total experience level.");

  const relevantExperience = typeof value.relevantExperience === "string" ? value.relevantExperience.trim() : "";
  if (!relevantExperience) errors.push("Select your relevant experience level.");

  const linkedinUrl = typeof value.linkedinUrl === "string" ? value.linkedinUrl.trim() : "";
  if (linkedinUrl && linkedinUrl.length > 512) errors.push("LinkedIn URL is too long.");

  const eligibilityRaw = value.eligibility;
  let eligibility: ApplicantEligibilityAnswers = {};
  if (!eligibilityRaw || typeof eligibilityRaw !== "object" || Array.isArray(eligibilityRaw)) {
    errors.push("Eligibility answers are missing.");
  } else {
    for (const [gateReference, answer] of Object.entries(eligibilityRaw as Record<string, unknown>)) {
      if (!answer || typeof answer !== "object") {
        errors.push(`The answer for gate ${gateReference} is missing.`);
        continue;
      }
      const answerObject = answer as Record<string, unknown>;
      if (typeof answerObject.value !== "string" || !(answerObject.value as string).trim()) {
        errors.push(`Select an answer for gate ${gateReference}.`);
        continue;
      }
      eligibility[gateReference] = {
        value: (answerObject.value as string).trim(),
        ...(typeof answerObject.supplementary === "string" ? { supplementary: (answerObject.supplementary as string).trim() } : {}),
      };
    }
  }

  if (errors.length) return { errors };

  return {
    input: {
      roleSlug,
      fullName,
      email,
      phone,
      city,
      recentRole,
      recentEmployer,
      totalExperience,
      relevantExperience,
      linkedinUrl,
      eligibility,
    },
  };
}

export function validateAssessmentResponseInput(candidate: unknown): { input: SaveAssessmentResponseInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Response data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const validTypes = ["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"];
  const responseType = value.responseType;
  if (typeof responseType !== "string" || !validTypes.includes(responseType)) {
    errors.push("Invalid response type.");
    return { errors };
  }

  const responsePayload = value.responsePayload;
  if (responsePayload === undefined || responsePayload === null) {
    errors.push("Response payload is missing.");
    return { errors };
  }

  const elapsedSeconds = typeof value.elapsedSeconds === "number" ? value.elapsedSeconds : undefined;

  return {
    input: {
      responseType: responseType as SaveAssessmentResponseInput["responseType"],
      responsePayload,
      elapsedSeconds,
    },
  };
}

/** Normalize email for consistent duplicate detection. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
