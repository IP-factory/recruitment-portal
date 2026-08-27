/**
 * Quiet Authority submission state: frontend-only readiness checks and local completion status designed to be replaced by a future submission service.
 */
import { getApplicantBusinessDevelopmentAssessmentQuestions, loadAssessmentResponseState } from "@/lib/assessmentData";
import { loadApplicantInformation, loadCvFileMetadata } from "@/lib/applicationData";

export const APPLICATION_SUBMISSION_STORAGE_KEY = "recruitment-portal:bdm:submission-state";

export type ApplicationSubmissionState = { submitted: boolean };
export type ApplicationReadiness = {
  applicantInformationComplete: boolean;
  cvComplete: boolean;
  assessmentComplete: boolean;
  ready: boolean;
};

export function loadApplicationSubmissionState(): ApplicationSubmissionState {
  if (typeof window === "undefined") return { submitted: false };
  try {
    const stored = window.localStorage.getItem(APPLICATION_SUBMISSION_STORAGE_KEY);
    return stored ? { submitted: Boolean(JSON.parse(stored).submitted) } : { submitted: false };
  } catch { return { submitted: false }; }
}

export function saveApplicationSubmissionState(state: ApplicationSubmissionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLICATION_SUBMISSION_STORAGE_KEY, JSON.stringify(state));
}

export function getApplicationReadiness(): ApplicationReadiness {
  const applicant = loadApplicantInformation();
  const applicantInformationComplete = Boolean(applicant.fullName.trim() && applicant.email.trim() && applicant.phoneNumber.trim() && applicant.location.trim() && applicant.jobTitle.trim() && applicant.totalExperience && applicant.businessDevelopmentExperience);
  const cvComplete = Boolean(loadCvFileMetadata());
  const answers = loadAssessmentResponseState().answers;
  const questions = getApplicantBusinessDevelopmentAssessmentQuestions();
  const assessmentComplete = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]));
  return { applicantInformationComplete, cvComplete, assessmentComplete, ready: applicantInformationComplete && cvComplete && assessmentComplete };
}
