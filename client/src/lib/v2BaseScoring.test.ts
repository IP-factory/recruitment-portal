import { describe, expect, it } from "vitest";
import { FRAMEWORK_QUESTIONS } from "@/lib/frameworkQuestionData";
import { getApplicantBusinessDevelopmentAssessmentQuestions } from "@/lib/assessmentData";
import { getBusinessDevelopmentAssessment } from "@/lib/adminAssessmentData";
import { calculateV2BaseAssessmentScore, validateV2DimensionWeights } from "@/lib/v2BaseScoring";
import type { QuestionBankQuestion } from "@/lib/questionBankData";

const completeAnswers = (year = 2020) => ({
  "framework-d1-q1": "a",
  "framework-d3-q1": ["a", "b", "c"],
  "framework-d2-q3": "a",
  "framework-d4-q1": ["a", "b"],
  "framework-d4-q2": "A named introduction to the Head of Administration.",
  "framework-d3-q3": "a",
  "framework-d5-q1": "a",
  "framework-d2-q1": "A named client worth 100,000 per year through a referral.",
  "framework-d2-q1e": "a",
  "framework-d7-q1": "a",
  "framework-d1-q2": { year: String(year) },
  "framework-d6-q1": "A concise opening focused on the embassy's accommodation needs.",
  "framework-d8-q1": ["a", "b", "c"],
  "framework-d2-q2": { target: "100", actual: "110" },
});

const completeRatings = { "framework-d4-q2": 4, "framework-d2-q1": 5, "framework-d6-q1": 3 };

describe("v2 base assessment scoring", () => {
  it("keeps the central dimension weights at 100%", () => {
    expect(validateV2DimensionWeights()).toBe(true);
    expect(Object.values({ D1: 22, D2: 18, D3: 14, D4: 12, D5: 12, D6: 8, D7: 8, D8: 6 }).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(validateV2DimensionWeights({ D1: 22, D2: 18, D3: 14, D4: 12, D5: 12, D6: 8, D7: 8, D8: 7 })).toBe(false);
  });

  it("scores the complete 14-question framework using configured options, bands and rubric ratings", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, completeAnswers(2020), completeRatings, 2026);
    expect(result.scoringReady).toBe(true);
    expect(result.baseAssessmentScore).toBe(95.4);
    expect(result.dimensionResults.find((dimension) => dimension.dimensionId === "D4")?.score).toBe(88);
    expect(result.dimensionResults.find((dimension) => dimension.dimensionId === "D4")?.contribution).toBe(10.6);
    expect(result.questionResults.find((question) => question.reference === "D3.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((question) => question.reference === "D1.Q2")?.rawScore).toBe(5);
  });

  it("does not treat the D1.Q1 close outcome as zero", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, { ...completeAnswers(), "framework-d1-q1": "d" }, completeRatings, 2026);
    expect(result.scoringReady).toBe(false);
    expect(result.reasonUnavailable).toBe("Application closed by eligibility outcome.");
    expect(result.questionResults.find((question) => question.reference === "D1.Q1")?.scoringState).toBe("close-outcome");
  });

  it("requires manual Admin rubric ratings for OPEN responses", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, completeAnswers(), { "framework-d4-q2": 4, "framework-d2-q1": 5 }, 2026);
    expect(result.scoringReady).toBe(false);
    expect(result.reasonUnavailable).toBe("Open response awaiting rubric review.");
    expect(result.questionResults.find((question) => question.reference === "D6.Q1")?.scoringState).toBe("awaiting-rubric");
  });

  it("preserves negative SJT raw values while bounding the dimension to zero", () => {
    const sjt = FRAMEWORK_QUESTIONS.find((question) => question.reference === "D5.Q1")!;
    const result = calculateV2BaseAssessmentScore([sjt], { [sjt.id]: "d" }, {}, 2026);
    expect(result.questionResults[0].rawScore).toBe(-2);
    expect(result.dimensionResults.find((dimension) => dimension.dimensionId === "D5")?.score).toBe(0);
    expect(result.dimensionResults.find((dimension) => dimension.dimensionId === "D5")?.contribution).toBe(0);
  });

  it("keeps evidence and gates out of scored denominators", () => {
    const scored = FRAMEWORK_QUESTIONS.find((question) => question.reference === "D1.Q1")!;
    const evidence = FRAMEWORK_QUESTIONS.find((question) => question.reference === "D2.Q1E")!;
    const gate: QuestionBankQuestion = { ...evidence, id: "gate-test", reference: "GATE.TEST", type: "GATE", dimension: "GATE", dimensionLabel: "Gate / Eligibility", qWeight: null, max: null, config: { gateConfig: { options: [] } } };
    const result = calculateV2BaseAssessmentScore([scored, evidence, gate], { [scored.id]: "a", [evidence.id]: "a", [gate.id]: "pass" });
    expect(result.questionResults.find((question) => question.reference === "D2.Q1E")?.scoringState).toBe("not-scored");
    expect(result.questionResults.find((question) => question.reference === "GATE.TEST")?.scoringState).toBe("not-scored");
    expect(result.dimensionResults.find((dimension) => dimension.dimensionId === "D1")?.score).toBe(100);
  });

  it("does not alter the current live five-question assessment projection", () => {
    expect(getApplicantBusinessDevelopmentAssessmentQuestions()).toHaveLength(5);
    expect(getBusinessDevelopmentAssessment().questionIds).toEqual(["q-001", "q-002", "q-003", "q-004", "q-005"]);
  });
});
