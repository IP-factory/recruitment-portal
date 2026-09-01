/**
 * Task 24F — Admin display wording tests.
 *
 * The internal enums ("Closed", "Eligibility Closed") remain unchanged in the
 * database and API; only the human-facing label changes to "Not Eligible".
 */
import { describe, expect, it } from "vitest";
import { applicationStatusDisplayLabel, eligibilityDisplayLabel } from "./adminDisplay";

describe("eligibilityDisplayLabel", () => {
  it("renames the internal Closed status to Not Eligible", () => {
    expect(eligibilityDisplayLabel("Closed")).toBe("Not Eligible");
  });

  it("leaves Eligible and Pending untouched", () => {
    expect(eligibilityDisplayLabel("Eligible")).toBe("Eligible");
    expect(eligibilityDisplayLabel("Pending")).toBe("Pending");
  });

  it("falls back to Pending for missing values and passes unknown values through", () => {
    expect(eligibilityDisplayLabel(null)).toBe("Pending");
    expect(eligibilityDisplayLabel(undefined)).toBe("Pending");
    expect(eligibilityDisplayLabel("")).toBe("Pending");
    expect(eligibilityDisplayLabel("Something Else")).toBe("Something Else");
  });
});

describe("applicationStatusDisplayLabel", () => {
  it("renames Eligibility Closed to Not Eligible", () => {
    expect(applicationStatusDisplayLabel("Eligibility Closed")).toBe("Not Eligible");
  });

  it("leaves every other application status untouched", () => {
    for (const status of ["In Progress", "Assessment In Progress", "Assessment Complete", "Submitted", "Shortlisted", "Hold", "Closed"]) {
      expect(applicationStatusDisplayLabel(status)).toBe(status);
    }
  });

  it("falls back to Pending for missing values", () => {
    expect(applicationStatusDisplayLabel(null)).toBe("Pending");
    expect(applicationStatusDisplayLabel(undefined)).toBe("Pending");
  });
});
