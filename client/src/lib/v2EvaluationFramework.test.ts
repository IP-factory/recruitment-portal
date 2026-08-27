import { describe, expect, it } from "vitest";
import { V2_BAND_GUIDANCE, V2_EVALUATION_DIMENSIONS, V2_FRAMEWORK_REFERENCE, V2_PIPELINE_STEPS, getV2DimensionProfile, v2ScoreStateLabel } from "@/lib/v2EvaluationFramework";

describe("v2 evaluation framework presentation model", () => {
  it("sources all eight dimensions, weights, and floors from v2 scoring configuration", () => {
    expect(V2_EVALUATION_DIMENSIONS.map((item) => item.dimensionId)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
    expect(V2_EVALUATION_DIMENSIONS.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(V2_EVALUATION_DIMENSIONS.filter((item) => item.floor !== undefined).map((item) => [item.dimensionId, item.floor])).toEqual([["D1", 50], ["D2", 40], ["D5", 50]]);
  });

  it("keeps the v2 pipeline and modifier reference read-only and explicit", () => {
    expect(V2_PIPELINE_STEPS).toEqual(["Eligibility", "Dimension scoring", "Base Assessment Score", "Verification", "Integrity adjustments", "Bonus", "Final Screening Score", "Applied Band"]);
    expect(V2_FRAMEWORK_REFERENCE.verification).toEqual([1, 0.95, 0.85]);
    expect(V2_FRAMEWORK_REFERENCE.integrityPenalty).toBe(10);
    expect(V2_FRAMEWORK_REFERENCE.bonusCap).toBe(5);
  });

  it("exposes the requested band guidance and legacy candidate state", () => {
    expect(V2_BAND_GUIDANCE.map((item) => [item.band, item.range])).toEqual([["A", "80–100"], ["B", "65–79"], ["C", "50–64"], ["D", "Below 50"]]);
    expect(v2ScoreStateLabel()).toEqual({ score: "Legacy", band: "Legacy", help: "This application was assessed using the previous prototype model and does not have a v2 Final Screening Score." });
  });

  it("shows the dimension profile as pending when no v2 candidate result exists", () => {
    const profile = getV2DimensionProfile();
    expect(profile).toHaveLength(8);
    expect(profile.every((item) => item.score === undefined && item.status === "Pending")).toBe(true);
  });
});
