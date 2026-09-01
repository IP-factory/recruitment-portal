/**
 * Task 24F — Role Overview / Assessment tab / Framework tab derivation tests.
 *
 * Every label shown on the Admin role pages must be derived from live linked
 * records. Nothing may be hard-coded to BDO: a synthetic role with its own
 * assessment must render the same derived labels.
 */
import { describe, expect, it } from "vitest";
import type { AdminAssessmentListItem, EvaluationFrameworkConfiguration } from "./recruitmentApi";
import {
  deriveRoleApplicationCounts,
  describeFrameworkState,
  describeLinkedAssessment,
  findLinkedAssessment,
} from "./roleConfigurationDisplay";

function assessment(partial: Partial<AdminAssessmentListItem> & { id: string; roleSlug: string }): AdminAssessmentListItem {
  const { roleSlug, id, ...rest } = partial;
  return {
    id,
    slug: `${id}-slug`,
    name: "Assessment",
    description: "",
    version: 1,
    status: "Draft",
    questionCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
    role: { id: "role-1", slug: roleSlug, title: "Role" },
  };
}

describe("findLinkedAssessment", () => {
  it("returns null when the role has no assessments (synthetic role renders an empty state)", () => {
    expect(findLinkedAssessment([], "operations-analyst")).toBeNull();
    expect(findLinkedAssessment([assessment({ id: "a1", roleSlug: "business-development-officer" })], "operations-analyst")).toBeNull();
  });

  it("prefers the Active assessment for the role", () => {
    const assessments = [
      assessment({ id: "legacy", roleSlug: "business-development-officer", version: 1, status: "Inactive" }),
      assessment({ id: "v2", roleSlug: "business-development-officer", version: 2, status: "Active" }),
      assessment({ id: "other", roleSlug: "other-role", version: 9, status: "Active" }),
    ];
    expect(findLinkedAssessment(assessments, "business-development-officer")?.id).toBe("v2");
  });

  it("falls back to the highest version when no assessment is Active", () => {
    const assessments = [
      assessment({ id: "v1", roleSlug: "synthetic-role", version: 1, status: "Draft" }),
      assessment({ id: "v3", roleSlug: "synthetic-role", version: 3, status: "Draft" }),
      assessment({ id: "v2", roleSlug: "synthetic-role", version: 2, status: "Inactive" }),
    ];
    expect(findLinkedAssessment(assessments, "synthetic-role")?.id).toBe("v3");
  });
});

describe("describeLinkedAssessment", () => {
  it("renders the live BDO v2 summary line", () => {
    const item = assessment({
      id: "bdo-v2",
      roleSlug: "business-development-officer",
      name: "Business Development Officer Assessment v2",
      version: 2,
      status: "Active",
      questionCount: 14,
    });
    expect(describeLinkedAssessment(item)).toBe("Business Development Officer Assessment v2 · Version 2 · Active · 14 questions");
  });

  it("singularises a single question for any role", () => {
    const item = assessment({ id: "s1", roleSlug: "synthetic-role", name: "Synthetic Assessment", version: 1, status: "Draft", questionCount: 1 });
    expect(describeLinkedAssessment(item)).toBe("Synthetic Assessment · Version 1 · Draft · 1 question");
  });
});

describe("describeFrameworkState", () => {
  const frameworkWith = (dimensionCount: number): EvaluationFrameworkConfiguration => ({
    roleId: "role-1",
    dimensions: Array.from({ length: dimensionCount }, (_, i) => ({
      reference: `D${i + 1}`, name: `Dimension ${i + 1}`, weight: 1, minimumFloor: null, displayOrder: i + 1, status: "Active" as const,
    })),
    totalWeight: dimensionCount,
    screening: null,
  });

  it("derives v2 · Active from configured dimensions", () => {
    expect(describeFrameworkState(frameworkWith(8))).toEqual({ label: "v2 · Active", active: true });
  });

  it("derives v2 · Not configured when dimensions are missing", () => {
    expect(describeFrameworkState(frameworkWith(0))).toEqual({ label: "v2 · Not configured", active: false });
    expect(describeFrameworkState(null)).toEqual({ label: "v2 · Not configured", active: false });
  });
});

describe("deriveRoleApplicationCounts", () => {
  const applications = [
    { roleTitle: "Business Development Officer", applicationStatus: "Submitted" },
    { roleTitle: "Business Development Officer", applicationStatus: "Assessment Complete" },
    { roleTitle: "Business Development Officer", applicationStatus: "In Progress" },
    { roleTitle: "Business Development Officer", applicationStatus: "Eligibility Closed" },
    { roleTitle: "Operations Analyst", applicationStatus: "Submitted" },
  ];

  it("derives counts per role from live summaries", () => {
    const counts = deriveRoleApplicationCounts(applications, "Business Development Officer");
    expect(counts).toEqual({ total: 4, submitted: 2, inProgress: 1 });
  });

  it("excludes other roles entirely (synthetic role isolation)", () => {
    expect(deriveRoleApplicationCounts(applications, "Operations Analyst")).toEqual({ total: 1, submitted: 1, inProgress: 0 });
    expect(deriveRoleApplicationCounts(applications, "Nonexistent Role")).toEqual({ total: 0, submitted: 0, inProgress: 0 });
  });

  it("does not count eligibility-closed applications as submitted", () => {
    const counts = deriveRoleApplicationCounts([{ roleTitle: "R", applicationStatus: "Eligibility Closed" }], "R");
    expect(counts.submitted).toBe(0);
  });
});
