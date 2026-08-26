/**
 * Quiet Authority admin mock data: central, frontend-only recruitment summary data for the Admin dashboard preview.
 */
export type AdminStatus = "Submitted" | "In Progress";
export type AssessmentState = "Completed" | "In Progress" | "Not Started";

export const adminMockData = {
  metrics: [
    { label: "Total Applications", value: "24", detail: "Business Development Manager" },
    { label: "Completed Applications", value: "18", detail: "6 still in progress" },
    { label: "Assessments Completed", value: "16", detail: "Across submitted applications" },
    { label: "Shortlisted", value: "0", detail: "Shortlisting not started" },
  ],
  recentApplications: [
    { candidate: "Chinedu Okafor", role: "Business Development Manager", assessment: "Completed" as AssessmentState, status: "Submitted" as AdminStatus, date: "26 Aug 2026" },
    { candidate: "Amina Bello", role: "Business Development Manager", assessment: "Completed" as AssessmentState, status: "Submitted" as AdminStatus, date: "26 Aug 2026" },
    { candidate: "Tunde Adeyemi", role: "Business Development Manager", assessment: "In Progress" as AssessmentState, status: "In Progress" as AdminStatus, date: "25 Aug 2026" },
    { candidate: "Ngozi Eze", role: "Business Development Manager", assessment: "Completed" as AssessmentState, status: "Submitted" as AdminStatus, date: "25 Aug 2026" },
    { candidate: "David Johnson", role: "Business Development Manager", assessment: "Not Started" as AssessmentState, status: "In Progress" as AdminStatus, date: "24 Aug 2026" },
  ],
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
