/**
 * Task 24F — stale-score backfill tests (pure classification layer).
 *
 * The script only recalculates completed BDO v2 applications via the
 * existing scoring engine; legacy assessments are never converted and
 * incomplete attempts are never completed. These tests cover the pure
 * classification and score-change logic so the safety rules are enforced
 * without touching live data.
 */
import { describe, expect, it } from "vitest";
import { classifyBackfillCandidate, describeScoreChange } from "../scripts/backfill-v2-evaluations";

const v2AssessmentIds = new Set(["assessment-v2"]);

describe("classifyBackfillCandidate", () => {
  it("recalculates completed attempts against a v2 assessment", () => {
    const outcome = classifyBackfillCandidate({
      applicationId: "app-1",
      fullName: "Candidate One",
      applicationAssessmentId: "assessment-v2",
      attempt: { assessmentId: "assessment-v2", status: "Complete" },
      v2AssessmentIds,
    });
    expect(outcome.action).toBe("recalculate");
  });

  it("falls back to the attempt's assessment when applications.assessment_id is null", () => {
    const outcome = classifyBackfillCandidate({
      applicationId: "app-2",
      fullName: "Candidate Two",
      applicationAssessmentId: null,
      attempt: { assessmentId: "assessment-v2", status: "Complete" },
      v2AssessmentIds,
    });
    expect(outcome.action).toBe("recalculate");
  });

  it("never converts legacy assessments", () => {
    const outcome = classifyBackfillCandidate({
      applicationId: "app-3",
      fullName: "Candidate Three",
      applicationAssessmentId: "assessment-v1",
      attempt: { assessmentId: "assessment-v1", status: "Complete" },
      v2AssessmentIds,
    });
    expect(outcome).toEqual({
      applicationId: "app-3",
      fullName: "Candidate Three",
      action: "skip",
      reason: "Legacy assessment — not converted",
    });
  });

  it("never completes incomplete attempts", () => {
    for (const status of ["Not Started", "In Progress"]) {
      const outcome = classifyBackfillCandidate({
        applicationId: "app-4",
        fullName: "Candidate Four",
        applicationAssessmentId: "assessment-v2",
        attempt: { assessmentId: "assessment-v2", status },
        v2AssessmentIds,
      });
      expect(outcome.action).toBe("skip");
      expect(outcome.reason).toContain("Attempt not complete");
    }
  });

  it("skips applications without any assessment attempt", () => {
    const outcome = classifyBackfillCandidate({
      applicationId: "app-5",
      fullName: "Candidate Five",
      applicationAssessmentId: null,
      attempt: null,
      v2AssessmentIds,
    });
    expect(outcome).toEqual({
      applicationId: "app-5",
      fullName: "Candidate Five",
      action: "skip",
      reason: "No assessment attempt recorded",
    });
  });
});

describe("describeScoreChange", () => {
  it("treats numerically equal decimal strings as unchanged (idempotency)", () => {
    expect(describeScoreChange("41.30", "41.3")).toBe("unchanged");
    expect(describeScoreChange(null, null)).toBe("unchanged");
  });

  it("flags stale scores as recalculated", () => {
    expect(describeScoreChange("31.0", "41.3")).toBe("recalculated");
    expect(describeScoreChange("24.9", "38.75")).toBe("recalculated");
    expect(describeScoreChange(null, "41.3")).toBe("recalculated");
    expect(describeScoreChange("31.0", null)).toBe("recalculated");
  });
});
