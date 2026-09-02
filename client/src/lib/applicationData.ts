/**
 * Quiet Authority application data layer: temporary client-side information storage with a shape designed for future backend replacement.
 */
export const BUSINESS_DEVELOPMENT_OFFICER = "Business Development Officer";
/** Legacy export retained for existing imports while visible copy migrates to Officer. */
export const BUSINESS_DEVELOPMENT_MANAGER = BUSINESS_DEVELOPMENT_OFFICER;
/** Task 24G — the CV step sits between Information and Assessment. */
export const APPLICATION_STEPS = ["Information", "CV", "Assessment", "Review"] as const;
export const APPLICATION_INFORMATION_STORAGE_KEY = "recruitment-portal:bdm:applicant-information";
export const CV_FILE_METADATA_STORAGE_KEY = "recruitment-portal:bdm:cv-file-metadata";
import type { ApplicantEligibilityAnswers } from "@shared/applicationApi";
export type { ApplicantEligibilityAnswers };

export type ApplicantInformation = {
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  /** Replaces the old freetext job title. Generic across roles. */
  currentStatus: string;
  /**
   * Free-text specification used only when currentStatus === "Other".
   * Not collected or required for any other selection.
   */
  otherStatusText: string;
  totalExperience: string;
  linkedInProfile: string;
};

export const CURRENT_STATUS_OPTIONS = [
  "Currently employed",
  "In transition / seeking opportunities",
  "Self-employed / running a business",
  "Freelance / consulting",
  "Not currently employed",
  "Other",
] as const;

export type CurrentStatusOption = (typeof CURRENT_STATUS_OPTIONS)[number];

export const emptyApplicantInformation: ApplicantInformation = {
  fullName: "",
  email: "",
  phoneNumber: "",
  location: "",
  currentStatus: "",
  otherStatusText: "",
  totalExperience: "",
  linkedInProfile: "",
};

export function loadApplicantEligibilityAnswers(): ApplicantEligibilityAnswers {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem("recruitment-portal:bdm:eligibility-answers");
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ApplicantEligibilityAnswers : {};
  } catch { return {}; }
}

export function saveApplicantEligibilityAnswers(data: ApplicantEligibilityAnswers) {
  if (typeof window !== "undefined") window.localStorage.setItem("recruitment-portal:bdm:eligibility-answers", JSON.stringify(data));
}

export function clearApplicantEligibilityAnswers() {
  if (typeof window !== "undefined") window.localStorage.removeItem("recruitment-portal:bdm:eligibility-answers");
}

export type CvFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export function loadApplicantInformation(): ApplicantInformation {
  if (typeof window === "undefined") return emptyApplicantInformation;
  try {
    const stored = window.localStorage.getItem(APPLICATION_INFORMATION_STORAGE_KEY);
    return stored ? { ...emptyApplicantInformation, ...JSON.parse(stored) } : emptyApplicantInformation;
  } catch {
    return emptyApplicantInformation;
  }
}

export function saveApplicantInformation(data: ApplicantInformation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLICATION_INFORMATION_STORAGE_KEY, JSON.stringify(data));
}

export function loadCvFileMetadata(): CvFileMetadata | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(CV_FILE_METADATA_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveCvFileMetadata(data: CvFileMetadata) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CV_FILE_METADATA_STORAGE_KEY, JSON.stringify(data));
}

export function clearCvFileMetadata() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CV_FILE_METADATA_STORAGE_KEY);
}
