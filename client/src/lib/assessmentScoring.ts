/** Quiet Authority assessment scoring: Admin-only deterministic calculations from candidate option selections and Question Bank score maps. */
import { getBusinessDevelopmentAssessment, getAssessmentQuestions } from "@/lib/adminAssessmentData";
import type { AdminApplication, AssessmentResponse, AssessmentState } from "@/lib/adminMockData";
import { DEFAULT_BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestionContent";
import { getQuestionScoreConfiguration, hasQuestionScoring, type QuestionBankQuestion } from "@/lib/questionBankData";

export type AssessmentScoreState = "not-started" | "in-progress" | "unavailable" | "available";
export type ScoreInterpretation = "Strong" | "Good" | "Moderate" | "Limited";
export type CompetencyScore = { competency: string; earnedPoints: number; availablePoints: number; rawPercentage: number; percentage: number };
export type AssessmentScoreResult = {
  state: AssessmentScoreState;
  scoringReady: boolean;
  totalEarnedPoints: number;
  totalAvailablePoints: number;
  rawPercentage: number | null;
  assessmentPercentage: number | null;
  interpretation: ScoreInterpretation | null;
  competencyBreakdown: CompetencyScore[];
  missingScoringQuestionIds: string[];
  missingResponseQuestionIds: string[];
};

const unavailableResult = (state: AssessmentScoreState, overrides: Partial<AssessmentScoreResult> = {}): AssessmentScoreResult => ({ state, scoringReady: false, totalEarnedPoints: 0, totalAvailablePoints: 0, rawPercentage: null, assessmentPercentage: null, interpretation: null, competencyBreakdown: [], missingScoringQuestionIds: [], missingResponseQuestionIds: [], ...overrides });
const scoreStateFor = (status: AssessmentState): AssessmentScoreState => status === "Not Started" ? "not-started" : status === "In Progress" ? "in-progress" : "unavailable";
const legacyQuestionIdFor = (questionId: string) => { const number = Number(questionId.replace("q-", "")); return Number.isInteger(number) && number > 0 ? DEFAULT_BUSINESS_DEVELOPMENT_ASSESSMENT_QUESTIONS[number - 1]?.id : undefined; };
export function getAssessmentResponseForQuestion(responses: AssessmentResponse[], questionId: string) { return responses.find((response) => response.questionId === questionId || response.questionId === legacyQuestionIdFor(questionId)); }

export function getAssessmentInterpretation(percentage: number): ScoreInterpretation { if (percentage >= 80) return "Strong"; if (percentage >= 65) return "Good"; if (percentage >= 50) return "Moderate"; return "Limited"; }

function scoreQuestion(question: QuestionBankQuestion, response: AssessmentResponse) { const scores = getQuestionScoreConfiguration(question.id) ?? {}; return typeof scores[response.selectedOptionId] === "number" ? scores[response.selectedOptionId] : null; }

export function calculateAssessmentScore(application: Pick<AdminApplication, "assessmentStatus" | "assessmentResponses">): AssessmentScoreResult {
  if (application.assessmentStatus !== "Completed") return unavailableResult(scoreStateFor(application.assessmentStatus));
  const assessment = getBusinessDevelopmentAssessment(); const questions = getAssessmentQuestions(assessment);
  if (!questions.length) return unavailableResult("unavailable");
  const missingResponseQuestionIds = questions.filter((question) => { const response = getAssessmentResponseForQuestion(application.assessmentResponses, question.id); return !response || !response.selectedOptionId; }).map((question) => question.id);
  const missingScoringQuestionIds = questions.filter((question) => { const response = getAssessmentResponseForQuestion(application.assessmentResponses, question.id); return !hasQuestionScoring(question) || !response || scoreQuestion(question, response) === null; }).map((question) => question.id);
  if (missingResponseQuestionIds.length || missingScoringQuestionIds.length) return unavailableResult("unavailable", { missingScoringQuestionIds, missingResponseQuestionIds });
  const totalAvailablePoints = questions.length * 5;
  const totalEarnedPoints = questions.reduce((total, question) => total + (scoreQuestion(question, getAssessmentResponseForQuestion(application.assessmentResponses, question.id)!) ?? 0), 0);
  const rawPercentage = totalEarnedPoints / totalAvailablePoints * 100;
  const competencyBreakdown = questions.reduce<CompetencyScore[]>((breakdown, question) => { const current = breakdown.find((entry) => entry.competency === question.competency); const earned = scoreQuestion(question, getAssessmentResponseForQuestion(application.assessmentResponses, question.id)!) ?? 0; if (current) { current.earnedPoints += earned; current.availablePoints += 5; current.rawPercentage = current.earnedPoints / current.availablePoints * 100; current.percentage = Math.round(current.rawPercentage); } else breakdown.push({ competency: question.competency, earnedPoints: earned, availablePoints: 5, rawPercentage: earned / 5 * 100, percentage: Math.round(earned / 5 * 100) }); return breakdown; }, []);
  const assessmentPercentage = Math.round(rawPercentage);
  return { state: "available", scoringReady: true, totalEarnedPoints, totalAvailablePoints, rawPercentage, assessmentPercentage, interpretation: getAssessmentInterpretation(assessmentPercentage), competencyBreakdown, missingScoringQuestionIds: [], missingResponseQuestionIds: [] };
}

export function getAssessmentScoreDisplay(application: Pick<AdminApplication, "assessmentStatus" | "assessmentResponses">) { const result = calculateAssessmentScore(application); if (result.state === "available") return `${result.assessmentPercentage}%`; if (result.state === "unavailable") return "Pending setup"; return "—"; }
