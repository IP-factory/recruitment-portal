/**
 * Quiet Authority Admin mock data: a single frontend-only source for dashboard activity, applications, and evidence-led candidate review.
 */
import { BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS } from "@/lib/assessmentData";

export type AdminStatus = "Submitted" | "In Progress" | "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Hired";
export type AssessmentState = "Completed" | "In Progress" | "Not Started";
export type ApplicationStage = { label: "Information" | "CV" | "Assessment" | "Review"; state: AssessmentState };
export type CvMetadata = { fileName: string; fileType: "PDF" | "DOCX"; fileSize: string };
export type AssessmentResponse = { questionId: string; selectedOptionId: string; selectedOptionText: string };
export type AdminApplication = {
  id: string;
  candidateName: string;
  email: string;
  phone: string | null;
  location: string | null;
  role: "Business Development Manager";
  currentJobTitle: string | null;
  currentEmployer: string | null;
  totalExperience: string | null;
  businessDevelopmentExperience: string | null;
  linkedin: string | null;
  applicationStatus: AdminStatus;
  assessmentStatus: AssessmentState;
  appliedDate: string;
  appliedDateLabel: string;
  cv: CvMetadata | null;
  assessmentResponses: AssessmentResponse[];
  applicationStages: ApplicationStage[];
};

export const ADMIN_APPLICATIONS_STORAGE_KEY = "recruitment-portal:admin-demo-applications";
const responseSet = (optionIds: readonly string[]): AssessmentResponse[] => BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS.slice(0, optionIds.length).map((question, index) => {
  const option = question.options.find((item) => item.id === optionIds[index]);
  return { questionId: `q-${String(index + 1).padStart(3, "0")}`, selectedOptionId: optionIds[index], selectedOptionText: option?.text ?? "" };
});
const stages = (assessmentStatus: AssessmentState, cv: CvMetadata | null, applicationStatus: AdminStatus): ApplicationStage[] => [
  { label: "Information", state: "Completed" },
  { label: "CV", state: cv ? "Completed" : "Not Started" },
  { label: "Assessment", state: assessmentStatus },
  { label: "Review", state: applicationStatus === "In Progress" ? (assessmentStatus === "Completed" ? "In Progress" : "Not Started") : "Completed" },
];
const cv = (fileName: string, fileType: CvMetadata["fileType"], fileSize: string): CvMetadata => ({ fileName, fileType, fileSize });

export const adminApplications: AdminApplication[] = [
  { id: "app-chinedu-okafor", candidateName: "Chinedu Okafor", email: "chinedu.okafor@example.com", phone: "+234 803 555 0124", location: "Lagos, Nigeria", role: "Business Development Manager", currentJobTitle: "Senior Business Development Executive", currentEmployer: "Crestline Solutions", totalExperience: "7 years", businessDevelopmentExperience: "5 years", linkedin: "linkedin.com/in/chinedu-okafor", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-26", appliedDateLabel: "26 Aug 2026", cv: cv("Chinedu_Okafor_CV.pdf", "PDF", "1.8 MB"), assessmentResponses: responseSet(["d", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Chinedu_Okafor_CV.pdf", "PDF", "1.8 MB"), "Submitted") },
  { id: "app-amina-bello", candidateName: "Amina Bello", email: "amina.bello@example.com", phone: "+234 805 420 1189", location: "Abuja, Nigeria", role: "Business Development Manager", currentJobTitle: "Business Development Lead", currentEmployer: "Northstar Advisory", totalExperience: "8 years", businessDevelopmentExperience: "6 years", linkedin: "linkedin.com/in/amina-bello", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-26", appliedDateLabel: "26 Aug 2026", cv: cv("Amina_Bello_CV.pdf", "PDF", "2.1 MB"), assessmentResponses: responseSet(["e", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Amina_Bello_CV.pdf", "PDF", "2.1 MB"), "Submitted") },
  { id: "app-tunde-adeyemi", candidateName: "Tunde Adeyemi", email: "tunde.adeyemi@example.com", phone: "+234 802 715 4480", location: "Ibadan, Nigeria", role: "Business Development Manager", currentJobTitle: "Commercial Partnerships Officer", currentEmployer: "Meridian Foods", totalExperience: "5 years", businessDevelopmentExperience: "3 years", linkedin: "linkedin.com/in/tunde-adeyemi", applicationStatus: "In Progress", assessmentStatus: "In Progress", appliedDate: "2026-08-25", appliedDateLabel: "25 Aug 2026", cv: cv("Tunde_Adeyemi_CV.docx", "DOCX", "986 KB"), assessmentResponses: responseSet(["c", "c"]), applicationStages: stages("In Progress", cv("Tunde_Adeyemi_CV.docx", "DOCX", "986 KB"), "In Progress") },
  { id: "app-ngozi-eze", candidateName: "Ngozi Eze", email: "ngozi.eze@example.com", phone: "+234 706 311 9037", location: "Enugu, Nigeria", role: "Business Development Manager", currentJobTitle: "Business Development Manager", currentEmployer: "Vertex Services", totalExperience: "9 years", businessDevelopmentExperience: "7 years", linkedin: "linkedin.com/in/ngozi-eze", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-25", appliedDateLabel: "25 Aug 2026", cv: cv("Ngozi_Eze_CV.pdf", "PDF", "1.6 MB"), assessmentResponses: responseSet(["e", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Ngozi_Eze_CV.pdf", "PDF", "1.6 MB"), "Submitted") },
  { id: "app-david-johnson", candidateName: "David Johnson", email: "david.johnson@example.com", phone: null, location: "Port Harcourt, Nigeria", role: "Business Development Manager", currentJobTitle: "Account Executive", currentEmployer: "Atlantic Trade Co.", totalExperience: "4 years", businessDevelopmentExperience: "2 years", linkedin: null, applicationStatus: "In Progress", assessmentStatus: "Not Started", appliedDate: "2026-08-24", appliedDateLabel: "24 Aug 2026", cv: null, assessmentResponses: [], applicationStages: stages("Not Started", null, "In Progress") },
  { id: "app-kemi-adebayo", candidateName: "Kemi Adebayo", email: "kemi.adebayo@example.com", phone: "+234 810 236 5071", location: "Lagos, Nigeria", role: "Business Development Manager", currentJobTitle: "Partnerships Manager", currentEmployer: "Fieldbridge Technologies", totalExperience: "6 years", businessDevelopmentExperience: "4 years", linkedin: "linkedin.com/in/kemi-adebayo", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-24", appliedDateLabel: "24 Aug 2026", cv: cv("Kemi_Adebayo_CV.pdf", "PDF", "1.4 MB"), assessmentResponses: responseSet(["d", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Kemi_Adebayo_CV.pdf", "PDF", "1.4 MB"), "Under Review") },
  { id: "app-ibrahim-musa", candidateName: "Ibrahim Musa", email: "ibrahim.musa@example.com", phone: "+234 809 180 6651", location: "Kano, Nigeria", role: "Business Development Manager", currentJobTitle: "Regional Sales Executive", currentEmployer: "Sahara Distribution", totalExperience: "7 years", businessDevelopmentExperience: "4 years", linkedin: "linkedin.com/in/ibrahim-musa", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-23", appliedDateLabel: "23 Aug 2026", cv: cv("Ibrahim_Musa_CV.pdf", "PDF", "1.9 MB"), assessmentResponses: responseSet(["d", "b", "c", "c", "b"]), applicationStages: stages("Completed", cv("Ibrahim_Musa_CV.pdf", "PDF", "1.9 MB"), "Submitted") },
  { id: "app-adaobi-nwosu", candidateName: "Adaobi Nwosu", email: "adaobi.nwosu@example.com", phone: "+234 701 842 0915", location: "Awka, Nigeria", role: "Business Development Manager", currentJobTitle: "Growth Partnerships Manager", currentEmployer: "Keystone Health", totalExperience: "6 years", businessDevelopmentExperience: "5 years", linkedin: "linkedin.com/in/adaobi-nwosu", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-23", appliedDateLabel: "23 Aug 2026", cv: cv("Adaobi_Nwosu_CV.pdf", "PDF", "1.7 MB"), assessmentResponses: responseSet(["d", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Adaobi_Nwosu_CV.pdf", "PDF", "1.7 MB"), "Under Review") },
  { id: "app-femi-balogun", candidateName: "Femi Balogun", email: "femi.balogun@example.com", phone: "+234 803 677 3004", location: "Lagos, Nigeria", role: "Business Development Manager", currentJobTitle: "Business Growth Specialist", currentEmployer: "Orion Ventures", totalExperience: "5 years", businessDevelopmentExperience: "3 years", linkedin: "linkedin.com/in/femi-balogun", applicationStatus: "Submitted", assessmentStatus: "In Progress", appliedDate: "2026-08-22", appliedDateLabel: "22 Aug 2026", cv: cv("Femi_Balogun_CV.pdf", "PDF", "1.3 MB"), assessmentResponses: responseSet(["c", "c", "c"]), applicationStages: stages("In Progress", cv("Femi_Balogun_CV.pdf", "PDF", "1.3 MB"), "Submitted") },
  { id: "app-zainab-mohammed", candidateName: "Zainab Mohammed", email: "zainab.mohammed@example.com", phone: "+234 806 199 8780", location: "Kaduna, Nigeria", role: "Business Development Manager", currentJobTitle: "Client Relations Officer", currentEmployer: "Harborline Group", totalExperience: "4 years", businessDevelopmentExperience: "2 years", linkedin: null, applicationStatus: "In Progress", assessmentStatus: "Not Started", appliedDate: "2026-08-22", appliedDateLabel: "22 Aug 2026", cv: null, assessmentResponses: [], applicationStages: stages("Not Started", null, "In Progress") },
  { id: "app-emeka-obi", candidateName: "Emeka Obi", email: "emeka.obi@example.com", phone: "+234 812 551 6008", location: "Onitsha, Nigeria", role: "Business Development Manager", currentJobTitle: "Business Development Officer", currentEmployer: "PrimeAxis Logistics", totalExperience: "6 years", businessDevelopmentExperience: "4 years", linkedin: "linkedin.com/in/emeka-obi", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-21", appliedDateLabel: "21 Aug 2026", cv: cv("Emeka_Obi_CV.pdf", "PDF", "1.5 MB"), assessmentResponses: responseSet(["d", "c", "c", "c", "b"]), applicationStages: stages("Completed", cv("Emeka_Obi_CV.pdf", "PDF", "1.5 MB"), "Under Review") },
  { id: "app-bolanle-ajayi", candidateName: "Bolanle Ajayi", email: "bolanle.ajayi@example.com", phone: "+234 807 310 4572", location: "Abeokuta, Nigeria", role: "Business Development Manager", currentJobTitle: "Commercial Development Associate", currentEmployer: "Apex Consumer Products", totalExperience: "4 years", businessDevelopmentExperience: "3 years", linkedin: "linkedin.com/in/bolanle-ajayi", applicationStatus: "Submitted", assessmentStatus: "In Progress", appliedDate: "2026-08-21", appliedDateLabel: "21 Aug 2026", cv: cv("Bolanle_Ajayi_CV.docx", "DOCX", "1.1 MB"), assessmentResponses: responseSet(["c", "b"]), applicationStages: stages("In Progress", cv("Bolanle_Ajayi_CV.docx", "DOCX", "1.1 MB"), "Submitted") },
];

export function getAdminApplications(): AdminApplication[] {
  if (typeof window === "undefined") return adminApplications;
  try {
    const stored = window.localStorage.getItem(ADMIN_APPLICATIONS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length ? parsed as AdminApplication[] : adminApplications;
  } catch { return adminApplications; }
}

export function updateAdminApplicationStatus(id: string, applicationStatus: AdminStatus): AdminApplication[] {
  const updated = getAdminApplications().map((application) => application.id === id ? { ...application, applicationStatus } : application);
  if (typeof window !== "undefined") window.localStorage.setItem(ADMIN_APPLICATIONS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export const adminMockData = {
  metrics: [
    { label: "Total Applications", value: "24", detail: "Business Development Manager" },
    { label: "Completed Applications", value: "18", detail: "6 still in progress" },
    { label: "Assessments Completed", value: "16", detail: "Across submitted applications" },
    { label: "Shortlisted", value: "0", detail: "Shortlisting not started" },
  ],
  recentApplications: adminApplications.slice(0, 5),
  activeRole: {
    title: "Business Development Manager",
    status: "Open" as const,
    applications: "24",
    completed: "18",
    inProgress: "6",
    assessment: "Business Development Assessment",
    statusSummary: [
      { label: "Submitted", value: "18" },
      { label: "In Progress", value: "6" },
      { label: "Shortlisted", value: "0" },
    ],
  },
};
