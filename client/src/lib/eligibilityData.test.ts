import { describe, expect, it } from "vitest";
import { emptyApplicantEligibilityAnswers, evaluateApplicantEligibility, getEligibilitySummary } from "./eligibilityData";

const eligibleAnswers = {
  ...emptyApplicantEligibilityAnswers,
  abujaAvailability: "abuja" as const,
  rightToWork: "yes" as const,
  outboundWork: "yes" as const,
  verificationConsent: "yes" as const,
};

describe("Business Development Officer eligibility", () => {
  it("passes all active gates for an eligible applicant", () => {
    const result = evaluateApplicantEligibility(eligibleAnswers, "3–5 years");
    expect(result).toMatchObject({ outcome: "Eligible", incomplete: false, failedGate: null });
    expect(result.gates.map((gate) => gate.gateId)).toEqual(["G1", "G2", "G3", "G6", "G7"]);
    expect(result.gates.every((gate) => gate.status === "Passed")).toBe(true);
  });

  it("requires a relocation date when Abuja relocation is selected", () => {
    const result = evaluateApplicantEligibility({ ...eligibleAnswers, abujaAvailability: "relocate", plannedRelocationDate: "" }, "3–5 years");
    expect(result).toMatchObject({ outcome: "Incomplete", incomplete: true, failedGate: null });
  });

  it.each([
    ["G1", { abujaAvailability: "not-relocate" as const }, "3–5 years"],
    ["G2", { rightToWork: "no" as const }, "3–5 years"],
    ["G3", {}, "1–2 years"],
    ["G6", { outboundWork: "no" as const }, "3–5 years"],
    ["G7", { verificationConsent: "no" as const }, "3–5 years"],
  ])("closes the application when %s fails", (gateId, answerOverride, experience) => {
    const result = evaluateApplicantEligibility({ ...eligibleAnswers, ...answerOverride }, experience);
    expect(result.outcome).toBe("Closed — Eligibility");
    expect(result.incomplete).toBe(false);
    expect(result.failedGate).toBe(gateId);
  });

  it("keeps G4 and G5 visible as configuration required and inactive", () => {
    const summary = getEligibilitySummary("unseeded-application");
    expect(summary.activeGateIds).toEqual(["G1", "G2", "G3", "G6", "G7"]);
    expect(summary.gates.find((gate) => gate.id === "G4")).toMatchObject({ status: "Configuration required" });
    expect(summary.gates.find((gate) => gate.id === "G5")).toMatchObject({ status: "Configuration required" });
  });
});
