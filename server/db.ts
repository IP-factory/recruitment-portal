import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { and, asc, eq } from "drizzle-orm";
import { assessmentDimensions, assessmentQuestionAssignments, assessmentQuestions, assessments, eligibilityGates, recruitmentRoles, screeningConfigurations } from "../drizzle/schema";

let database: MySql2Database | null = null;

export function getDatabase(): MySql2Database {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    database = drizzle(mysql.createPool(url));
  }
  return database;
}

export async function getRecruitmentRoleConfiguration(slug: string) {
  const db = getDatabase();
  const role = (await db.select().from(recruitmentRoles).where(eq(recruitmentRoles.slug, slug)).limit(1))[0];
  if (!role) return null;
  const [gates, dimensions, assessmentsForRole, screening] = await Promise.all([
    db.select().from(eligibilityGates).where(eq(eligibilityGates.roleId, role.id)).orderBy(asc(eligibilityGates.displayOrder)),
    db.select().from(assessmentDimensions).where(eq(assessmentDimensions.roleId, role.id)).orderBy(asc(assessmentDimensions.displayOrder)),
    db.select().from(assessments).where(eq(assessments.roleId, role.id)).orderBy(asc(assessments.version)),
    db.select().from(screeningConfigurations).where(eq(screeningConfigurations.roleId, role.id)).limit(1),
  ]);
  return { role, gates, dimensions, assessments: assessmentsForRole, screening: screening[0] ?? null };
}

/**
 * RETIRED (Task 24C-3):
 *
 * `getAssessmentConfiguration()` with its `firstQuestionOptions` limitation
 * has been replaced by `getAssessmentPreviewConfiguration()` in
 * `server/assessmentRepository.ts`. That function loads the full Admin detail
 * for ALL assigned questions (options, numericConfig, openConfig, etc.) via
 * `getQuestionDetail()`, not just the first question's options.
 *
 * This stub is kept as a named export so any legacy import resolves without
 * a compile error during the transition; callers should be updated to use
 * the new repository function directly.
 *
 * @deprecated Use `getAssessmentPreviewConfiguration()` from assessmentRepository.ts
 */
export async function getAssessmentConfiguration(slug: string) {
  // Import lazily to avoid a circular dependency at module-load time.
  const { getAssessmentPreviewConfiguration } = await import("./assessmentRepository");
  const preview = await getAssessmentPreviewConfiguration(slug);
  if (!preview) return null;
  // Return a shape compatible enough for any remaining legacy consumer while
  // clearly marking that firstQuestionOptions is gone.
  return {
    assessment: preview,
    assignments: preview.assignments.map((a) => ({
      assignment: { id: a.assignmentId, assessmentId: preview.id, questionId: a.question.id, displayOrder: a.displayOrder, createdAt: new Date() },
      question: a.question,
    })),
    // firstQuestionOptions is intentionally absent. Do not re-introduce it.
  };
}

export async function getActiveAssessmentForRole(roleId: string) {
  const db = getDatabase();
  return (await db.select().from(assessments).where(and(eq(assessments.roleId, roleId), eq(assessments.status, "Active"))).limit(1))[0] ?? null;
}
