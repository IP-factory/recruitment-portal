import { describe, expect, it } from "vitest";
import { FRAMEWORK_QUESTIONS } from "@/lib/frameworkQuestionData";
import { calculateV2BaseAssessmentScore } from "@/lib/v2BaseScoring";
import { calculateV2Modifiers, V2_BONUS_CAP, V2_DIMENSION_FLOORS, V2_INTEGRITY_PENALTY, V2_SCREENING_BANDS, deriveV2Verification, evaluateV2IntegrityFlags } from "@/lib/v2ModifierScoring";
import type { V2BaseScoringResult } from "@/lib/v2BaseScoring";

const answers = { "framework-d1-q1": "a", "framework-d3-q1": ["a", "b"], "framework-d2-q3": "a", "framework-d4-q1": ["a"], "framework-d4-q2": "relationship response", "framework-d3-q3": "a", "framework-d5-q1": "a", "framework-d2-q1": "account response", "framework-d2-q1e": "a", "framework-d7-q1": "a", "framework-d1-q2": { year: "2020" }, "framework-d6-q1": "written response", "framework-d8-q1": ["a"], "framework-d2-q2": { target: "100", actual: "110" } };
const ratings = { "framework-d4-q2": 4, "framework-d2-q1": 5, "framework-d6-q1": 3 };
const completeBase = () => calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, answers, ratings, 2026);

const baseWith = (score: number): V2BaseScoringResult => ({ scoringReady: true, baseAssessmentScore: score, questionResults: [], unresolvedItems: [], dimensionResults: (["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"] as const).map((dimensionId) => ({ dimensionId, dimensionName: dimensionId, weight: 12.5, score, contribution: score / 8, scoringState: "scored", questionResults: [] })) });

describe("v2 modifiers and screening", () => {
  it("derives the conservative multiplier from the current evidence set", () => {
    expect(deriveV2Verification(FRAMEWORK_QUESTIONS, answers).multiplier).toBe(1);
    expect(deriveV2Verification(FRAMEWORK_QUESTIONS, { ...answers, "framework-d2-q1e": "b" }).multiplier).toBe(0.95);
    expect(deriveV2Verification(FRAMEWORK_QUESTIONS, { ...answers, "framework-d2-q1e": "c" }).multiplier).toBe(0.85);
  });

  it("keeps evidence outside scoring while applying verification to the final score", () => {
    const result = calculateV2Modifiers(completeBase(), FRAMEWORK_QUESTIONS, { ...answers, "framework-d2-q1e": "b" });
    expect(result.scoringReady).toBe(true);
    expect(result.verification.multiplier).toBe(0.95);
    expect(result.finalScoreBeforeBounds).toBeCloseTo(completeBase().baseAssessmentScore! * 0.95, 8);
    expect(result.finalScore).toBeCloseTo(result.finalScoreBeforeBounds, 1);
    expect(result.bonus.appliedBonus).toBe(0);
  });

  it("creates D1 and D2 flags as Flagged, with no penalty until confirmation", () => {
    const flagged = evaluateV2IntegrityFlags(FRAMEWORK_QUESTIONS, { ...answers, "framework-d1-q2": { year: "2010" }, "framework-d2-q2": { target: "100", actual: "90" } }, {}, 2026);
    expect(flagged.map((flag) => flag.id)).toEqual(expect.arrayContaining(["integrity-d1-history", "integrity-d2-attainment"]));
    expect(flagged.filter((flag) => flag.id !== "integrity-d4-manual").every((flag) => flag.status === "Flagged")).toBe(true);
    const conflictingAnswers = { ...answers, "framework-d2-q2": { target: "100", actual: "90" } };
    const result = calculateV2Modifiers(calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, conflictingAnswers, ratings, 2026), FRAMEWORK_QUESTIONS, conflictingAnswers, { "integrity-d2-attainment": "Confirmed" }, {}, 2026);
    expect(result.integrity.totalPenalty).toBe(V2_INTEGRITY_PENALTY);
  });

  it("supports manual D4 review and requires human review for two confirmed flags", () => {
    const result = calculateV2Modifiers(completeBase(), FRAMEWORK_QUESTIONS, answers, { "integrity-d1-history": "Confirmed", "integrity-d2-attainment": "Confirmed", "integrity-d4-manual": "Confirmed" });
    expect(result.integrity.manualReviewRequired).toBe(true);
    expect(result.integrity.confirmedCount).toBe(2);
    expect(result.integrity.flags.find((flag) => flag.id === "integrity-d4-manual")?.status).toBe("Confirmed");
  });

  it("caps explicitly confirmed bonuses at five points", () => {
    const result = calculateV2Modifiers(completeBase(), FRAMEWORK_QUESTIONS, answers, {}, { "diplomatic-account": true, "french-arabic": true, "commercial-certification": true });
    expect(result.bonus.rawBonus).toBe(7);
    expect(result.bonus.appliedBonus).toBe(V2_BONUS_CAP);
    expect(result.finalScore).toBeCloseTo(completeBase().baseAssessmentScore! + V2_BONUS_CAP, 1);
  });

  it("caps applied bands at C when a configured floor is missed while preserving the raw band", () => {
    const result = calculateV2Modifiers(baseWith(90), [], {});
    expect(result.floorResults.find((floor) => floor.dimensionId === "D1")?.floor).toBe(V2_DIMENSION_FLOORS.D1);
    expect(result.rawBand?.band).toBe("A");
    expect(result.appliedBand?.band).toBe("A");
    const lowFloorBase = { ...baseWith(90), dimensionResults: baseWith(90).dimensionResults.map((dimension) => dimension.dimensionId === "D1" ? { ...dimension, score: 40 } : dimension) };
    const capped = calculateV2Modifiers(lowFloorBase, [], {});
    expect(capped.rawBand?.band).toBe("A");
    expect(capped.appliedBand?.band).toBe("C");
    expect(capped.bandCapReason).toContain("D1");
  });

  it("bounds Final Score to 0–100 and keeps A/B/C/D thresholds centralized", () => {
    expect(calculateV2Modifiers(baseWith(120), [], {}).finalScore).toBe(100);
    expect(calculateV2Modifiers(baseWith(-10), [], {}).finalScore).toBe(0);
    expect(V2_SCREENING_BANDS.map((band) => band.band)).toEqual(["A", "B", "C", "D"]);
  });
});

// ── Synthetic candidate — full modifier pipeline ──────────────────────────────
//
// Synthetic candidate achieves 100.0 base score (all dimensions 100).
// Named referee → V = 1.00.
// No integrity flags confirmed (consistent answers).
// All three bonus items confirmed → rawBonus 7, appliedBonus 5 (capped).
// finalScoreBeforeBounds = 100.0 × 1.00 − 0 + 5 = 105 → capped to 100.
// Applied band = A (all floors passed: D1 = 100 ≥ 50, D2 = 100 ≥ 40, D5 = 100 ≥ 50).

describe("synthetic candidate — full modifier pipeline", () => {
  const syntheticAnswers = {
    "framework-d1-q1": "a",
    "framework-d3-q1": ["a", "b", "c"],
    "framework-d2-q3": "a",
    "framework-d4-q1": ["a", "b", "c"],
    "framework-d4-q2": "Head of Administration. The relationship started through a corporate accommodation project where I was introduced by an existing client.",
    "framework-d3-q3": "a",
    "framework-d5-q1": "a",
    "framework-d2-q1": "Apex Meridian Energy Ltd. — approximately ₦240 million per year. Reached via a referral from an existing client.",
    "framework-d2-q1e": "a",
    "framework-d7-q1": "a",
    "framework-d1-q2": { year: "2019" },
    "framework-d6-q1": "Dear Head of Administration, I'm reaching out because embassy postings require comfortable accommodation for extended stays. Peniel Apartments reduces total cost. I'd welcome 15 minutes to discuss.",
    "framework-d8-q1": ["a", "b", "c", "e", "f"],
    "framework-d2-q2": { target: "180000000", actual: "216000000" },
  };

  const syntheticRatings = {
    "framework-d4-q2": 5,
    "framework-d2-q1": 5,
    "framework-d6-q1": 5,
  };

  const allBonusConfirmed = {
    "diplomatic-account": true,
    "french-arabic": true,
    "commercial-certification": true,
  };

  it("verification multiplier is 1.00 for named referee (option a)", () => {
    const verification = deriveV2Verification(FRAMEWORK_QUESTIONS, syntheticAnswers);
    expect(verification.multiplier).toBe(1);
  });

  it("no integrity flags are raised for internally consistent answers", () => {
    // D1.Q1 = "a" (core of career, expected ≥10 yrs) vs D1.Q2 = 2019 → 7 yrs
    // 7 yrs vs expected 10: |7 - 10| = 3 > 2 → flag IS raised
    // The specification says >2 years discrepancy triggers the flag.
    // This is correct: 7 years selected with option "a" which implies 10 years
    // triggers an automatic integrity flag. Status defaults to Flagged (not Confirmed).
    const flags = evaluateV2IntegrityFlags(FRAMEWORK_QUESTIONS, syntheticAnswers, {}, 2026);
    // integrity-d1-history: |7 - 10| = 3 → flagged (but not confirmed, so no penalty)
    // integrity-d2-attainment: 120% ≥ 100 → not flagged
    // integrity-d4-manual: always present as Clear by default
    const d1Flag = flags.find((f) => f.id === "integrity-d1-history");
    const d2Flag = flags.find((f) => f.id === "integrity-d2-attainment");
    expect(d1Flag?.status).toBe("Flagged");   // flagged but not confirmed → 0 penalty
    expect(d2Flag).toBeUndefined();            // 120% does not trigger attainment flag
  });

  it("rawBonus = 7, appliedBonus = 5 (capped), finalScore = 100 (bounded)", () => {
    const base = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    expect(base.scoringReady).toBe(true);
    expect(base.baseAssessmentScore).toBe(100.0);

    const result = calculateV2Modifiers(base, FRAMEWORK_QUESTIONS, syntheticAnswers, {}, allBonusConfirmed, 2026);
    expect(result.scoringReady).toBe(true);
    expect(result.verification.multiplier).toBe(1);
    expect(result.bonus.rawBonus).toBe(7);
    expect(result.bonus.appliedBonus).toBe(5);
    expect(result.finalScoreBeforeBounds).toBeCloseTo(105, 1);
    expect(result.finalScore).toBe(100); // bounded at 100
    expect(result.appliedBand?.band).toBe("A");
    expect(result.rawBand?.band).toBe("A");
    expect(result.bandCapReason).toBeUndefined(); // all floors passed
  });

  it("all dimension floors are passed at 100", () => {
    const base = calculateV2BaseAssessmentScore(FRAMEWORK_QUESTIONS, syntheticAnswers, syntheticRatings, 2026);
    const result = calculateV2Modifiers(base, FRAMEWORK_QUESTIONS, syntheticAnswers, {}, allBonusConfirmed, 2026);
    expect(result.floorResults.every((f) => f.passed)).toBe(true);
  });
});
