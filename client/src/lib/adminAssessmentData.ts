/** Quiet Authority assessment data: frontend-only role assignment and question ordering; scores remain in Question Bank. */
import { BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID, BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID, getRecruitmentRoles, type RecruitmentRole } from "@/lib/adminRoleData";
import { FRAMEWORK_QUESTIONS, FRAMEWORK_DRAFT_ORDER } from "@/lib/frameworkQuestionData";
import { getQuestionBankQuestions, hasQuestionConfiguration, type QuestionBankQuestion } from "@/lib/questionBankData";

export type AdminAssessmentStatus = "Active" | "Inactive";
export type AdminAssessment = { id: string; slug: string; name: string; description: string; roleId: string; status: AdminAssessmentStatus; questionIds: string[]; lastUpdated: string; lastUpdatedLabel: string; isUnderDevelopment?: boolean; plannedQuestionCount?: number };
export type AdminAssessmentInput = Pick<AdminAssessment, "name" | "description" | "roleId" | "status" | "questionIds">;
export const ASSESSMENTS_STORAGE_KEY = "recruitment-portal:admin-demo-assessments";
export const BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG = "business-development-assessment";
export const BUSINESS_DEVELOPMENT_OFFICER_V2_ASSESSMENT_SLUG = "business-development-officer-assessment-v2";
const FRAMEWORK_QUESTION_IDS_IN_ORDER = FRAMEWORK_DRAFT_ORDER.map((reference) => FRAMEWORK_QUESTIONS.find((question) => question.reference === reference)?.id).filter((id): id is string => Boolean(id));

const defaultAssessments: AdminAssessment[] = [{
  id: "assessment-business-development", slug: BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG, name: "Business Development Assessment", description: "A role-specific assessment covering relevant Business Development experience and practical commercial judgement.", roleId: BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID, status: "Active", questionIds: ["q-001", "q-002", "q-003", "q-004", "q-005"], lastUpdated: "2026-08-26", lastUpdatedLabel: "26 Aug 2026",
}, {
  id: "assessment-business-development-officer-v2", slug: BUSINESS_DEVELOPMENT_OFFICER_V2_ASSESSMENT_SLUG, name: "Business Development Officer Assessment v2 — Draft", description: "Role-specific screening assessment covering Business Development track record, verified commercial results, sector relevance, Abuja market access, commercial judgement, communication, drive and digital fluency.", roleId: BUSINESS_DEVELOPMENT_OFFICER_ROLE_ID, status: "Inactive", questionIds: FRAMEWORK_QUESTION_IDS_IN_ORDER, lastUpdated: "2026-08-27", lastUpdatedLabel: "27 Aug 2026", isUnderDevelopment: true, plannedQuestionCount: 24,
}];

const cloneDefaults = () => defaultAssessments.map((assessment) => ({ ...assessment, questionIds: [...assessment.questionIds] }));
const labelForDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function readAssessments(): AdminAssessment[] | null { if (typeof window === "undefined") return null; try { const value = window.localStorage.getItem(ASSESSMENTS_STORAGE_KEY); const parsed = value ? JSON.parse(value) : null; return Array.isArray(parsed) && parsed.length ? parsed as AdminAssessment[] : null; } catch { return null; } }
function saveAssessments(assessments: AdminAssessment[]) { if (typeof window !== "undefined") window.localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(assessments)); return assessments; }

export function getAdminAssessments() { const saved = readAssessments(); if (!saved) return cloneDefaults(); const savedSlugs = new Set(saved.map((assessment) => assessment.slug)); return [...saved.map((assessment) => ({ ...assessment, questionIds: [...assessment.questionIds] })), ...defaultAssessments.filter((assessment) => !savedSlugs.has(assessment.slug)).map((assessment) => ({ ...assessment, questionIds: [...assessment.questionIds] }))]; }
export function getAdminAssessment(slug: string) { return getAdminAssessments().find((assessment) => assessment.slug === slug); }
export function getBusinessDevelopmentAssessment() { return getAdminAssessment(BUSINESS_DEVELOPMENT_ASSESSMENT_SLUG) ?? cloneDefaults()[0]; }
export function getAssessmentRole(assessment: AdminAssessment): RecruitmentRole | undefined { return getRecruitmentRoles().find((role) => role.id === assessment.roleId); }
export function getAssessmentQuestions(assessment: AdminAssessment): QuestionBankQuestion[] { const questions = getQuestionBankQuestions(); return assessment.questionIds.flatMap((id) => { const question = questions.find((item) => item.id === id); return question ? [question] : []; }); }
export function getAssessmentReadiness(assessment: AdminAssessment) { const questions = getAssessmentQuestions(assessment); const configured = questions.filter(hasQuestionConfiguration).length; return { total: questions.length, configured, incomplete: questions.length - configured, ready: questions.length > 0 && configured === questions.length }; }
export function getAssessmentSummary() { const assessments = getAdminAssessments(); return { total: assessments.length, active: assessments.filter((assessment) => assessment.status === "Active").length, assignedRoles: new Set(assessments.map((assessment) => assessment.roleId)).size }; }
export function updateAdminAssessment(slug: string, input: AdminAssessmentInput) { let updated: AdminAssessment | undefined; const today = new Date().toISOString().slice(0, 10); const assessments = getAdminAssessments().map((assessment) => { if (assessment.slug !== slug) return assessment; updated = { ...assessment, ...input, questionIds: [...input.questionIds], lastUpdated: today, lastUpdatedLabel: labelForDate(today) }; return updated; }); saveAssessments(assessments); return updated; }
