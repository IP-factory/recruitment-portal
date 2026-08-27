import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, asc, eq } from "drizzle-orm";
import { assessmentDimensions, assessmentQuestionAssignments, assessmentQuestions, assessments, eligibilityGates, questionOptions, recruitmentRoles, screeningConfigurations } from "../drizzle/schema";

let database: any;

export function getDatabase() {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    database = drizzle(mysql.createPool(url));
  }
  return database!;
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

export async function getAssessmentConfiguration(slug: string) {
  const db = getDatabase();
  const assessment = (await db.select().from(assessments).where(eq(assessments.slug, slug)).limit(1))[0];
  if (!assessment) return null;
  const assignments = await db.select({ assignment: assessmentQuestionAssignments, question: assessmentQuestions }).from(assessmentQuestionAssignments).innerJoin(assessmentQuestions, eq(assessmentQuestionAssignments.questionId, assessmentQuestions.id)).where(eq(assessmentQuestionAssignments.assessmentId, assessment.id)).orderBy(asc(assessmentQuestionAssignments.displayOrder));
  const options = assignments.length ? await db.select().from(questionOptions).where(eq(questionOptions.questionId, assignments[0].question.id)) : [];
  return { assessment, assignments, firstQuestionOptions: options };
}

export async function getActiveAssessmentForRole(roleId: string) {
  const db = getDatabase();
  return (await db.select().from(assessments).where(and(eq(assessments.roleId, roleId), eq(assessments.status, "Active"))).limit(1))[0] ?? null;
}
