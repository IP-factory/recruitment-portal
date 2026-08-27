/** Quiet Authority applicant assessment data: local responses with question content read from the Admin assessment assignment, never internal score maps. */
import { getBusinessDevelopmentAssessment } from "@/lib/adminAssessmentData";
import { DEFAULT_BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS, type AssessmentOption, type AssessmentQuestion } from "@/lib/assessmentQuestionContent";
import { getQuestionBankQuestions } from "@/lib/questionBankData";

export type { AssessmentOption, AssessmentQuestion } from "@/lib/assessmentQuestionContent";
export const BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS = DEFAULT_BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS;

export function getApplicantBusinessDevelopmentAssessmentQuestions(): readonly AssessmentQuestion[] {
  const questions = getQuestionBankQuestions();
  return getBusinessDevelopmentAssessment().questionIds.flatMap((id) => {
    const question = questions.find((item) => item.id === id);
    return question ? [{ id: question.id, category: question.competency, question: question.question, options: question.options }] : [];
  });
}

export type AssessmentResponseState = { answers: Record<string, string>; currentQuestionIndex: number };
export const ASSESSMENT_RESPONSES_STORAGE_KEY = "recruitment-portal:bdm:assessment-responses";
export const emptyAssessmentResponseState: AssessmentResponseState = { answers: {}, currentQuestionIndex: 0 };

export function loadAssessmentResponseState(): AssessmentResponseState {
  const maximumIndex = Math.max(getApplicantBusinessDevelopmentAssessmentQuestions().length - 1, 0);
  if (typeof window === "undefined") return emptyAssessmentResponseState;
  try { const stored = window.localStorage.getItem(ASSESSMENT_RESPONSES_STORAGE_KEY); const parsed = stored ? JSON.parse(stored) : emptyAssessmentResponseState; return { answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {}, currentQuestionIndex: Math.min(Math.max(Number(parsed.currentQuestionIndex) || 0, 0), maximumIndex) }; } catch { return emptyAssessmentResponseState; }
}
export function saveAssessmentResponseState(state: AssessmentResponseState) { if (typeof window !== "undefined") window.localStorage.setItem(ASSESSMENT_RESPONSES_STORAGE_KEY, JSON.stringify(state)); }
