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
