import { describe, expect, it } from "vitest";
import { emptyApplicantEligibilityAnswers, evaluateApplicantEligibility, getEligibilitySummary } from "./eligibilityData";

const eligibleAnswers = {
  ...emptyApplicantEligibilityAnswers,
  abujaAvailability: "abuja" as const,
  rightToWork: "yes" as const,
  outboundWork: "yes" as const,
  verificationConsent: "yes" as const,
};

/** Gate configuration as delivered by the public eligibility endpoint. */
const seededGateConfiguration = { minimumYears: 3 };

describe("Business Development Officer eligibility", () => {
  it("passes all active gates for an eligible applicant", () => {
    const result = evaluateApplicantEligibility(eligibleAnswers, "3–5 years", seededGateConfiguration);
    expect(result).toMatchObject({ outcome: "Eligible", incomplete: false, failedGate: null });
    expect(result.gates.map((gate) => gate.gateId)).toEqual(["G1", "G2", "G3", "G6", "G7"]);
    expect(result.gates.every((gate) => gate.status === "Passed")).toBe(true);
  });

  it("requires a relocation date when Abuja relocation is selected", () => {
    const result = evaluateApplicantEligibility({ ...eligibleAnswers, abujaAvailability: "relocate", plannedRelocationDate: "" }, "3–5 years", seededGateConfiguration);
    expect(result).toMatchObject({ outcome: "Incomplete", incomplete: true, failedGate: null });
  });

  it.each([
    ["G1", { abujaAvailability: "not-relocate" as const }, "3–5 years"],
    ["G2", { rightToWork: "no" as const }, "3–5 years"],
    ["G3", {}, "1–2 years"],
    ["G6", { outboundWork: "no" as const }, "3–5 years"],
    ["G7", { verificationConsent: "no" as const }, "3–5 years"],
  ])("closes the application when %s fails", (gateId, answerOverride, experience) => {
    const result = evaluateApplicantEligibility({ ...eligibleAnswers, ...answerOverride }, experience, seededGateConfiguration);
    expect(result.outcome).toBe("Closed — Eligibility");
    expect(result.incomplete).toBe(false);
    expect(result.failedGate).toBe(gateId);
  });

  it("applies the configured G3 minimum years rather than a hard-coded value", () => {
    const relaxed = evaluateApplicantEligibility(eligibleAnswers, "1–2 years", { minimumYears: 1 });
    expect(relaxed.gates.find((gate) => gate.gateId === "G3")?.status).toBe("Passed");
    const strict = evaluateApplicantEligibility(eligibleAnswers, "3–5 years", { minimumYears: 6 });
    expect(strict.outcome).toBe("Closed — Eligibility");
    expect(strict.failedGate).toBe("G3");
  });

  it("keeps G4 and G5 visible as configuration required and inactive", () => {
    const summary = getEligibilitySummary("unseeded-application");
    expect(summary.activeGateIds).toEqual(["G1", "G2", "G3", "G6", "G7"]);
    expect(summary.gates.find((gate) => gate.id === "G4")).toMatchObject({ status: "Configuration required" });
    expect(summary.gates.find((gate) => gate.id === "G5")).toMatchObject({ status: "Configuration required" });
  });
});
