import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { and, asc, eq } from "drizzle-orm";
import { assessmentDimensions, assessmentQuestionAssignments, assessmentQuestions, assessments, eligibilityGates, questionOptions, recruitmentRoles, screeningConfigurations } from "../drizzle/schema";

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
 * TODO (Assessment database-integration phase):
 *
 * This function currently fetches `questionOptions` only for
 * `assignments[0].question.id` and returns them as `firstQuestionOptions`.
 *
 * The Business Development Officer Assessment v2 contains 14 questions, so
 * this is INCORRECT for any consumer that needs options across the full
 * assessment. When the Assessment v2 API is built, this must be replaced with
 * a query that fetches options for ALL assigned questions (e.g. via a WHERE
 * questionId IN (...assignedQuestionIds) query), and the property must be
 * renamed from `firstQuestionOptions` to `questionOptions` (keyed by
 * questionId) so callers cannot accidentally treat the first question's options
 * as representative of the whole assessment.
 *
 * Do not rely on `firstQuestionOptions` in any application code.
 */
export async function getAssessmentConfiguration(slug: string) {
  const db = getDatabase();
  const assessment = (await db.select().from(assessments).where(eq(assessments.slug, slug)).limit(1))[0];
  if (!assessment) return null;
  const assignments = await db.select({ assignment: assessmentQuestionAssignments, question: assessmentQuestions }).from(assessmentQuestionAssignments).innerJoin(assessmentQuestions, eq(assessmentQuestionAssignments.questionId, assessmentQuestions.id)).where(eq(assessmentQuestionAssignments.assessmentId, assessment.id)).orderBy(asc(assessmentQuestionAssignments.displayOrder));
  // NOTE: Only fetches options for the first question — see TODO above.
  const options = assignments.length ? await db.select().from(questionOptions).where(eq(questionOptions.questionId, assignments[0].question.id)) : [];
  return { assessment, assignments, firstQuestionOptions: options };
}

export async function getActiveAssessmentForRole(roleId: string) {
  const db = getDatabase();
  return (await db.select().from(assessments).where(and(eq(assessments.roleId, roleId), eq(assessments.status, "Active"))).limit(1))[0] ?? null;
}
