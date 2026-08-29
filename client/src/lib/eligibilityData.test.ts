import { describe, expect, it } from "vitest";
import { emptyApplicantEligibilityAnswers, getEligibilityOutcome, getEligibilitySummary, isEligibilityClosed } from "./eligibilityData";

/**
 * Task 24E: applicant gate configuration and evaluation are server-driven —
 * these tests cover only the mock candidate-domain summary helpers and the
 * generic answer container. No G1–G7 applicant evaluation lives on the
 * client anymore.
 */

describe("mock candidate eligibility summary", () => {
  it("defaults every mock gate to Passed for an unseeded application", () => {
    const summary = getEligibilitySummary("unseeded-application");
    expect(summary.activeGateIds).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
    expect(summary.outcome).toBe("Eligible");
    expect(summary.gates.every((gate) => gate.status === "Passed")).toBe(true);
  });

  it("flags the relocation commitment for the seeded flagged candidate", () => {
    const summary = getEligibilitySummary("app-chinedu-okafor");
    const g1 = summary.gates.find((gate) => gate.id === "G1");
    expect(g1).toMatchObject({ status: "Flagged", flagReason: "Relocation commitment" });
    expect(summary.relocationStatus).toBe("Flagged");
    expect(summary.outcome).toBe("Eligible");
  });

  it("closes eligibility for the seeded failed candidate", () => {
    const summary = getEligibilitySummary("app-david-johnson");
    expect(summary.gates.find((gate) => gate.id === "G3")).toMatchObject({ status: "Failed" });
    expect(summary.outcome).toBe("Closed — Eligibility");
    expect(getEligibilityOutcome("app-david-johnson")).toBe("Closed — Eligibility");
    expect(isEligibilityClosed({ id: "app-david-johnson" })).toBe(true);
    expect(isEligibilityClosed({ id: "app-amina-bello" })).toBe(false);
  });
});

describe("generic applicant answers", () => {
  it("starts empty because gate references come from the role configuration", () => {
    expect(emptyApplicantEligibilityAnswers).toEqual({});
  });
});
