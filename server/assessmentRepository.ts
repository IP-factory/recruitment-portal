/**
 * Task 24C-3 — Assessment repository layer.
 *
 * Reusable, testable TiDB access for the Admin Assessment configuration
 * domain. Express handlers use these functions instead of embedding Drizzle
 * queries directly. All multi-row writes run in a single transaction.
 *
 * Replaces the `firstQuestionOptions` limitation from `getAssessmentConfiguration()`
 * in db.ts: question options and full configuration are loaded for ALL
 * assigned questions in a single batched query, never just the first.
 */
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  assessmentDimensions,
  assessmentQuestionAssignments,
  assessmentQuestions,
  assessments,
  recruitmentRoles,
} from "../drizzle/schema";
import type {
  AdminAssessmentDetail,
  AdminAssessmentListItem,
  AdminAssessmentListResponse,
  AdminAssessmentPreviewPayload,
  AssessmentCreateInput,
  AssessmentUpdateInput,
  AssignedQuestionFull,
  AssignedQuestionSummary,
} from "../shared/assessmentApi";
import { getQuestionDetail } from "./questionBankRepository";
import { getDatabase } from "./db";

/** Safe 400-class failure carrying a user-facing message. */
export class AssessmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentValidationError";
  }
}

const newId = (prefix: string) => `${prefix}-${randomBytes(12).toString("hex")}`;

/** Slugify a name: lowercase, spaces to hyphens, strip non-alphanumeric/hyphen. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Generate a slug unique within (slug, version) without needing a second round-trip for typical cases. */
async function buildUniqueSlug(name: string, version: number, excludeId?: string): Promise<string> {
  const db = getDatabase();
  const base = slugify(name);
  const slug = base || "assessment";

  const existing = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.slug, slug), eq(assessments.version, version)))
    .limit(1);

  if (existing.length === 0 || (excludeId && existing[0].id === excludeId)) {
    return slug;
  }
  // Append short hex suffix to break collision.
  return `${slug}-${randomBytes(3).toString("hex")}`;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function listAssessments(): Promise<AdminAssessmentListResponse> {
  const db = getDatabase();

  // Count assignments per assessment in a single query.
  const countRows = await db
    .select({
      assessmentId: assessmentQuestionAssignments.assessmentId,
      questionCount: count(assessmentQuestionAssignments.id),
    })
    .from(assessmentQuestionAssignments)
    .groupBy(assessmentQuestionAssignments.assessmentId);

  const countMap = new Map(countRows.map((row) => [row.assessmentId, row.questionCount]));

  const rows = await db
    .select({
      id: assessments.id,
      slug: assessments.slug,
      name: assessments.name,
      description: assessments.description,
      version: assessments.version,
      status: assessments.status,
      createdAt: assessments.createdAt,
      updatedAt: assessments.updatedAt,
      roleId: recruitmentRoles.id,
      roleSlug: recruitmentRoles.slug,
      roleTitle: recruitmentRoles.title,
    })
    .from(assessments)
    .innerJoin(recruitmentRoles, eq(assessments.roleId, recruitmentRoles.id))
    .orderBy(asc(assessments.name), asc(assessments.version));

  const items: AdminAssessmentListItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    role: { id: row.roleId, slug: row.roleSlug, title: row.roleTitle },
    questionCount: countMap.get(row.id) ?? 0,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));

  const roleIds = new Set(items.map((item) => item.role.id));
  const summary = {
    total: items.length,
    active: items.filter((item) => item.status === "Active").length,
    assignedRoles: roleIds.size,
  };

  return { assessments: items, summary };
}

/** Resolve an assessment by id or slug. Version disambiguation: if a slug
 * matches multiple versions, returns the highest version. Callers that need an
 * exact version should pass the database id instead. */
export async function getAssessmentByIdOrSlug(idOrSlug: string): Promise<(typeof assessments.$inferSelect & { roleId: string }) | null> {
  const db = getDatabase();
  // Try id first (exact match).
  const byId = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, idOrSlug))
    .limit(1);
  if (byId[0]) return byId[0];

  // Fall back to slug (take highest version).
  const bySlugs = await db
    .select()
    .from(assessments)
    .where(eq(assessments.slug, idOrSlug))
    .orderBy(asc(assessments.version));
  return bySlugs.at(-1) ?? null;
}

/** Build the concise assignment summary list for an assessment. */
async function getAssignmentSummaries(assessmentId: string): Promise<AssignedQuestionSummary[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      assignmentId: assessmentQuestionAssignments.id,
      displayOrder: assessmentQuestionAssignments.displayOrder,
      questionId: assessmentQuestions.id,
      reference: assessmentQuestions.reference,
      prompt: assessmentQuestions.prompt,
      type: assessmentQuestions.questionType,
      qWeight: assessmentQuestions.qWeight,
      required: assessmentQuestions.required,
      status: assessmentQuestions.status,
      dimensionRef: assessmentDimensions.reference,
      dimensionName: assessmentDimensions.name,
    })
    .from(assessmentQuestionAssignments)
    .innerJoin(assessmentQuestions, eq(assessmentQuestionAssignments.questionId, assessmentQuestions.id))
    .leftJoin(assessmentDimensions, eq(assessmentQuestions.dimensionId, assessmentDimensions.id))
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId))
    .orderBy(asc(assessmentQuestionAssignments.displayOrder));

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    displayOrder: row.displayOrder,
    questionId: row.questionId,
    reference: row.reference,
    prompt: row.prompt,
    type: row.type,
    dimension: row.dimensionRef ? { reference: row.dimensionRef, name: row.dimensionName ?? row.dimensionRef } : null,
    qWeight: row.qWeight,
    required: Boolean(row.required),
    status: row.status,
  }));
}

export async function getAssessment(idOrSlug: string): Promise<AdminAssessmentDetail | null> {
  const db = getDatabase();
  const row = await getAssessmentByIdOrSlug(idOrSlug);
  if (!row) return null;

  const roleRows = await db
    .select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title })
    .from(recruitmentRoles)
    .where(eq(recruitmentRoles.id, row.roleId))
    .limit(1);
  const role = roleRows[0];
  if (!role) return null;

  const countRows = await db
    .select({ value: count(assessmentQuestionAssignments.id) })
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, row.id));
  const questionCount = countRows[0]?.value ?? 0;

  const assignments = await getAssignmentSummaries(row.id);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    role: { id: role.id, slug: role.slug, title: role.title },
    questionCount,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    assignments,
  };
}

/**
 * Returns the full assessment configuration for Preview.
 *
 * This replaces the old `firstQuestionOptions` pattern: question options and
 * all type-specific configuration (options, numericConfig, openConfig, etc.)
 * are loaded for ALL assigned questions in a single batched pass using
 * `getQuestionDetail()` from the Question Bank repository. No data is read for
 * only the first question.
 */
export async function getAssessmentPreviewConfiguration(idOrSlug: string): Promise<AdminAssessmentPreviewPayload | null> {
  const db = getDatabase();
  const row = await getAssessmentByIdOrSlug(idOrSlug);
  if (!row) return null;

  const roleRows = await db
    .select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title })
    .from(recruitmentRoles)
    .where(eq(recruitmentRoles.id, row.roleId))
    .limit(1);
  const role = roleRows[0];
  if (!role) return null;

  // Load assignment rows ordered by display_order.
  const assignmentRows = await db
    .select({
      assignmentId: assessmentQuestionAssignments.id,
      displayOrder: assessmentQuestionAssignments.displayOrder,
      questionId: assessmentQuestions.id,
    })
    .from(assessmentQuestionAssignments)
    .innerJoin(assessmentQuestions, eq(assessmentQuestionAssignments.questionId, assessmentQuestions.id))
    .where(eq(assessmentQuestionAssignments.assessmentId, row.id))
    .orderBy(asc(assessmentQuestionAssignments.displayOrder));

  // Load full question detail for all assigned questions in parallel.
  // This is a batched approach: one parallel set of queries per question,
  // not one serial pass. All assigned questions are fully loaded, not just
  // the first (retiring firstQuestionOptions).
  const questionDetails = await Promise.all(
    assignmentRows.map((assignment) => getQuestionDetail(assignment.questionId)),
  );

  const assignmentsFull: AssignedQuestionFull[] = assignmentRows
    .map((assignment, index) => {
      const detail = questionDetails[index];
      if (!detail) return null;
      return {
        assignmentId: assignment.assignmentId,
        displayOrder: assignment.displayOrder,
        question: detail,
      };
    })
    .filter((item): item is AssignedQuestionFull => item !== null);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    status: row.status,
    role: { id: role.id, slug: role.slug, title: role.title },
    assignments: assignmentsFull,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function createAssessment(input: AssessmentCreateInput): Promise<AdminAssessmentDetail> {
  const db = getDatabase();

  // Validate that the role exists.
  const roleRows = await db
    .select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title })
    .from(recruitmentRoles)
    .where(eq(recruitmentRoles.id, input.roleId))
    .limit(1);
  if (!roleRows[0]) throw new AssessmentValidationError("The selected role does not exist.");

  const slug = await buildUniqueSlug(input.name, input.version);
  const id = newId("assessment");

  await db.insert(assessments).values({
    id,
    slug,
    roleId: input.roleId,
    name: input.name,
    description: input.description,
    status: input.status,
    version: input.version,
  });

  const created = await getAssessment(id);
  if (!created) throw new Error("Assessment insert did not complete");
  return created;
}

/** Update safe metadata fields (name, description). Slug, roleId, version and
 * status are not changed via this method — role and version are structural,
 * and status change to Active is intentionally blocked in this phase. */
export async function updateAssessment(idOrSlug: string, input: AssessmentUpdateInput): Promise<AdminAssessmentDetail | null> {
  const db = getDatabase();
  const existing = await getAssessmentByIdOrSlug(idOrSlug);
  if (!existing) return null;

  await db
    .update(assessments)
    .set({ name: input.name, description: input.description })
    .where(eq(assessments.id, existing.id));

  return getAssessment(existing.id);
}

// ── Assignment management ─────────────────────────────────────────────────────

/** Return the current question count for an assessment. */
export async function getAssignmentCount(assessmentId: string): Promise<number> {
  const db = getDatabase();
  const rows = await db
    .select({ value: count(assessmentQuestionAssignments.id) })
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));
  return rows[0]?.value ?? 0;
}

/**
 * Add a question to an assessment. The question must:
 * - Exist in the Question Bank
 * - Have status Active (Inactive questions cannot be newly assigned)
 * - Not already be assigned to this assessment
 *
 * Returns the updated assignment list ordered by display_order.
 */
export async function addAssessmentQuestion(
  assessmentId: string,
  questionId: string,
): Promise<AssignedQuestionSummary[]> {
  const db = getDatabase();

  // Validate question exists and is active.
  const questionRows = await db
    .select({ id: assessmentQuestions.id, status: assessmentQuestions.status })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.id, questionId))
    .limit(1);
  const question = questionRows[0];
  if (!question) throw new AssessmentValidationError("The selected question does not exist.");
  if (question.status !== "Active") {
    throw new AssessmentValidationError("Only Active questions can be assigned to an assessment.");
  }

  // Enforce unique constraint (also enforced by DB index, but give a clean error).
  const existing = await db
    .select({ id: assessmentQuestionAssignments.id })
    .from(assessmentQuestionAssignments)
    .where(
      and(
        eq(assessmentQuestionAssignments.assessmentId, assessmentId),
        eq(assessmentQuestionAssignments.questionId, questionId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw new AssessmentValidationError("This question is already assigned to the assessment.");
  }

  // Compute next display_order.
  const countRows = await db
    .select({ value: count(assessmentQuestionAssignments.id) })
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));
  const nextOrder = (countRows[0]?.value ?? 0) + 1;

  const assignmentId = newId("assignment");
  await db.insert(assessmentQuestionAssignments).values({
    id: assignmentId,
    assessmentId,
    questionId,
    displayOrder: nextOrder,
  });

  return getAssignmentSummaries(assessmentId);
}

/**
 * Remove a question assignment. Does NOT delete the Question Bank question —
 * only the assignment row is removed. Remaining assignments are re-normalised
 * to a contiguous 1…N sequence.
 */
export async function removeAssessmentQuestion(
  assessmentId: string,
  questionId: string,
): Promise<AssignedQuestionSummary[]> {
  const db = getDatabase();

  const existing = await db
    .select({ id: assessmentQuestionAssignments.id })
    .from(assessmentQuestionAssignments)
    .where(
      and(
        eq(assessmentQuestionAssignments.assessmentId, assessmentId),
        eq(assessmentQuestionAssignments.questionId, questionId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    throw new AssessmentValidationError("This question is not assigned to the assessment.");
  }

  await db.transaction(async (tx) => {
    // Delete the target assignment.
    await tx
      .delete(assessmentQuestionAssignments)
      .where(
        and(
          eq(assessmentQuestionAssignments.assessmentId, assessmentId),
          eq(assessmentQuestionAssignments.questionId, questionId),
        ),
      );

    // Re-normalise the remaining rows to 1…N using a temp ordering approach.
    // Read remaining rows ordered by current display_order, then rewrite.
    const remaining = await tx
      .select({
        id: assessmentQuestionAssignments.id,
        displayOrder: assessmentQuestionAssignments.displayOrder,
      })
      .from(assessmentQuestionAssignments)
      .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId))
      .orderBy(asc(assessmentQuestionAssignments.displayOrder));

    // Assign a large temporary offset to avoid collisions with the
    // assessmentId+displayOrder unique index during re-normalisation.
    const TEMP_OFFSET = 10000;
    for (let i = 0; i < remaining.length; i++) {
      await tx
        .update(assessmentQuestionAssignments)
        .set({ displayOrder: TEMP_OFFSET + i + 1 })
        .where(eq(assessmentQuestionAssignments.id, remaining[i].id));
    }
    // Write the final 1…N values.
    for (let i = 0; i < remaining.length; i++) {
      await tx
        .update(assessmentQuestionAssignments)
        .set({ displayOrder: i + 1 })
        .where(eq(assessmentQuestionAssignments.id, remaining[i].id));
    }
  });

  return getAssignmentSummaries(assessmentId);
}

/**
 * Reorder all assignments for an assessment atomically.
 *
 * `orderedQuestionIds` must contain exactly the currently assigned question IDs
 * (no additions or removals — use add/remove endpoints for those). The
 * display_order sequence becomes 1…N matching the provided order.
 *
 * Uses a transaction to prevent partial updates leaving inconsistent order values.
 */
export async function reorderAssessmentQuestions(
  assessmentId: string,
  orderedQuestionIds: string[],
): Promise<AssignedQuestionSummary[]> {
  const db = getDatabase();

  // Validate that the provided IDs exactly match the current assignments.
  const currentAssignments = await db
    .select({ id: assessmentQuestionAssignments.id, questionId: assessmentQuestionAssignments.questionId })
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));

  const currentIds = new Set(currentAssignments.map((row) => row.questionId));
  if (orderedQuestionIds.length !== currentIds.size) {
    throw new AssessmentValidationError(
      "The reorder list must contain exactly the currently assigned questions.",
    );
  }
  for (const id of orderedQuestionIds) {
    if (!currentIds.has(id)) {
      throw new AssessmentValidationError(
        "The reorder list contains a question not assigned to this assessment.",
      );
    }
  }

  // Build a map from questionId → assignmentId.
  const assignmentById = new Map(currentAssignments.map((row) => [row.questionId, row.id]));

  await db.transaction(async (tx) => {
    // Step 1: Assign large temporary offsets to avoid hitting the unique index
    // on (assessmentId, displayOrder) during intermediate states.
    const TEMP_OFFSET = 10000;
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      const assignmentId = assignmentById.get(orderedQuestionIds[i]);
      if (!assignmentId) continue;
      await tx
        .update(assessmentQuestionAssignments)
        .set({ displayOrder: TEMP_OFFSET + i + 1 })
        .where(eq(assessmentQuestionAssignments.id, assignmentId));
    }
    // Step 2: Write the final 1…N values.
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      const assignmentId = assignmentById.get(orderedQuestionIds[i]);
      if (!assignmentId) continue;
      await tx
        .update(assessmentQuestionAssignments)
        .set({ displayOrder: i + 1 })
        .where(eq(assessmentQuestionAssignments.id, assignmentId));
    }
  });

  return getAssignmentSummaries(assessmentId);
}

/**
 * Atomically replace all question assignments for an assessment.
 *
 * Used when the builder saves a full working set (the existing question list
 * has been reordered, questions added, or questions removed in a single save
 * operation). Runs in a transaction so the assessment is never left in a
 * partially updated state.
 *
 * Rules:
 * - Questions not in the bank or with Inactive status cannot be newly added.
 * - Duplicates in the input list are rejected.
 * - Already-assigned questions with Inactive status are kept if they are in
 *   the incoming list (the caller preserves them explicitly).
 */
export async function replaceAssessmentAssignments(
  assessmentId: string,
  orderedQuestionIds: string[],
): Promise<AssignedQuestionSummary[]> {
  const db = getDatabase();

  // Detect duplicates.
  const seen = new Set<string>();
  for (const id of orderedQuestionIds) {
    if (seen.has(id)) {
      throw new AssessmentValidationError("The assignment list contains a duplicate question.");
    }
    seen.add(id);
  }

  // Validate questions exist and are assignable (allow already-assigned
  // inactive questions to be preserved, but new inactive questions are
  // rejected).
  if (orderedQuestionIds.length > 0) {
    const questionRows = await db
      .select({ id: assessmentQuestions.id, status: assessmentQuestions.status })
      .from(assessmentQuestions)
      .where(inArray(assessmentQuestions.id, orderedQuestionIds));

    const questionMap = new Map(questionRows.map((row) => [row.id, row.status]));
    for (const id of orderedQuestionIds) {
      if (!questionMap.has(id)) {
        throw new AssessmentValidationError(`Question "${id}" does not exist in the Question Bank.`);
      }
    }

    // Load currently assigned IDs to allow inactive questions to be
    // preserved (but not newly introduced).
    const currentRows = await db
      .select({ questionId: assessmentQuestionAssignments.questionId })
      .from(assessmentQuestionAssignments)
      .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));
    const currentlyAssigned = new Set(currentRows.map((row) => row.questionId));

    for (const id of orderedQuestionIds) {
      const status = questionMap.get(id);
      if (status !== "Active" && !currentlyAssigned.has(id)) {
        throw new AssessmentValidationError("Only Active questions can be newly assigned to an assessment.");
      }
    }
  }

  await db.transaction(async (tx) => {
    // Delete all existing assignments.
    await tx
      .delete(assessmentQuestionAssignments)
      .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));

    // Insert the new ordered set.
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      await tx.insert(assessmentQuestionAssignments).values({
        id: newId("assignment"),
        assessmentId,
        questionId: orderedQuestionIds[i],
        displayOrder: i + 1,
      });
    }
  });

  return getAssignmentSummaries(assessmentId);
}
