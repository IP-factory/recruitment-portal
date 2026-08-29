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

// ── Synthetic candidate regression fixture ────────────────────────────────────
//
// Represents the fictional applicant described in the scoring specification:
//   - 7 years BD experience (first target: 2019, currentYear = 2026 → 7 years)
//   - ₦180m target, ₦216m delivered (120% attainment)
//   - Strongest answers throughout
//   - Named referee (V = 1.00)
//   - All three bonus items confirmed
//
// Per-question expected raw scores (before dimension normalisation):
//   D1.Q1  ORDINAL  option "a"           → raw 5/5
//   D3.Q1  MULTI    [a,b,c] = 3+3+2=8   → capped 5/5
//   D2.Q3  ORDINAL  option "a"           → raw 5/5
//   D4.Q1  MULTI    [a,b,c] = 3+3+2=8   → capped 5/5
//   D4.Q2  OPEN     rubric rating 5      → raw 5/5
//   D3.Q3  ORDINAL  option "a"           → raw 5/5
//   D5.Q1  SJT      option "a"           → raw 5/5
//   D2.Q1  OPEN     rubric rating 5      → raw 5/5
//   D2.Q1E EVIDENCE option "a"           → not scored (V = 1.00)
//   D7.Q1  SJT      option "a"           → raw 5/5
//   D1.Q2  NUMERIC  year 2019, 7 yrs ≥5 → raw 5/5
//   D6.Q1  OPEN     rubric rating 5      → raw 5/5
//   D8.Q1  MULTI    [a,b,c,e,f]=2+2+2+1+1=8 → capped 5/5
//   D2.Q2  NUMERIC  120% attainment ≥110 → raw 5/5
//
// All 8 dimensions score 100 (5/5 on all questions with equal qWeight normalisation).
// Base = 100.0 × 1.00 = 100.0
// Bonus = min(7, 5) = 5 → Final = min(100, 100 + 5) = 100 → Band A

describe("synthetic candidate — perfect score fixture", () => {
  const syntheticAnswers = {
    "framework-d1-q1": "a",
    "framework-d3-q1": ["a", "b", "c"],
    "framework-d2-q3": "a",
    "framework-d4-q1": ["a", "b", "c"],
    "framework-d4-q2": "Head of Administration. The relationship started through a corporate accommodation project where I was introduced by an existing client. I worked with the organisation on accommodation requirements for visiting staff.",
    "framework-d3-q3": "a",
    "framework-d5-q1": "a",
    "framework-d2-q1": "Apex Meridian Energy Ltd. — approximately ₦240 million per year. I reached the Head of Administration through a referral from an existing corporate client, then conducted a needs assessment covering staff accommodation, project-team deployment and long-stay requirements.",
    "framework-d2-q1e": "a",
    "framework-d7-q1": "a",
    "framework-d1-q2": { year: "2019" },
    "framework-d6-q1": "Dear Head of Administration, I'm reaching out because embassy postings often require comfortable accommodation for staff staying several weeks or months. Peniel Apartments provides fully serviced apartments in Abuja that can reduce the total cost. I'd welcome 15 minutes to understand your current arrangements.",
    "framework-d8-q1": ["a", "b", "c", "e", "f"],
    "framework-d2-q2": { target: "180000000", actual: "216000000" },
  };

  // All three OPEN questions receive perfect rubric ratings (5/5)
  const syntheticRatings = {
    "framework-d4-q2": 5,
    "framework-d2-q1": 5,
    "framework-d6-q1": 5,
  };

  it("resolves correct raw scores for all objective questions", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    expect(result.scoringReady).toBe(true);

    // ORDINAL
    expect(result.questionResults.find((q) => q.reference === "D1.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D2.Q3")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D3.Q3")?.rawScore).toBe(5);

    // MULTI — all capped at 5
    expect(result.questionResults.find((q) => q.reference === "D3.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D4.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D8.Q1")?.rawScore).toBe(5);

    // SJT
    expect(result.questionResults.find((q) => q.reference === "D5.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D7.Q1")?.rawScore).toBe(5);

    // NUMERIC — D1.Q2: 2026 - 2019 = 7 years → band ≥5 → raw 5
    expect(result.questionResults.find((q) => q.reference === "D1.Q2")?.rawScore).toBe(5);

    // NUMERIC — D2.Q2: 216m/180m = 120% → band ≥110% → raw 5
    expect(result.questionResults.find((q) => q.reference === "D2.Q2")?.rawScore).toBe(5);

    // OPEN — ratings injected directly
    expect(result.questionResults.find((q) => q.reference === "D2.Q1")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D4.Q2")?.rawScore).toBe(5);
    expect(result.questionResults.find((q) => q.reference === "D6.Q1")?.rawScore).toBe(5);

    // EVIDENCE — not scored
    expect(result.questionResults.find((q) => q.reference === "D2.Q1E")?.scoringState).toBe("not-scored");
  });

  it("all eight dimensions score 100", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    expect(result.scoringReady).toBe(true);
    for (const dim of result.dimensionResults) {
      expect(dim.score).toBe(100);
      expect(dim.scoringState).toBe("scored");
    }
  });

  it("base assessment score is 100.0", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    expect(result.baseAssessmentScore).toBe(100.0);
  });

  it("D2.Q2 attainment 120% falls in the ≥110% band for raw score 5", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    const d2q2 = result.questionResults.find((q) => q.reference === "D2.Q2");
    expect(d2q2?.rawScore).toBe(5);
    expect(d2q2?.scoringState).toBe("scored");
  });

  it("D1.Q2 year 2019 derives 7 years experience → raw 5", () => {
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    const d1q2 = result.questionResults.find((q) => q.reference === "D1.Q2");
    expect(d1q2?.rawScore).toBe(5);
  });

  it("pending OPEN dimensions block the base score", () => {
    // Remove D6.Q1 rubric rating — D6 should become unavailable
    const partialRatings = { "framework-d4-q2": 5, "framework-d2-q1": 5 };
    const result = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, partialRatings, 2026);
    expect(result.scoringReady).toBe(false);
    expect(result.questionResults.find((q) => q.reference === "D6.Q1")?.scoringState).toBe("awaiting-rubric");
    const d6 = result.dimensionResults.find((d) => d.dimensionId === "D6");
    expect(d6?.scoringState).toBe("unavailable");
  });
});
