/**
 * Quiet Authority Admin mock data: a single frontend-only source for dashboard activity and Applications list records.
 */
export type AdminStatus = "Submitted" | "In Progress" | "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Hired";
export type AssessmentState = "Completed" | "In Progress" | "Not Started";
export type AdminApplication = { id: string; candidateName: string; email: string; role: "Business Development Manager"; applicationStatus: AdminStatus; assessmentStatus: AssessmentState; appliedDate: string; appliedDateLabel: string; };

export const adminApplications: AdminApplication[] = [
  { id: "app-chinedu-okafor", candidateName: "Chinedu Okafor", email: "chinedu.okafor@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-26", appliedDateLabel: "26 Aug 2026" },
  { id: "app-amina-bello", candidateName: "Amina Bello", email: "amina.bello@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-26", appliedDateLabel: "26 Aug 2026" },
  { id: "app-tunde-adeyemi", candidateName: "Tunde Adeyemi", email: "tunde.adeyemi@example.com", role: "Business Development Manager", applicationStatus: "In Progress", assessmentStatus: "In Progress", appliedDate: "2026-08-25", appliedDateLabel: "25 Aug 2026" },
  { id: "app-ngozi-eze", candidateName: "Ngozi Eze", email: "ngozi.eze@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-25", appliedDateLabel: "25 Aug 2026" },
  { id: "app-david-johnson", candidateName: "David Johnson", email: "david.johnson@example.com", role: "Business Development Manager", applicationStatus: "In Progress", assessmentStatus: "Not Started", appliedDate: "2026-08-24", appliedDateLabel: "24 Aug 2026" },
  { id: "app-kemi-adebayo", candidateName: "Kemi Adebayo", email: "kemi.adebayo@example.com", role: "Business Development Manager", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-24", appliedDateLabel: "24 Aug 2026" },
  { id: "app-ibrahim-musa", candidateName: "Ibrahim Musa", email: "ibrahim.musa@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "Completed", appliedDate: "2026-08-23", appliedDateLabel: "23 Aug 2026" },
  { id: "app-adaobi-nwosu", candidateName: "Adaobi Nwosu", email: "adaobi.nwosu@example.com", role: "Business Development Manager", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-23", appliedDateLabel: "23 Aug 2026" },
  { id: "app-femi-balogun", candidateName: "Femi Balogun", email: "femi.balogun@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "In Progress", appliedDate: "2026-08-22", appliedDateLabel: "22 Aug 2026" },
  { id: "app-zainab-mohammed", candidateName: "Zainab Mohammed", email: "zainab.mohammed@example.com", role: "Business Development Manager", applicationStatus: "In Progress", assessmentStatus: "Not Started", appliedDate: "2026-08-22", appliedDateLabel: "22 Aug 2026" },
  { id: "app-emeka-obi", candidateName: "Emeka Obi", email: "emeka.obi@example.com", role: "Business Development Manager", applicationStatus: "Under Review", assessmentStatus: "Completed", appliedDate: "2026-08-21", appliedDateLabel: "21 Aug 2026" },
  { id: "app-bolanle-ajayi", candidateName: "Bolanle Ajayi", email: "bolanle.ajayi@example.com", role: "Business Development Manager", applicationStatus: "Submitted", assessmentStatus: "In Progress", appliedDate: "2026-08-21", appliedDateLabel: "21 Aug 2026" },
];

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
