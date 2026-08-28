/**
 * Task 24D-2 — Admin Application API.
 *
 * Protected endpoints for listing real applications, viewing candidate detail,
 * managing OPEN reviews, integrity flags, bonuses, shortlisting, and
 * application status. All endpoints require Task 24B Admin authorization.
 *
 * Error responses use the restrained JSON shape `{ ok: false, error }`.
 * SQL, connection details, and stack traces are never returned.
 */
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { findAdminProfileForUser, readSessionToken, resolveSession } from "./adminAuth";
import { isAdminAuthorized } from "../shared/adminAuth";
import {
  applications,
  applicationBonusReviews,
  applicationDimensionScores,
  applicationEvaluations,
  applicationIntegrityFlags,
  applicationEligibilityResponses,
  applicationShortlist,
  assessmentAttempts,
  assessmentQuestions,
  assessmentQuestionAssignments,
  assessmentResponses as assessmentResponsesTable,
  openQuestionConfigs,
  openResponseReviews,
  openRubricAnchors,
  recruitmentRoles,
} from "../drizzle/schema";
import {
  validateOpenReviewInput,
  validateIntegrityFlagInput,
  validateBonusInput,
  validateShortlistInput,
  validateApplicationStatusInput,
  BONUS_TYPES,
  type AdminApplicationSummary,
  type EvaluationStatus,
  type ScreeningBand,
} from "../shared/adminApplicationApi";
import { recalculateAndPersistEvaluation, loadQuestionScoringConfigs, scoreObjectiveQuestion, resolveEvidenceMultiplier } from "./evaluationScoring";
import { randomBytes } from "node:crypto";

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function fail(response: Response, status: number, error: string) {
  response.status(status).json({ ok: false, error });
}

/**
 * Server-side-only error logger for Admin Application routes.
 *
 * Walks the `error.cause` chain and surfaces Drizzle/MySQL-specific fields
 * (code, errno, sqlState, sqlMessage) that are required to diagnose schema
 * drift, FK violations, or missing tables — without ever sending them to
 * the browser. The browser response is always the safe, restrained message
 * passed in via `safeMessage`.
 */
function logAdminAppError(context: string, error: unknown, safeMessage: string, response: Response) {
  const entries: Record<string, unknown>[] = [];
  let cursor: unknown = error;
  let depth = 0;
  while (cursor && depth < 5) {
    if (cursor instanceof Error) {
      entries.push({
        depth,
        name: cursor.name,
        message: cursor.message,
        stack: cursor.stack?.split("\n").slice(0, 3).join("\n"),
      });
      cursor = (cursor as Error & { cause?: unknown }).cause;
    } else if (typeof cursor === "object") {
      const e = cursor as Record<string, unknown>;
      entries.push({
        depth,
        code: e.code,
        errno: e.errno,
        sqlState: e.sqlState,
        sqlMessage: e.sqlMessage,
        message: e.message,
      });
      cursor = e.cause;
    } else {
      entries.push({ depth, raw: cursor });
      break;
    }
    depth += 1;
  }
  console.error(`[admin-app] ${context} failed:`, JSON.stringify({ safeMessage, chain: entries }, null, 2));
  fail(response, 503, safeMessage);
}

function generateId(): string {
  return randomBytes(12).toString("hex");
}

/** Task 24B authorization guard — reused from the existing pattern. */
async function requireAuthorizedAdmin(request: Request, response: Response, next: NextFunction) {
  if (!databaseConfigured()) return fail(response, 503, "Unable to load application data.");
  try {
    const token = readSessionToken(request);
    const session = token ? await resolveSession(token) : null;
    const profile = session ? await findAdminProfileForUser(session.user.id) : null;
    if (!session || !isAdminAuthorized(session.user, profile)) {
      return fail(response, 401, "Admin authorization is required.");
    }
    (request as Request & { adminProfileId: string }).adminProfileId = profile!.id;
    next();
  } catch (error) {
    console.error("[admin-app] admin authorization failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to load application data.");
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createAdminApplicationApiRouter(): Router {
  const router = express.Router();

  // NOTE: Authorization is applied per-route below via `requireAuthorizedAdmin`.
  // A router-level `router.use(requireAuthorizedAdmin)` is intentionally NOT
  // used here — Express invokes `router.use(fn)` layers for every request
  // that enters the router, even when no specific route matches, which would
  // block unrelated requests (e.g. /api/health/database) traversing the
  // middleware chain.

  // ── GET /api/admin/applications ───────────────────────────────────────────

  router.get("/api/admin/applications", requireAuthorizedAdmin, async (request, response) => {
    try {
      const db = (await import("./db")).getDatabase();
      const allApps = await db
        .select({
          id: applications.id,
          fullName: applications.fullName,
          email: applications.email,
          roleId: applications.roleId,
          eligibilityStatus: applications.eligibilityStatus,
          applicationStatus: applications.applicationStatus,
          currentStep: applications.currentStep,
          submittedAt: applications.submittedAt,
          createdAt: applications.createdAt,
          roleTitle: recruitmentRoles.title,
        })
        .from(applications)
        .innerJoin(recruitmentRoles, eq(applications.roleId, recruitmentRoles.id))
        .orderBy(desc(applications.createdAt));

      // Load evaluations and shortlist status
      const appIds = allApps.map((a) => a.id);
      const [evaluations, shortlists] = appIds.length > 0 ? await Promise.all([
        db.select().from(applicationEvaluations).where(sql`${applicationEvaluations.applicationId} IN (${sql.join(appIds.map((id) => sql`${id}`), sql`, `)})`),
        db.select().from(applicationShortlist).where(sql`${applicationShortlist.applicationId} IN (${sql.join(appIds.map((id) => sql`${id}`), sql`, `)})`),
      ]) : [[], []];

      const evalMap = new Map(evaluations.map((e) => [e.applicationId, e]));
      const shortlistMap = new Map(shortlists.map((s) => [s.applicationId, s]));

      // Determine assessment status per application
      const attempts = appIds.length > 0 ? await db
        .select({ applicationId: assessmentAttempts.applicationId, status: assessmentAttempts.status })
        .from(assessmentAttempts)
        .where(sql`${assessmentAttempts.applicationId} IN (${sql.join(appIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];
      const attemptMap = new Map(attempts.map((a) => [a.applicationId, a.status]));

      const summaryApps: AdminApplicationSummary[] = allApps.map((app) => {
        const evaluation = evalMap.get(app.id);
        const shortlist = shortlistMap.get(app.id);
        const attemptStatus = attemptMap.get(app.id);
        const assessmentStatus = !attemptStatus ? "Pending" : attemptStatus === "Complete" ? "Complete" : "In Progress";
        return {
          id: app.id,
          fullName: app.fullName,
          email: app.email,
          roleTitle: app.roleTitle,
          eligibilityStatus: app.eligibilityStatus,
          assessmentStatus,
          applicationStatus: app.applicationStatus,
          finalScore: evaluation?.finalScreeningScore ? Number(evaluation.finalScreeningScore) : null,
          appliedBand: (evaluation?.appliedBand as ScreeningBand | null) ?? null,
          evaluationStatus: (evaluation?.evaluationStatus as EvaluationStatus | null) ?? null,
          shortlisted: shortlist ? shortlist.shortlisted === 1 : false,
          submittedAt: app.submittedAt?.toISOString() ?? null,
          createdAt: app.createdAt.toISOString(),
        };
      });

      // Counts
      const submitted = summaryApps.filter((a) => a.applicationStatus !== "In Progress" && a.applicationStatus !== "Eligibility Closed").length;
      const pendingReview = summaryApps.filter((a) => a.evaluationStatus === "Pending OPEN Review" || a.evaluationStatus === "Pending Assessment").length;
      const shortlisted = summaryApps.filter((a) => a.shortlisted).length;

      response.json({
        ok: true,
        applications: summaryApps,
        counts: { total: summaryApps.length, submitted, pendingReview, shortlisted },
      });
    } catch (error) {
      logAdminAppError("list applications", error, "Unable to load applications.", response);
    }
  });

  // ── GET /api/admin/applications/:id ───────────────────────────────────────

  router.get("/api/admin/applications/:id", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    try {
      const db = (await import("./db")).getDatabase();
      const [appRows] = await db
        .select({
          app: applications,
          roleTitle: recruitmentRoles.title,
        })
        .from(applications)
        .innerJoin(recruitmentRoles, eq(applications.roleId, recruitmentRoles.id))
        .where(eq(applications.id, applicationId))
        .limit(1);

      if (!appRows) return fail(response, 404, "Application not found.");
      const app = appRows.app;

      // Load related data
      const [eligResponses, attempts, evaluation, dimScores, openRevs, intFlags, bonusRevs, shortlistRows] = await Promise.all([
        db.select().from(applicationEligibilityResponses).where(eq(applicationEligibilityResponses.applicationId, applicationId)).orderBy(asc(applicationEligibilityResponses.gateReference)),
        db.select().from(assessmentAttempts).where(eq(assessmentAttempts.applicationId, applicationId)).limit(1),
        db.select().from(applicationEvaluations).where(eq(applicationEvaluations.applicationId, applicationId)).limit(1),
        db.select().from(applicationDimensionScores).where(eq(applicationDimensionScores.applicationId, applicationId)),
        db.select().from(openResponseReviews).where(eq(openResponseReviews.applicationId, applicationId)),
        db.select().from(applicationIntegrityFlags).where(eq(applicationIntegrityFlags.applicationId, applicationId)),
        db.select().from(applicationBonusReviews).where(eq(applicationBonusReviews.applicationId, applicationId)),
        db.select().from(applicationShortlist).where(eq(applicationShortlist.applicationId, applicationId)).limit(1),
      ]);

      // Load assessment responses with question info
      const attempt = attempts[0];
      let candidateResponses: Array<{
        questionId: string;
        questionReference: string;
        questionType: string;
        prompt: string;
        responsePayload: unknown;
        elapsedSeconds: number | null;
      }> = [];

      if (attempt) {
        const rawResponses = await db
          .select({
            resp: assessmentResponsesTable,
            q: assessmentQuestions,
          })
          .from(assessmentResponsesTable)
          .innerJoin(assessmentQuestions, eq(assessmentResponsesTable.questionId, assessmentQuestions.id))
          .where(eq(assessmentResponsesTable.attemptId, attempt.id));

        candidateResponses = rawResponses.map((r) => ({
          questionId: r.resp.questionId,
          questionReference: r.q.reference,
          questionType: r.q.questionType,
          prompt: r.q.prompt,
          responsePayload: (() => { try { return JSON.parse(r.resp.responsePayload); } catch { return r.resp.responsePayload; } })(),
          elapsedSeconds: r.resp.elapsedSeconds,
        }));
      }

      // Build evaluation detail
      const evalData = evaluation[0];
      const dims = dimScores.map((d) => ({
        dimensionId: d.dimensionId,
        dimensionReference: d.dimensionReference,
        normalizedScore: Number(d.normalizedScore),
        weight: d.weight,
        weightedContribution: Number(d.weightedContribution),
        floor: d.floor,
        floorStatus: d.floorStatus,
      }));

      // Load OPEN question details
      const openReviewsDetail = [];
      const pendingOpenQuestions = [];
      if (attempt && app.assessmentId) {
        const assignments = await db
          .select({
            questionId: assessmentQuestionAssignments.questionId,
            displayOrder: assessmentQuestionAssignments.displayOrder,
          })
          .from(assessmentQuestionAssignments)
          .where(eq(assessmentQuestionAssignments.assessmentId, app.assessmentId))
          .orderBy(asc(assessmentQuestionAssignments.displayOrder));

        for (const assignment of assignments) {
          const [questions] = await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, assignment.questionId)).limit(1);
          if (!questions || questions.questionType !== "OPEN") continue;

          const resp = candidateResponses.find((r) => r.questionId === assignment.questionId);
          const review = openRevs.find((r) => r.questionId === assignment.questionId);
          const rubric = await db.select().from(openRubricAnchors).where(eq(openRubricAnchors.questionId, assignment.questionId)).orderBy(asc(openRubricAnchors.displayOrder));
          const anchors = rubric.map((r) => ({ scoreMin: r.scoreMin, scoreMax: r.scoreMax, anchorText: r.anchorText }));

          if (review) {
            openReviewsDetail.push({
              questionId: assignment.questionId,
              questionReference: questions.reference,
              prompt: questions.prompt,
              candidateResponse: typeof resp?.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp?.responsePayload ?? ""),
              rawScore: review.rawScore,
              reviewNote: review.reviewNote,
              rubricAnchors: anchors,
            });
          } else {
            pendingOpenQuestions.push({
              questionId: assignment.questionId,
              questionReference: questions.reference,
              prompt: questions.prompt,
              candidateResponse: typeof resp?.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp?.responsePayload ?? ""),
              rubricAnchors: anchors,
            });
          }
        }
      }

      // Load question scores from evaluation
      let questionScores: Array<{
        questionId: string;
        questionReference: string;
        questionType: string;
        rawScore: number | null;
        maxScore: number | null;
        qWeight: number | null;
        dimensionReference: string | null;
      }> = [];

      if (app.assessmentId && attempt) {
        const configs = await loadQuestionScoringConfigs(app.assessmentId);
        const dbResponses = await db.select().from(assessmentResponsesTable).where(eq(assessmentResponsesTable.attemptId, attempt.id));
        for (const config of configs) {
          const resp = dbResponses.find((r) => r.questionId === config.questionId);
          let rawScore: number | null = null;
          if (resp) {
            rawScore = scoreObjectiveQuestion(config, { responseType: resp.responseType, responsePayload: resp.responsePayload });
            // Check OPEN review
            const openRev = openRevs.find((r) => r.questionId === config.questionId);
            if (config.questionType === "OPEN" && openRev) rawScore = openRev.rawScore;
          }
          questionScores.push({
            questionId: config.questionId,
            questionReference: config.reference,
            questionType: config.questionType,
            rawScore,
            maxScore: config.maxScore,
            qWeight: config.qWeight,
            dimensionReference: config.dimensionReference,
          });
        }
      }

      // Bonus reviews with labels
      const bonusReviewsDetail = BONUS_TYPES.map((bt) => {
        const existing = bonusRevs.find((b) => b.bonusType === bt.code);
        return {
          bonusType: bt.code,
          label: bt.label,
          points: existing?.points ?? bt.points,
          confirmed: existing ? existing.confirmed === 1 : false,
          note: existing?.note ?? null,
        };
      });

      const attemptStatus = attempt?.status ?? "Not Started";
      const assessmentStatus = attemptStatus === "Complete" ? "Complete" : attemptStatus === "In Progress" ? "In Progress" : "Pending";

      response.json({
        ok: true,
        application: {
          id: app.id,
          fullName: app.fullName,
          email: app.email,
          phone: app.phone,
          city: app.city,
          recentRole: app.recentRole,
          recentEmployer: app.recentEmployer,
          totalExperience: app.totalExperience,
          relevantExperience: app.relevantExperience,
          linkedinUrl: app.linkedinUrl,
          roleTitle: appRows.roleTitle,
          eligibilityStatus: app.eligibilityStatus,
          assessmentStatus,
          applicationStatus: app.applicationStatus,
          submittedAt: app.submittedAt?.toISOString() ?? null,
          createdAt: app.createdAt.toISOString(),
          eligibilityResponses: eligResponses.map((e) => ({
            gateReference: e.gateReference,
            outcome: e.outcome,
            internalFlag: e.internalFlag,
          })),
          assessmentResponses: candidateResponses,
          finalScore: evalData?.finalScreeningScore ? Number(evalData.finalScreeningScore) : null,
          appliedBand: (evalData?.appliedBand as ScreeningBand | null) ?? null,
          evaluationStatus: (evalData?.evaluationStatus as EvaluationStatus | null) ?? null,
          shortlisted: shortlistRows.length > 0 && shortlistRows[0].shortlisted === 1,
        },
        evaluation: {
          applicationId: app.id,
          evaluationStatus: (evalData?.evaluationStatus as EvaluationStatus) ?? "Pending Assessment",
          baseAssessmentScore: evalData?.baseAssessmentScore ? Number(evalData.baseAssessmentScore) : null,
          verificationMultiplier: evalData?.verificationMultiplier ? Number(evalData.verificationMultiplier) : null,
          integrityPenalty: evalData?.integrityPenalty ?? null,
          bonus: evalData?.bonus ?? null,
          finalScreeningScore: evalData?.finalScreeningScore ? Number(evalData.finalScreeningScore) : null,
          rawBand: (evalData?.rawBand as ScreeningBand | null) ?? null,
          appliedBand: (evalData?.appliedBand as ScreeningBand | null) ?? null,
          floorMissed: evalData?.floorMissed ?? null,
          manualReviewRequired: evalData ? evalData.manualReviewRequired === 1 : false,
          dimensions: dims,
          openReviews: openReviewsDetail,
          pendingOpenQuestions,
          integrityFlags: intFlags.map((f) => ({
            id: f.id,
            source: f.source,
            description: f.description,
            status: f.status,
          })),
          bonusReviews: bonusReviewsDetail,
          questionScores,
        },
      });
    } catch (error) {
      logAdminAppError("application detail", error, "Unable to load application detail.", response);
    }
  });

  // ── GET /api/admin/applications/:id/evaluation ────────────────────────────

  router.get("/api/admin/applications/:id/evaluation", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    try {
      const result = await recalculateAndPersistEvaluation(applicationId);
      if (!result) return fail(response, 404, "Application or assessment not found.");
      response.json({ ok: true, evaluation: result });
    } catch (error) {
      logAdminAppError("evaluation recalculate", error, "Unable to calculate evaluation.", response);
    }
  });

  // ── PUT /api/admin/applications/:id/open-reviews/:questionId ──────────────

  router.put("/api/admin/applications/:id/open-reviews/:questionId", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const questionId = request.params.questionId;
    const adminProfileId = (request as unknown as Request & { adminProfileId: string }).adminProfileId;

    const validation = validateOpenReviewInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));

    try {
      const db = (await import("./db")).getDatabase();

      // Find the attempt
      const attempts = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.applicationId, applicationId)).limit(1);
      if (attempts.length === 0) return fail(response, 404, "Assessment attempt not found.");

      const attempt = attempts[0];

      // Find the response
      const [resp] = await db.select().from(assessmentResponsesTable).where(and(eq(assessmentResponsesTable.attemptId, attempt.id), eq(assessmentResponsesTable.questionId, questionId))).limit(1);
      if (!resp) return fail(response, 404, "Response not found for this question.");

      // Upsert review
      const existing = await db.select().from(openResponseReviews).where(and(eq(openResponseReviews.responseId, resp.id), eq(openResponseReviews.questionId, questionId))).limit(1);
      if (existing.length > 0) {
        await db.update(openResponseReviews).set({
          rawScore: validation.input.rawScore,
          reviewNote: validation.input.note ?? null,
          adminProfileId,
          reviewedAt: new Date(),
        }).where(eq(openResponseReviews.id, existing[0].id));
      } else {
        await db.insert(openResponseReviews).values({
          id: `rev-${generateId()}`,
          applicationId,
          attemptId: attempt.id,
          responseId: resp.id,
          questionId,
          adminProfileId,
          rawScore: validation.input.rawScore,
          reviewNote: validation.input.note ?? null,
          reviewedAt: new Date(),
        });
      }

      // Recalculate evaluation
      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("open review save", error, "Unable to save OPEN review.", response);
    }
  });

  // ── PUT /api/admin/applications/:id/integrity/:flagId ─────────────────────

  router.put("/api/admin/applications/:id/integrity/:flagId", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const flagId = request.params.flagId;
    const adminProfileId = (request as unknown as Request & { adminProfileId: string }).adminProfileId;

    const validation = validateIntegrityFlagInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));

    try {
      const db = (await import("./db")).getDatabase();
      const [flag] = await db.select().from(applicationIntegrityFlags).where(and(eq(applicationIntegrityFlags.id, flagId), eq(applicationIntegrityFlags.applicationId, applicationId))).limit(1);
      if (!flag) return fail(response, 404, "Integrity flag not found.");

      await db.update(applicationIntegrityFlags).set({
        status: validation.input.status,
        confirmedBy: adminProfileId,
        reviewedAt: new Date(),
      }).where(eq(applicationIntegrityFlags.id, flagId));

      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("integrity flag update", error, "Unable to update integrity flag.", response);
    }
  });

  // ── PUT /api/admin/applications/:id/bonuses/:bonusType ────────────────────

  router.put("/api/admin/applications/:id/bonuses/:bonusType", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const bonusType = request.params.bonusType;
    const adminProfileId = (request as unknown as Request & { adminProfileId: string }).adminProfileId;

    const validation = validateBonusInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));

    const bonusDef = BONUS_TYPES.find((b) => b.code === bonusType);
    if (!bonusDef) return fail(response, 400, "Invalid bonus type.");

    try {
      const db = (await import("./db")).getDatabase();
      const existing = await db.select().from(applicationBonusReviews).where(and(eq(applicationBonusReviews.applicationId, applicationId), eq(applicationBonusReviews.bonusType, bonusType))).limit(1);

      if (existing.length > 0) {
        await db.update(applicationBonusReviews).set({
          confirmed: validation.input.confirmed ? 1 : 0,
          note: validation.input.note ?? null,
          adminProfileId,
        }).where(eq(applicationBonusReviews.id, existing[0].id));
      } else {
        await db.insert(applicationBonusReviews).values({
          id: `bonus-${generateId()}`,
          applicationId,
          bonusType,
          points: bonusDef.points,
          confirmed: validation.input.confirmed ? 1 : 0,
          adminProfileId,
          note: validation.input.note ?? null,
        });
      }

      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("bonus review save", error, "Unable to save bonus review.", response);
    }
  });

  // ── PUT /api/admin/applications/:id/shortlist ─────────────────────────────

  router.put("/api/admin/applications/:id/shortlist", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const adminProfileId = (request as unknown as Request & { adminProfileId: string }).adminProfileId;

    const validation = validateShortlistInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));

    try {
      const db = (await import("./db")).getDatabase();
      const existing = await db.select().from(applicationShortlist).where(eq(applicationShortlist.applicationId, applicationId)).limit(1);

      if (validation.input.shortlisted) {
        if (existing.length > 0) {
          await db.update(applicationShortlist).set({ shortlisted: 1, updatedBy: adminProfileId }).where(eq(applicationShortlist.id, existing[0].id));
        } else {
          await db.insert(applicationShortlist).values({
            id: `sl-${generateId()}`,
            applicationId,
            shortlisted: 1,
            updatedBy: adminProfileId,
          });
        }
      } else {
        if (existing.length > 0) {
          await db.update(applicationShortlist).set({ shortlisted: 0, updatedBy: adminProfileId }).where(eq(applicationShortlist.id, existing[0].id));
        }
      }

      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("shortlist update", error, "Unable to update shortlist status.", response);
    }
  });

  // ── PUT /api/admin/applications/:id/status ────────────────────────────────

  router.put("/api/admin/applications/:id/status", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;

    const validation = validateApplicationStatusInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));

    try {
      const db = (await import("./db")).getDatabase();
      const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
      if (!app) return fail(response, 404, "Application not found.");

      // Map admin status to application_status enum
      const statusMap: Record<string, string> = {
        "Submitted": "Submitted",
        "Under Review": "Submitted",
        "Shortlisted": "Shortlisted",
        "Hold": "Hold",
        "Closed": "Closed",
      };
      const dbStatus = statusMap[validation.input.status] ?? validation.input.status;

      await db.update(applications).set({
        applicationStatus: dbStatus as typeof applications.$inferInsert.applicationStatus,
      }).where(eq(applications.id, applicationId));

      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("application status update", error, "Unable to update application status.", response);
    }
  });

  return router;
}
