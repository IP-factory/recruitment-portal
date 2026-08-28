/**
 * Task 24D-1 — applicant runtime repository layer.
 *
 * All TiDB access for applications, eligibility responses, assessment
 * attempts and assessment responses. Server-side eligibility evaluation
 * lives here alongside the data access.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  applicationEligibilityResponses,
  applications,
  assessmentAttempts,
  assessmentQuestions,
  assessmentQuestionAssignments,
  assessmentResponses,
  assessments,
  eligibilityGates,
  numericQuestionConfigs,
  openQuestionConfigs,
  questionOptions,
  recruitmentRoles,
} from "../drizzle/schema";
import type {
  ApplicantAssessmentState,
  ApplicantEligibilityInput,
  ApplicantSafeOption,
  ApplicantSafeQuestion,
  ApplicationState,
  ApplicationStatus,
  CreateApplicationInput,
  EligibilityStatus,
  ServerEligibilityGateResult,
  ServerEligibilityResult,
} from "../shared/applicationApi";
import { normalizeEmail } from "../shared/applicationApi";
import { getDatabase } from "./db";

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

// ── Applicant token ──────────────────────────────────────────────────────────

export function generateApplicantToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashApplicantToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Server-side eligibility evaluation ───────────────────────────────────────

const EXPERIENCE_OPTION_MINIMUM_YEARS: Record<string, number> = {
  "No direct experience": 0,
  "Less than 1 year": 0,
  "1–2 years": 1,
  "3–5 years": 3,
  "6–8 years": 6,
  "9+ years": 9,
};

export function evaluateEligibilityServerSide(
  gates: Array<{ id: string; reference: string; gateType: string; status: string; configuration: string }>,
  eligibility: ApplicantEligibilityInput,
  relevantExperience: string,
): ServerEligibilityResult {
  const results: ServerEligibilityGateResult[] = [];

  for (const gate of gates) {
    const config = parseJson<Record<string, unknown>>(gate.configuration, {});

    if (gate.status === "Configuration Required") {
      results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
      continue;
    }

    switch (gate.reference) {
      case "G1": {
        const response = eligibility.abujaAvailability;
        if (response === "not-relocate") {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Failed" });
        } else if (response === "relocate") {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Flagged", flagReason: "Relocation commitment" });
        } else {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Passed" });
        }
        break;
      }
      case "G2": {
        const response = eligibility.rightToWork;
        results.push({ gateId: gate.id, gateReference: "G2", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G3": {
        const minimumYears = typeof config.minimumYears === "number" ? config.minimumYears : 3;
        const represented = EXPERIENCE_OPTION_MINIMUM_YEARS[relevantExperience] ?? 0;
        results.push({ gateId: gate.id, gateReference: "G3", response: relevantExperience, outcome: represented >= minimumYears ? "Passed" : "Failed" });
        break;
      }
      case "G4":
      case "G5": {
        results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
        break;
      }
      case "G6": {
        const response = eligibility.outboundWork;
        results.push({ gateId: gate.id, gateReference: "G6", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G7": {
        const response = eligibility.verificationConsent;
        results.push({ gateId: gate.id, gateReference: "G7", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      default: {
        results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
      }
    }
  }

  const failedGate = results.find((r) => r.outcome === "Failed");
  return {
    eligible: !failedGate,
    gates: results,
    failedGateId: failedGate?.gateId ?? null,
  };
}

// ── Application CRUD ─────────────────────────────────────────────────────────

export async function createApplication(
  input: CreateApplicationInput,
  role: typeof recruitmentRoles.$inferSelect,
  eligibilityResult: ServerEligibilityResult,
  activeAssessment: typeof assessments.$inferSelect | null,
): Promise<{ applicationId: string; applicantToken: string }> {
  const db = getDatabase();
  const token = generateApplicantToken();
  const tokenHash = hashApplicantToken(token);
  const applicationId = `app-${randomBytes(12).toString("hex")}`;
  const eligible = eligibilityResult.eligible;
  const eligibilityStatus: EligibilityStatus = eligible ? "Eligible" : "Closed";
  const applicationStatus: ApplicationStatus = eligible ? "In Progress" : "Eligibility Closed";
  const currentStep = eligible ? "assessment" : "eligibility-closed";

  await db.insert(applications).values({
    id: applicationId,
    roleId: role.id,
    assessmentId: eligible && activeAssessment ? activeAssessment.id : null,
    fullName: input.fullName,
    email: normalizeEmail(input.email),
    phone: input.phone,
    city: input.city,
    recentRole: input.recentRole,
    recentEmployer: input.recentEmployer || null,
    totalExperience: input.totalExperience,
    relevantExperience: input.relevantExperience,
    linkedinUrl: input.linkedinUrl || null,
    eligibilityStatus,
    applicationStatus,
    currentStep,
    applicantTokenHash: tokenHash,
  });

  // Persist eligibility gate responses
  const eligibilityResponses = eligibilityResult.gates.map((gate) => ({
    id: `elig-${randomBytes(8).toString("hex")}`,
    applicationId,
    gateId: gate.gateId,
    gateReference: gate.gateReference,
    responseValue: gate.response,
    outcome: gate.outcome,
    internalFlag: gate.flagReason ?? null,
  }));

  if (eligibilityResponses.length > 0) {
    await db.insert(applicationEligibilityResponses).values(eligibilityResponses);
  }

  return { applicationId, applicantToken: token };
}

export async function findApplicationByToken(token: string) {
  const db = getDatabase();
  const tokenHash = hashApplicantToken(token);
  return (await db.select().from(applications).where(eq(applications.applicantTokenHash, tokenHash)).limit(1))[0] ?? null;
}

export async function findApplicationById(id: string) {
  const db = getDatabase();
  return (await db.select().from(applications).where(eq(applications.id, id)).limit(1))[0] ?? null;
}

export async function findExistingApplication(roleId: string, email: string) {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  return (await db.select().from(applications).where(and(eq(applications.roleId, roleId), eq(applications.email, normalized))).limit(1))[0] ?? null;
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus, step?: string) {
  const db = getDatabase();
  const updates: Record<string, unknown> = { applicationStatus: status };
  if (step) updates.currentStep = step;
  await db.update(applications).set(updates).where(eq(applications.id, applicationId));
}

export async function getApplicationEligibilityResponses(applicationId: string) {
  const db = getDatabase();
  return db.select().from(applicationEligibilityResponses).where(eq(applicationEligibilityResponses.applicationId, applicationId));
}

// ── Application state (applicant-safe) ───────────────────────────────────────

export async function buildApplicationState(application: typeof applications.$inferSelect): Promise<ApplicationState | null> {
  const db = getDatabase();
  const [eligibilityRows, attempt] = await Promise.all([
    db.select().from(applicationEligibilityResponses).where(eq(applicationEligibilityResponses.applicationId, application.id)),
    getActiveAttempt(application.id),
  ]);

  let assessmentState: ApplicantAssessmentState | null = null;
  if (attempt && application.assessmentId) {
    const assessment = (await db.select().from(assessments).where(eq(assessments.id, application.assessmentId)).limit(1))[0];
    if (assessment) {
      const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
      const responseCount = (await db.select({ count: sql<number>`count(*)` }).from(assessmentResponses).where(eq(assessmentResponses.attemptId, attempt.id)))[0]?.count ?? 0;
      assessmentState = {
        attemptId: attempt.id,
        assessmentName: assessment.name,
        questionCount: questions.length,
        currentProgress: responseCount,
        questions,
      };
    }
  }

  return {
    applicationId: application.id,
    currentStep: application.currentStep,
    applicationStatus: application.applicationStatus,
    eligibilityStatus: application.eligibilityStatus,
    applicant: {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      city: application.city,
      recentRole: application.recentRole,
      recentEmployer: application.recentEmployer ?? "",
      totalExperience: application.totalExperience,
      relevantExperience: application.relevantExperience,
      linkedinUrl: application.linkedinUrl ?? "",
    },
    eligibility: {
      gates: eligibilityRows.map((row) => ({
        gateId: row.gateId,
        gateReference: row.gateReference,
        response: row.responseValue,
        outcome: row.outcome as ServerEligibilityGateResult["outcome"],
        ...(row.internalFlag ? { flagReason: row.internalFlag } : {}),
      })),
      eligible: application.eligibilityStatus === "Eligible",
    },
    assessment: assessmentState,
    submittedAt: application.submittedAt ? new Date(application.submittedAt).toISOString() : null,
  };
}

// ── Assessment attempts ──────────────────────────────────────────────────────

export async function getActiveAttempt(applicationId: string) {
  const db = getDatabase();
  return (await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.applicationId, applicationId)).orderBy(asc(assessmentAttempts.createdAt)).limit(1))[0] ?? null;
}

export async function getAttemptById(attemptId: string) {
  const db = getDatabase();
  return (await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId)).limit(1))[0] ?? null;
}

export async function createAssessmentAttempt(applicationId: string, assessmentId: string) {
  const db = getDatabase();
  const existing = await getActiveAttempt(applicationId);
  if (existing) return existing;

  const id = `attempt-${randomBytes(12).toString("hex")}`;
  await db.insert(assessmentAttempts).values({
    id,
    applicationId,
    assessmentId,
    status: "Not Started",
  });
  return (await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, id)).limit(1))[0];
}

export async function updateAttemptStatus(attemptId: string, status: "In Progress" | "Complete") {
  const db = getDatabase();
  const updates: Record<string, unknown> = { status };
  if (status === "Complete") updates.completedAt = new Date();
  await db.update(assessmentAttempts).set(updates).where(eq(assessmentAttempts.id, attemptId));
}

// ── Applicant-safe question loading ──────────────────────────────────────────

export async function loadApplicantSafeQuestions(assessmentId: string, attemptId: string): Promise<ApplicantSafeQuestion[]> {
  const db = getDatabase();
  const assignments = await db
    .select()
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId))
    .orderBy(asc(assessmentQuestionAssignments.displayOrder));

  const questions: ApplicantSafeQuestion[] = [];
  for (const assignment of assignments) {
    const question = (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, assignment.questionId)).limit(1))[0];
    if (!question || question.status !== "Active") continue;

    const safe = await toApplicantSafeQuestion(question, attemptId);
    if (safe) questions.push(safe);
  }
  return questions;
}

async function toApplicantSafeQuestion(
  question: typeof assessmentQuestions.$inferSelect,
  attemptId: string,
): Promise<ApplicantSafeQuestion | null> {
  const db = getDatabase();

  switch (question.questionType) {
    case "ORDINAL":
    case "MULTI":
    case "SJT":
    case "EVIDENCE": {
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, question.id)).orderBy(asc(questionOptions.displayOrder));
      const safeOptions: ApplicantSafeOption[] = options.map((opt) => ({ id: opt.id, text: opt.optionText }));
      return { id: question.id, type: question.questionType, prompt: question.prompt, options: safeOptions } as ApplicantSafeQuestion;
    }
    case "NUMERIC": {
      const numericConfig = (await db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, question.id)).limit(1))[0];
      const inputDefs = numericConfig ? parseJson<Array<{ label: string }>>(numericConfig.inputDefinitions, []) : [];
      return {
        id: question.id,
        type: "NUMERIC",
        prompt: question.prompt,
        inputLabels: inputDefs.map((d) => d.label || ""),
        unit: null,
      };
    }
    case "OPEN": {
      const openConfig = (await db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, question.id)).limit(1))[0];
      let timerStartedAt: string | null = null;
      if (openConfig?.timeLimitSec) {
        const existing = (await db.select().from(assessmentResponses).where(and(eq(assessmentResponses.attemptId, attemptId), eq(assessmentResponses.questionId, question.id))).limit(1))[0];
        if (existing?.startedAt) timerStartedAt = new Date(existing.startedAt).toISOString();
      }
      return {
        id: question.id,
        type: "OPEN",
        prompt: question.prompt,
        maximumWords: openConfig?.maximumWords ?? null,
        timeLimitSec: openConfig?.timeLimitSec ?? null,
        pasteAllowed: Boolean(openConfig?.pasteAllowed),
        timerStartedAt,
      };
    }
    default:
      return null;
  }
}

// ── Assessment response persistence ──────────────────────────────────────────

export async function saveAssessmentResponse(
  attemptId: string,
  questionId: string,
  responseType: string,
  responsePayload: unknown,
  elapsedSeconds: number | undefined,
) {
  const db = getDatabase();
  const existing = (await db.select().from(assessmentResponses).where(and(eq(assessmentResponses.attemptId, attemptId), eq(assessmentResponses.questionId, questionId))).limit(1))[0];

  const payload = typeof responsePayload === "string" ? responsePayload : JSON.stringify(responsePayload);
  const now = new Date();

  if (existing) {
    await db.update(assessmentResponses).set({
      responsePayload: payload,
      answeredAt: now,
      elapsedSeconds: elapsedSeconds ?? null,
    }).where(eq(assessmentResponses.id, existing.id));
  } else {
    const id = `resp-${randomBytes(8).toString("hex")}`;
    await db.insert(assessmentResponses).values({
      id,
      attemptId,
      questionId,
      responseType,
      responsePayload: payload,
      answeredAt: now,
      elapsedSeconds: elapsedSeconds ?? null,
    });
  }
}

export async function startOpenQuestionTimer(attemptId: string, questionId: string) {
  const db = getDatabase();
  const existing = (await db.select().from(assessmentResponses).where(and(eq(assessmentResponses.attemptId, attemptId), eq(assessmentResponses.questionId, questionId))).limit(1))[0];
  if (existing) return existing.startedAt ? new Date(existing.startedAt).toISOString() : null;

  const id = `resp-${randomBytes(8).toString("hex")}`;
  const now = new Date();
  await db.insert(assessmentResponses).values({
    id,
    attemptId,
    questionId,
    responseType: "OPEN",
    responsePayload: "",
    startedAt: now,
  });
  return now.toISOString();
}

export async function getAssessmentResponses(attemptId: string) {
  const db = getDatabase();
  return db.select().from(assessmentResponses).where(eq(assessmentResponses.attemptId, attemptId));
}

// ── Assessment response validation ───────────────────────────────────────────

export async function validateAssessmentResponse(questionId: string, responseType: string, responsePayload: unknown): Promise<{ valid: true } | { valid: false; error: string }> {
  const db = getDatabase();
  const question = (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, questionId)).limit(1))[0];
  if (!question) return { valid: false, error: "Question not found." };
  if (question.questionType !== responseType) return { valid: false, error: "Response type does not match question type." };

  switch (question.questionType) {
    case "ORDINAL":
    case "SJT":
    case "EVIDENCE": {
      if (typeof responsePayload !== "string") return { valid: false, error: "Invalid response format." };
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, questionId));
      if (!options.some((opt) => opt.id === responsePayload)) return { valid: false, error: "Selected option is not valid for this question." };
      return { valid: true };
    }
    case "MULTI": {
      if (!Array.isArray(responsePayload)) return { valid: false, error: "Multi-select requires an array." };
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, questionId));
      const validIds = new Set(options.map((opt) => opt.id));
      if (!responsePayload.every((id) => typeof id === "string" && validIds.has(id))) return { valid: false, error: "One or more selected options are not valid." };
      return { valid: true };
    }
    case "NUMERIC": {
      if (!responsePayload || typeof responsePayload !== "object") return { valid: false, error: "Invalid numeric response format." };
      return { valid: true };
    }
    case "OPEN": {
      if (typeof responsePayload !== "string") return { valid: false, error: "Open response must be a string." };
      const openConfig = (await db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId)).limit(1))[0];
      if (openConfig?.maximumWords) {
        const wordCount = responsePayload.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > openConfig.maximumWords) return { valid: false, error: `Response exceeds the ${openConfig.maximumWords}-word limit.` };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: "Unsupported question type." };
  }
}

// ── Assessment completion ────────────────────────────────────────────────────

export async function validateAssessmentCompletion(attemptId: string, assessmentId: string): Promise<{ valid: true } | { valid: false; error: string }> {
  const db = getDatabase();
  const assignments = await db.select().from(assessmentQuestionAssignments).where(eq(assessmentQuestionAssignments.assessmentId, assessmentId));
  const responses = await db.select().from(assessmentResponses).where(eq(assessmentResponses.attemptId, attemptId));
  const answeredQuestionIds = new Set(responses.map((r) => r.questionId));

  const requiredQuestions = assignments.filter((a) => {
    // Check if the question is required (all assigned questions are required by default)
    return true;
  });

  const missing = requiredQuestions.filter((a) => !answeredQuestionIds.has(a.questionId));
  if (missing.length > 0) {
    return { valid: false, error: `${missing.length} required question${missing.length > 1 ? "s" : ""} ${missing.length > 1 ? "are" : "is"} not answered.` };
  }
  return { valid: true };
}

// ── D1.Q1 close outcome ─────────────────────────────────────────────────────

export async function checkD1Q1CloseOutcome(questionId: string, selectedOptionId: string): Promise<boolean> {
  const db = getDatabase();
  const option = (await db.select().from(questionOptions).where(and(eq(questionOptions.id, selectedOptionId), eq(questionOptions.questionId, questionId))).limit(1))[0];
  if (!option) return false;
  return option.outcomeType === "Close Application / G3";
}
