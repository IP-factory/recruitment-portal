/**
 * Task 24D-1 — public applicant runtime API.
 *
 * All applicant-facing endpoints for creating applications, evaluating
 * eligibility server-side, loading assessments, saving responses, completing
 * assessments, and submitting applications. These endpoints never require
 * Admin authorization; they use the applicant token for access control.
 *
 * Applicant APIs never expose scoring configuration, weights, rubrics,
 * decoy flags, verification multipliers, bands, or internal metadata.
 */
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { eq } from "drizzle-orm";
import { applications, assessments, eligibilityGates, recruitmentRoles } from "../drizzle/schema";
import {
  buildApplicationState,
  checkD1Q1CloseOutcome,
  createApplication,
  createAssessmentAttempt,
  evaluateEligibilityServerSide,
  findApplicationByToken,
  findApplicationById,
  findExistingApplication,
  getActiveAttempt,
  getAssessmentResponses,
  loadApplicantSafeQuestions,
  saveAssessmentResponse,
  startOpenQuestionTimer,
  updateApplicationStatus,
  updateAttemptStatus,
  validateAssessmentCompletion,
  validateAssessmentResponse,
} from "./applicationRepository";
import { getActiveAssessmentForRole } from "./db";
import { getRoleEligibilityGates } from "./recruitmentRepository";
import {
  normalizeEmail,
  validateAssessmentResponseInput,
  validateCreateApplicationInput,
  type ApplicationStatus,
} from "../shared/applicationApi";

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function fail(response: Response, status: number, error: string) {
  response.status(status).json({ ok: false, error });
}

function handleRouteError(context: string) {
  return (error: unknown, response: Response) => {
    // Log the full error detail server-side so the real cause is traceable
    // in server logs without exposing internals to the applicant.
    const detail = error instanceof Error
      ? `${error.message}${error.cause ? ` (cause: ${String(error.cause)})` : ""}`
      : String(error);
    console.error(`[application] ${context} failed:`, detail);
    fail(response, 503, "Unable to process your request.");
  };
}

// ── Applicant token middleware ───────────────────────────────────────────────

function readApplicantToken(request: Request): string | null {
  const header = request.headers["x-application-token"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return null;
}

async function requireApplicantToken(request: Request, response: Response, next: NextFunction) {
  const token = readApplicantToken(request);
  if (!token) {
    fail(response, 401, "Application access is required.");
    return;
  }
  try {
    const application = await findApplicationByToken(token);
    if (!application) {
      fail(response, 403, "Unable to access your application.");
      return;
    }
    (request as Request & { application: typeof application; applicantToken: string }).application = application;
    (request as Request & { application: typeof application; applicantToken: string }).applicantToken = token;
    next();
  } catch (error) {
    console.error("[application] token resolution failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to access your application.");
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createApplicationApiRouter(): Router {
  const router = express.Router();

  // ── Create application ─────────────────────────────────────────────────────

  router.post("/api/public/applications", async (request: Request, response: Response) => {
    if (!databaseConfigured()) return fail(response, 503, "Unable to process your application.");
    try {
      const validated = validateCreateApplicationInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);
      const { input } = validated;

      // Resolve role from database
      const db = (await import("./db")).getDatabase();
      const role = (await db.select().from(recruitmentRoles).where(eq(recruitmentRoles.slug, input.roleSlug)).limit(1))[0];
      if (!role || role.deletedAt) return fail(response, 404, "The selected role is not available.");
      if (role.status !== "Open") return fail(response, 400, "Applications are not currently being accepted for this role.");

      // Check for duplicate application
      const normalizedEmail = normalizeEmail(input.email);
      const existing = await findExistingApplication(role.id, normalizedEmail);
      if (existing) {
        if (existing.applicationStatus === "Submitted" || existing.applicationStatus === "Shortlisted") {
          return fail(response, 409, "You have already submitted an application for this role.");
        }
        if (existing.applicationStatus === "In Progress" || existing.applicationStatus === "Assessment In Progress"
            || existing.applicationStatus === "Eligibility Closed") {
          return fail(response, 409,
            "An application for this role already exists for this email address, but this browser does not have the session required to resume it. " +
            "Please use the browser where you originally started the application.");
        }
      }

      // Load eligibility gates
      const gates = await getRoleEligibilityGates(role.id);

      // Server-side eligibility evaluation
      const eligibilityResult = evaluateEligibilityServerSide(gates, input.eligibility, input.relevantExperience);

      // Resolve active assessment (only needed if eligible)
      const activeAssessment = eligibilityResult.eligible ? await getActiveAssessmentForRole(role.id) : null;

      // Create application
      const { applicationId, applicantToken } = await createApplication(input, role, eligibilityResult, activeAssessment);

      const nextStep = eligibilityResult.eligible ? "assessment" : "eligibility-closed";

      response.status(201).json({
        ok: true,
        applicationId,
        applicantToken,
        eligibilityStatus: eligibilityResult.eligible ? "Eligible" : "Closed",
        applicationStatus: eligibilityResult.eligible ? "In Progress" : "Eligibility Closed",
        eligibility: eligibilityResult,
        nextStep,
      });
    } catch (error) {
      handleRouteError("create application")(error, response);
    }
  });

  // ── Resume application ─────────────────────────────────────────────────────

  router.get("/api/public/applications/me", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;
      const state = await buildApplicationState(application);
      if (!state) return fail(response, 503, "Unable to load your application.");
      response.json({ ok: true, ...state });
    } catch (error) {
      handleRouteError("resume application")(error, response);
    }
  });

  // ── Assessment endpoints ───────────────────────────────────────────────────

  router.get("/api/public/applications/me/assessment", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;

      if (application.eligibilityStatus !== "Eligible") {
        return fail(response, 403, "Your application does not have access to the assessment.");
      }
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        // Assessment already completed — return current state
        const state = await buildApplicationState(application);
        return response.json({ ok: true, completed: true, ...state?.assessment });
      }
      if (!application.assessmentId) {
        return fail(response, 404, "No assessment is configured for this role.");
      }

      // Create or find attempt
      const attempt = await createAssessmentAttempt(application.id, application.assessmentId);
      if (!attempt) return fail(response, 503, "Unable to start your assessment.");

      // Mark attempt as In Progress and update application status
      if (attempt.status === "Not Started") {
        await updateAttemptStatus(attempt.id, "In Progress");
        await updateApplicationStatus(application.id, "Assessment In Progress", "assessment");
      }

      const assessment = (await (await import("./db")).getDatabase().select().from(assessments).where(eq(assessments.id, application.assessmentId)).limit(1))[0];
      if (!assessment) return fail(response, 404, "No assessment is configured for this role.");

      const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
      const existingResponses = await getAssessmentResponses(attempt.id);
      const answeredIds = new Set(existingResponses.map((r) => r.questionId));

      response.json({
        ok: true,
        attemptId: attempt.id,
        assessmentName: assessment.name,
        questionCount: questions.length,
        currentProgress: answeredIds.size,
        questions,
      });
    } catch (error) {
      handleRouteError("load assessment")(error, response);
    }
  });

  // ── Save assessment response ───────────────────────────────────────────────

  router.put("/api/public/applications/me/assessment/responses/:questionId", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;
      const questionId = request.params.questionId;

      if (application.eligibilityStatus !== "Eligible") return fail(response, 403, "Your application does not have access to the assessment.");
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        return fail(response, 400, "Your assessment has already been completed.");
      }

      const validated = validateAssessmentResponseInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);

      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") return fail(response, 400, "Your assessment has already been completed.");

      // Validate response against question configuration
      const validation = await validateAssessmentResponse(questionId, validated.input.responseType, validated.input.responsePayload);
      if (!validation.valid) return fail(response, 400, validation.error);

      // Check D1.Q1 close outcome
      const isCloseOutcome = await checkD1Q1CloseOutcome(questionId, typeof validated.input.responsePayload === "string" ? validated.input.responsePayload : "");
      if (isCloseOutcome) {
        await saveAssessmentResponse(attempt.id, questionId, validated.input.responseType, validated.input.responsePayload, validated.input.elapsedSeconds);
        await updateApplicationStatus(application.id, "Eligibility Closed", "eligibility-closed");
        return response.json({ ok: true, closed: true });
      }

      await saveAssessmentResponse(attempt.id, questionId, validated.input.responseType, validated.input.responsePayload, validated.input.elapsedSeconds);
      response.json({ ok: true });
    } catch (error) {
      handleRouteError("save response")(error, response);
    }
  });

  // ── Start OPEN question timer ──────────────────────────────────────────────

  router.post("/api/public/applications/me/assessment/responses/:questionId/timer", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;
      const questionId = request.params.questionId;

      if (application.eligibilityStatus !== "Eligible") return fail(response, 403, "Your application does not have access to the assessment.");

      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") return fail(response, 400, "Your assessment has already been completed.");

      const timerStartedAt = await startOpenQuestionTimer(attempt.id, questionId);
      response.json({ ok: true, timerStartedAt });
    } catch (error) {
      handleRouteError("start timer")(error, response);
    }
  });

  // ── Complete assessment ────────────────────────────────────────────────────

  router.post("/api/public/applications/me/assessment/complete", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;

      if (application.eligibilityStatus !== "Eligible") return fail(response, 403, "Your application does not have access to the assessment.");
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        return response.json({ ok: true, alreadyComplete: true });
      }
      if (!application.assessmentId) return fail(response, 400, "No assessment is configured for this role.");

      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") {
        return response.json({ ok: true, alreadyComplete: true });
      }

      const completionCheck = await validateAssessmentCompletion(attempt.id, application.assessmentId);
      if (!completionCheck.valid) return fail(response, 400, completionCheck.error);

      await updateAttemptStatus(attempt.id, "Complete");
      await updateApplicationStatus(application.id, "Assessment Complete", "review");

      response.json({ ok: true });
    } catch (error) {
      handleRouteError("complete assessment")(error, response);
    }
  });

  // ── Submit application ─────────────────────────────────────────────────────

  router.post("/api/public/applications/me/submit", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;

      if (application.applicationStatus === "Submitted") {
        // Idempotent: return existing submitted state
        return response.json({ ok: true, alreadySubmitted: true, submittedAt: new Date(application.submittedAt!).toISOString() });
      }
      if (application.eligibilityStatus !== "Eligible") return fail(response, 400, "Your application must pass eligibility to be submitted.");
      if (application.applicationStatus !== "Assessment Complete") {
        return fail(response, 400, "You must complete the assessment before submitting.");
      }

      const db = (await import("./db")).getDatabase();
      await db.update(applications).set({
        applicationStatus: "Submitted" as ApplicationStatus,
        submittedAt: new Date(),
        currentStep: "submitted",
      }).where(eq(applications.id, application.id));

      response.json({ ok: true, submittedAt: new Date().toISOString() });
    } catch (error) {
      handleRouteError("submit application")(error, response);
    }
  });

  // ── Review data (applicant-safe) ──────────────────────────────────────────

  router.get("/api/public/applications/me/review", requireApplicantToken, async (request: Request, response: Response) => {
    try {
      const application = (request as Request & { application: typeof applications.$inferSelect }).application;
      const state = await buildApplicationState(application);
      if (!state) return fail(response, 503, "Unable to load your application.");

      // Build review-specific response data
      const attempt = await getActiveAttempt(application.id);
      const responses = attempt ? await getAssessmentResponses(attempt.id) : [];
      const questionLabels: Record<string, string> = {};

      if (attempt && application.assessmentId) {
        const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
        for (const question of questions) {
          const resp = responses.find((r) => r.questionId === question.id);
          if (resp) {
            if ("options" in question) {
              const payload = resp.responsePayload;
              if (typeof payload === "string") {
                const selectedOption = question.options.find((o) => o.id === payload);
                questionLabels[question.id] = selectedOption?.text ?? payload;
              } else if (Array.isArray(payload)) {
                const texts = (payload as string[]).map((id: string) => {
                  const opt = question.options.find((o) => o.id === id);
                  return opt?.text ?? id;
                });
                questionLabels[question.id] = texts.join(", ");
              }
            } else {
              questionLabels[question.id] = typeof resp.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp.responsePayload);
            }
          }
        }
      }

      response.json({
        ok: true,
        applicant: state.applicant,
        eligibility: state.eligibility,
        assessmentResponses: questionLabels,
        submittedAt: state.submittedAt,
      });
    } catch (error) {
      handleRouteError("review data")(error, response);
    }
  });

  return router;
}
