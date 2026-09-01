/**
 * Task 24F — submission outcome branching tests.
 *
 * The /submitted route must never render blank: ineligible applicants see
 * the Not Eligible outcome, eligible submitted applicants see the success
 * confirmation, and every other state redirects back into the flow.
 */
import { describe, expect, it } from "vitest";
import { resolveSubmissionOutcome } from "./submissionOutcome";

describe("resolveSubmissionOutcome", () => {
  it("sends applicants without a session back to the information step", () => {
    expect(resolveSubmissionOutcome({ hasSession: false })).toEqual({
      kind: "no-session",
      redirect: "/apply/business-development-officer",
    });
  });

  it("shows the Not Eligible outcome when eligibility is Closed", () => {
    const outcome = resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Closed", applicationStatus: "Eligibility Closed" });
    expect(outcome).toEqual({ kind: "not-eligible" });
    // The outcome page renders in place — no redirect, no blank screen.
    expect(outcome.redirect).toBeUndefined();
  });

  it("keeps the Not Eligible outcome even if other statuses suggest progress", () => {
    expect(resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Closed", applicationStatus: "Submitted" }).kind).toBe("not-eligible");
    expect(resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Closed", applicationStatus: "Assessment Complete" }).kind).toBe("not-eligible");
  });

  it("shows the success confirmation for eligible submitted applications", () => {
    const outcome = resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Eligible", applicationStatus: "Submitted" });
    expect(outcome).toEqual({ kind: "submitted" });
    expect(outcome.redirect).toBeUndefined();
  });

  it("redirects in-progress applications back into the flow", () => {
    expect(resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Eligible", applicationStatus: "Assessment In Progress" })).toEqual({
      kind: "in-progress",
      redirect: "/apply/business-development-officer/review",
    });
  });

  it("handles missing statuses without crashing", () => {
    expect(resolveSubmissionOutcome({ hasSession: true }).kind).toBe("in-progress");
    expect(resolveSubmissionOutcome({ hasSession: true, eligibilityStatus: "Pending", applicationStatus: "In Progress" }).kind).toBe("in-progress");
  });
});
