/**
 * Quiet Authority application data layer: temporary client-side information storage with a shape designed for future backend replacement.
 */
export const BUSINESS_DEVELOPMENT_MANAGER = "Business Development Manager";
export const APPLICATION_STEPS = ["Information", "CV", "Assessment", "Review"] as const;
export const APPLICATION_INFORMATION_STORAGE_KEY = "recruitment-portal:bdm:applicant-information";

export type ApplicantInformation = {
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  jobTitle: string;
  employer: string;
  totalExperience: string;
  businessDevelopmentExperience: string;
  linkedInProfile: string;
};

export const emptyApplicantInformation: ApplicantInformation = {
  fullName: "",
  email: "",
  phoneNumber: "",
  location: "",
  jobTitle: "",
  employer: "",
  totalExperience: "",
  businessDevelopmentExperience: "",
  linkedInProfile: "",
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
