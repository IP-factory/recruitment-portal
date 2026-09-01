/**
 * Task 24F — pure derivation helpers for the Admin role pages.
 *
 * The Role Overview, Assessment tab and Evaluation Framework tab describe
 * live database state only. Nothing here is hard-coded to a specific role:
 * every label is derived from the linked assessment / framework records so
 * any recruitment role renders correctly.
 */
import type { AdminAssessmentListItem, EvaluationFrameworkConfiguration } from "@/lib/recruitmentApi";

/**
 * Resolve the assessment linked to a recruitment role from the admin
 * assessment list. Active assessments take priority; otherwise the highest
 * version wins so the most recent configuration is shown.
 */
export function findLinkedAssessment(assessments: AdminAssessmentListItem[], roleSlug: string): AdminAssessmentListItem | null {
  const linked = assessments.filter((assessment) => assessment.role.slug === roleSlug);
  if (linked.length === 0) return null;
  const active = linked.filter((assessment) => assessment.status === "Active");
  const pool = active.length > 0 ? active : linked;
  return [...pool].sort((a, b) => b.version - a.version)[0];
}

/** Concise live summary line for the linked assessment (Role Overview). */
export function describeLinkedAssessment(assessment: AdminAssessmentListItem): string {
  return `${assessment.name} · Version ${assessment.version} · ${assessment.status} · ${assessment.questionCount} ${assessment.questionCount === 1 ? "question" : "questions"}`;
}

export interface FrameworkStateDescription {
  label: string;
  active: boolean;
}

/**
 * Derive the framework readiness label from live configuration data. A
 * framework is live once dimensions are configured; the screening modifier
 * rules are part of the same v2 pipeline but are not required for the label.
 */
export function describeFrameworkState(framework: EvaluationFrameworkConfiguration | null): FrameworkStateDescription {
  if (framework && framework.dimensions.length > 0) return { label: "v2 · Active", active: true };
  return { label: "v2 · Not configured", active: false };
}

export interface RoleApplicationCounts {
  total: number;
  submitted: number;
  inProgress: number;
}

/**
 * Derive Role Overview application counts from live TiDB summaries. The
 * submitted definition matches the Dashboard/Applications workspaces:
 * everything that is not In Progress and not eligibility-closed.
 */
export function deriveRoleApplicationCounts(
  applications: Array<{ roleTitle: string; applicationStatus: string }>,
  roleTitle: string,
): RoleApplicationCounts {
  const forRole = applications.filter((application) => application.roleTitle === roleTitle);
  return {
    total: forRole.length,
    submitted: forRole.filter((application) => application.applicationStatus !== "In Progress" && application.applicationStatus !== "Eligibility Closed").length,
    inProgress: forRole.filter((application) => application.applicationStatus === "In Progress").length,
  };
}
