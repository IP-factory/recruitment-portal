/**
 * Task 24C-3 — shared Assessment API contract.
 *
 * DTO types for the Admin Assessment configuration domain. These shapes are
 * shared by the Express API, the client API module, and the tests. Because
 * all assessment endpoints are Admin-only there are no public projections —
 * scoring configuration and internal question detail may appear here.
 *
 * The status enum mirrors the database: "Draft" | "Active" | "Inactive" |
 * "Archived". The legacy client-only "Active" | "Inactive" subset is no
 * longer the contract.
 */

import type { AdminQuestionDetail, QuestionBankStatus, QuestionDimensionEntry, QuestionType } from "./questionBankApi";

export const ASSESSMENT_STATUSES = ["Draft", "Active", "Inactive", "Archived"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

// ── Assignment shapes ─────────────────────────────────────────────────────────

/**
 * Concise row used in the detail and builder views. Carries just enough to
 * render the ordered list without returning full question configuration.
 */
export interface AssignedQuestionSummary {
  assignmentId: string;
  displayOrder: number;
  questionId: string;
  reference: string;
  prompt: string;
  type: QuestionType;
  dimension: QuestionDimensionEntry | null;
  qWeight: number | null;
  required: boolean;
  status: QuestionBankStatus;
}

/**
 * Full assigned question row for Preview — includes the complete Admin detail
 * required to render each question type (options, numericConfig, openConfig, etc.).
 */
export interface AssignedQuestionFull {
  assignmentId: string;
  displayOrder: number;
  question: AdminQuestionDetail;
}

// ── Assessment list shapes ────────────────────────────────────────────────────

export interface AssessmentRoleSummary {
  id: string;
  slug: string;
  title: string;
}

/** Concise list row — no question assignment detail. */
export interface AdminAssessmentListItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: number;
  status: AssessmentStatus;
  role: AssessmentRoleSummary;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentListSummary {
  total: number;
  active: number;
  assignedRoles: number;
}

export interface AdminAssessmentListResponse {
  assessments: AdminAssessmentListItem[];
  summary: AssessmentListSummary;
}

// ── Assessment detail shape ───────────────────────────────────────────────────

export interface AdminAssessmentDetail extends AdminAssessmentListItem {
  /** Ordered by display_order. */
  assignments: AssignedQuestionSummary[];
}

// ── Assessment preview shape ──────────────────────────────────────────────────

export interface AdminAssessmentPreviewPayload {
  id: string;
  slug: string;
  name: string;
  version: number;
  status: AssessmentStatus;
  role: AssessmentRoleSummary;
  /** Ordered by display_order. Full question detail for each assignment. */
  assignments: AssignedQuestionFull[];
}

// ── Create / update inputs ────────────────────────────────────────────────────

export interface AssessmentCreateInput {
  name: string;
  description: string;
  roleId: string;
  version: number;
  status: AssessmentStatus;
}

export interface AssessmentUpdateInput {
  name: string;
  description: string;
}

// ── Assignment management inputs ──────────────────────────────────────────────

export interface AddQuestionInput {
  questionId: string;
}

export interface ReorderQuestionsInput {
  /** Ordered array of question IDs in the desired new sequence. */
  orderedQuestionIds: string[];
}

// ── Validation error ──────────────────────────────────────────────────────────

export function validateAssessmentCreateInput(candidate: unknown): { input: AssessmentCreateInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Assessment data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) errors.push("Enter an assessment name.");
  else if (name.length > 180) errors.push("Assessment name is too long.");

  const description = typeof value.description === "string" ? value.description.trim() : "";

  const roleId = typeof value.roleId === "string" ? value.roleId.trim() : "";
  if (!roleId) errors.push("Select an assigned role.");

  const version = typeof value.version === "number" && Number.isInteger(value.version) && value.version > 0 ? value.version : null;
  if (version === null) errors.push("Version must be a positive integer.");

  const status = value.status;
  if (typeof status !== "string" || !(ASSESSMENT_STATUSES as readonly string[]).includes(status)) {
    errors.push("Select a valid assessment status.");
  }

  if (errors.length) return { errors };
  return {
    input: {
      name,
      description,
      roleId,
      version: version as number,
      status: status as AssessmentStatus,
    },
  };
}

export function validateAssessmentUpdateInput(candidate: unknown): { input: AssessmentUpdateInput } | { errors: string[] } {
  if (!candidate || typeof candidate !== "object") return { errors: ["Assessment data is missing."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) errors.push("Enter an assessment name.");
  else if (name.length > 180) errors.push("Assessment name is too long.");

  const description = typeof value.description === "string" ? value.description.trim() : "";

  if (errors.length) return { errors };
  return { input: { name, description } };
}
