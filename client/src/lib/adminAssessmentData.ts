/** Quiet Authority assessment data: frontend-only role assignment and question ordering; scores remain in Question Bank. */
import { BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID, getRecruitmentRoles, type RecruitmentRole } from "@/lib/adminRoleData";
import { getQuestionBankQuestions, hasQuestionScoring, type QuestionBankQuestion } from "@/lib/questionBankData";

export type AdminAssessmentStatus = "Active" | "Inactive";
export type AdminAssessment = { id: string; slug: string; name: string; description: string; roleId: string; status: AdminAssessmentStatus; questionIds: string[]; lastUpdated: string; lastUpdatedLabel: string };
export type AdminAssessmentInput = Pick<AdminAssessment, "name" | "description" | "roleId" | "status" | "questionIds">;
export const ASSESSMENTS_STORAGE_KEY = "recruitment-portal:admin-demo-assessments";
export const BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG = "business-development-assessment";

const defaultAssessments: AdminAssessment[] = [{
  id: "assessment-business-development", slug: BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG, name: "Business Development Assessment", description: "A role-specific assessment covering relevant Business Development experience and practical commercial judgement.", roleId: BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID, status: "Active", questionIds: ["q-001", "q-002", "q-003", "q-004", "q-005"], lastUpdated: "2026-08-26", lastUpdatedLabel: "26 Aug 2026",
}];

const cloneDefaults = () => defaultAssessments.map((assessment) => ({ ...assessment, questionIds: [...assessment.questionIds] }));
const labelForDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function readAssessments(): AdminAssessment[] | null { if (typeof window === "undefined") return null; try { const value = window.localStorage.getItem(ASSESSMENTS_STORAGE_KEY); const parsed = value ? JSON.parse(value) : null; return Array.isArray(parsed) && parsed.length ? parsed as AdminAssessment[] : null; } catch { return null; } }
function saveAssessments(assessments: AdminAssessment[]) { if (typeof window !== "undefined") window.localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(assessments)); return assessments; }

export function getAdminAssessments() { return readAssessments()?.map((assessment) => ({ ...assessment, questionIds: [...assessment.questionIds] })) ?? cloneDefaults(); }
export function getAdminAssessment(slug: string) { return getAdminAssessments().find((assessment) => assessment.slug === slug); }
export function getBusinessDevelopmentAssessment() { return getAdminAssessment(BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG) ?? cloneDefaults()[0]; }
export function getAssessmentRole(assessment: AdminAssessment): RecruitmentRole | undefined { return getRecruitmentRoles().find((role) => role.id === assessment.roleId); }
export function getAssessmentQuestions(assessment: AdminAssessment): QuestionBankQuestion[] { const questions = getQuestionBankQuestions(); return assessment.questionIds.flatMap((id) => { const question = questions.find((item) => item.id === id); return question ? [question] : []; }); }
export function getAssessmentReadiness(assessment: AdminAssessment) { const questions = getAssessmentQuestions(assessment); const configured = questions.filter(hasQuestionScoring).length; return { total: questions.length, configured, incomplete: questions.length - configured, ready: questions.length > 0 && configured === questions.length }; }
export function getAssessmentSummary() { const assessments = getAdminAssessments(); return { total: assessments.length, active: assessments.filter((assessment) => assessment.status === "Active").length, assignedRoles: new Set(assessments.map((assessment) => assessment.roleId)).size }; }
export function updateAdminAssessment(slug: string, input: AdminAssessmentInput) { let updated: AdminAssessment | undefined; const today = new Date().toISOString().slice(0, 10); const assessments = getAdminAssessments().map((assessment) => { if (assessment.slug !== slug) return assessment; updated = { ...assessment, ...input, questionIds: [...input.questionIds], lastUpdated: today, lastUpdatedLabel: labelForDate(today) }; return updated; }); saveAssessments(assessments); return updated; }
