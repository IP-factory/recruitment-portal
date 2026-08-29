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
  ApplicantEligibilityAnswers,
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
import type { EligibilityGateConfiguration } from "../shared/recruitmentApi";
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
//
// The evaluator is fully configuration-driven (Task 24E): it dispatches on the
// gate's configured `inputType` and never branches on gate references. Any
// role may declare any number of gates — BDO currently has seven, other roles
// may have four or twelve. APPLICATION_FIELD gates are derived from the
// applicant information payload and never consume an applicant answer.

const DEFAULT_EXPERIENCE_BAND_MINIMUM_YEARS: Record<string, number> = {
  "No direct experience": 0,
  "Less than 1 year": 0,
  "1–2 years": 1,
  "3–5 years": 3,
  "6–8 years": 6,
  "9+ years": 9,
};

type GateEvaluationInput = {
  id: string;
  reference: string;
  status: string;
  configuration: string;
};

function derivedFieldValue(fieldKey: string | undefined, relevantExperience: string): string {
  // The only applicant-information field currently derivable server-side.
  if (fieldKey === "relevantExperience") return relevantExperience;
  return relevantExperience;
}

function evaluateGate(
  config: EligibilityGateConfiguration,
  answer: { value: string; supplementary?: string } | undefined,
  relevantExperience: string,
): ServerEligibilityGateResult & { gateId?: string; gateReference?: string } {
  switch (config.inputType) {
    case "APPLICATION_FIELD": {
      const represented = derivedFieldValue(config.fieldKey, relevantExperience);
      const bands = config.experienceBandMinimumYears ?? DEFAULT_EXPERIENCE_BAND_MINIMUM_YEARS;
      const minimumYears = typeof config.minimumYears === "number" ? config.minimumYears : 0;
      const years = bands[represented] ?? 0;
      return { gateId: "", gateReference: "", response: represented, outcome: years >= minimumYears ? "Passed" : "Failed" };
    }
    case "YES_NO": {
      if (!answer) return { gateId: "", gateReference: "", response: "", outcome: "Failed" };
      const passValue = config.passRule?.match ?? "yes";
      return { gateId: "", gateReference: "", response: answer.value, outcome: answer.value === passValue ? "Passed" : "Failed" };
    }
    case "SINGLE_SELECT": {
      if (!answer) return { gateId: "", gateReference: "", response: "", outcome: "Failed" };
      const option = (config.options ?? []).find((candidate) => candidate.value === answer.value);
      if (!option) return { gateId: "", gateReference: "", response: answer.value, outcome: "Failed" };
      if (option.outcome === "FAIL") return { gateId: "", gateReference: "", response: answer.value, outcome: "Failed" };
      if (option.outcome === "PASS_WITH_FLAG") {
        return { gateId: "", gateReference: "", response: answer.value, outcome: "Flagged", ...(option.flag ? { flagReason: option.flag } : {}) };
      }
      return { gateId: "", gateReference: "", response: answer.value, outcome: "Passed" };
    }
    default: {
      return { gateId: "", gateReference: "", response: "", outcome: "Configuration required" };
    }
  }
}

export function evaluateEligibilityServerSide(
  gates: GateEvaluationInput[],
  eligibility: ApplicantEligibilityAnswers,
  relevantExperience: string,
): ServerEligibilityResult {
  const results: ServerEligibilityGateResult[] = [];

  for (const gate of gates) {
    // Inactive gates are not evaluated and produce no persisted result.
    if (gate.status === "Inactive") continue;

    const config = parseJson<Partial<EligibilityGateConfiguration>>(gate.configuration, {});

    if (gate.status === "Configuration Required" || !config.inputType) {
      results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
      continue;
    }

    const answer = eligibility[gate.reference];
    // Gates that expect an applicant answer but did not receive one are a
    // submission error surfaced as a failure rather than silently passing.
    if (config.inputType !== "APPLICATION_FIELD" && !answer) {
      results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Failed" });
      continue;
    }

    const evaluation = evaluateGate(config as EligibilityGateConfiguration, answer, relevantExperience);
    // Supplementary follow-up fields (e.g. planned relocation date) are
    // persisted with the response value for Admin visibility.
    const responseValue = answer?.supplementary ? `${evaluation.response} | ${config.supplementaryFieldLabel ?? "supplementary"}: ${answer.supplementary}` : evaluation.response;
    results.push({
      gateId: gate.id,
      gateReference: gate.reference,
      response: responseValue,
      outcome: evaluation.outcome,
      ...(evaluation.flagReason ? { flagReason: evaluation.flagReason } : {}),
    });
  }

  // Overall eligibility is decided by blocking gates only: a failed
  // non-blocking gate is recorded but never closes the application.
  const blockingGates = gates.filter((gate) => {
    if (gate.status !== "Active") return false;
    const config = parseJson<Partial<EligibilityGateConfiguration>>(gate.configuration, {});
    return config.isBlocking !== false;
  });
  const blockingReferences = new Set(blockingGates.map((gate) => gate.reference));
  const failedGate = results.find((result) => result.outcome === "Failed" && blockingReferences.has(result.gateReference));

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
