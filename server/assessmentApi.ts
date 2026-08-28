/**
 * Task 24C-3 — Admin Assessment API.
 *
 * Assessment list, detail, create, update, and assignment management endpoints.
 * Every route reuses the Task 24B authorization guard (valid session + Active
 * Admin profile); there are deliberately no public assessment endpoints.
 *
 * Error responses keep the restrained `{ ok: false, error }` shape — SQL,
 * connection details and stack traces are logged server-side only.
 *
 * Endpoints
 * ─────────
 *   GET    /api/admin/assessments
 *   POST   /api/admin/assessments
 *   GET    /api/admin/assessments/:idOrSlug
 *   PATCH  /api/admin/assessments/:idOrSlug
 *   GET    /api/admin/assessments/:idOrSlug/preview
 *   POST   /api/admin/assessments/:idOrSlug/questions
 *   DELETE /api/admin/assessments/:idOrSlug/questions/:questionId
 *   PUT    /api/admin/assessments/:idOrSlug/questions/order
 */
import express, { type Request, type Response, type Router } from "express";
import { fail, handleRouteError, requireAuthorizedAdmin } from "./recruitmentApi";
import {
  addAssessmentQuestion,
  AssessmentValidationError,
  createAssessment,
  getAssessment,
  getAssessmentByIdOrSlug,
  getAssessmentPreviewConfiguration,
  listAssessments,
  removeAssessmentQuestion,
  reorderAssessmentQuestions,
  updateAssessment,
} from "./assessmentRepository";
import {
  validateAssessmentCreateInput,
  validateAssessmentUpdateInput,
} from "../shared/assessmentApi";

export function createAssessmentApiRouter(): Router {
  const router = express.Router();

  // ── Assessment List ────────────────────────────────────────────────────────

  router.get("/api/admin/assessments", requireAuthorizedAdmin, async (_request: Request, response: Response) => {
    try {
      const payload = await listAssessments();
      response.json({ ok: true, ...payload });
    } catch (error) {
      handleRouteError("admin assessment list")(error, response);
    }
  });

  // ── Create Assessment ──────────────────────────────────────────────────────

  router.post("/api/admin/assessments", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const validated = validateAssessmentCreateInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);
      const assessment = await createAssessment(validated.input);
      response.status(201).json({ ok: true, assessment });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail(response, 400, error.message);
      handleRouteError("admin assessment create")(error, response);
    }
  });

  // ── Assessment Detail ──────────────────────────────────────────────────────

  router.get("/api/admin/assessments/:idOrSlug", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const assessment = await getAssessment(request.params.idOrSlug ?? "");
      if (!assessment) return fail(response, 404, "Assessment not found.");
      response.json({ ok: true, assessment });
    } catch (error) {
      handleRouteError("admin assessment detail")(error, response);
    }
  });

  // ── Update Assessment Metadata ─────────────────────────────────────────────

  router.patch("/api/admin/assessments/:idOrSlug", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const validated = validateAssessmentUpdateInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);
      const assessment = await updateAssessment(request.params.idOrSlug ?? "", validated.input);
      if (!assessment) return fail(response, 404, "Assessment not found.");
      response.json({ ok: true, assessment });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail(response, 400, error.message);
      handleRouteError("admin assessment update")(error, response);
    }
  });

  // ── Admin Preview ──────────────────────────────────────────────────────────

  router.get("/api/admin/assessments/:idOrSlug/preview", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const payload = await getAssessmentPreviewConfiguration(request.params.idOrSlug ?? "");
      if (!payload) return fail(response, 404, "Assessment not found.");
      response.json({ ok: true, preview: payload });
    } catch (error) {
      handleRouteError("admin assessment preview")(error, response);
    }
  });

  // ── Add Question to Assessment ─────────────────────────────────────────────

  router.post("/api/admin/assessments/:idOrSlug/questions", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
      if (!assessment) return fail(response, 404, "Assessment not found.");

      const questionId = typeof request.body?.questionId === "string" ? request.body.questionId.trim() : "";
      if (!questionId) return fail(response, 400, "A question ID is required.");

      const assignments = await addAssessmentQuestion(assessment.id, questionId);
      response.status(201).json({ ok: true, assignments });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail(response, 400, error.message);
      handleRouteError("admin assessment add question")(error, response);
    }
  });

  // ── Remove Question from Assessment ───────────────────────────────────────

  router.delete(
    "/api/admin/assessments/:idOrSlug/questions/:questionId",
    requireAuthorizedAdmin,
    async (request: Request, response: Response) => {
      try {
        const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
        if (!assessment) return fail(response, 404, "Assessment not found.");

        const questionId = request.params.questionId ?? "";
        const assignments = await removeAssessmentQuestion(assessment.id, questionId);
        response.json({ ok: true, assignments });
      } catch (error) {
        if (error instanceof AssessmentValidationError) return fail(response, 400, error.message);
        handleRouteError("admin assessment remove question")(error, response);
      }
    },
  );

  // ── Reorder Questions ──────────────────────────────────────────────────────

  router.put(
    "/api/admin/assessments/:idOrSlug/questions/order",
    requireAuthorizedAdmin,
    async (request: Request, response: Response) => {
      try {
        const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
        if (!assessment) return fail(response, 404, "Assessment not found.");

        const orderedQuestionIds = request.body?.orderedQuestionIds;
        if (!Array.isArray(orderedQuestionIds) || orderedQuestionIds.some((id) => typeof id !== "string")) {
          return fail(response, 400, "orderedQuestionIds must be an array of question ID strings.");
        }

        const assignments = await reorderAssessmentQuestions(assessment.id, orderedQuestionIds as string[]);
        response.json({ ok: true, assignments });
      } catch (error) {
        if (error instanceof AssessmentValidationError) return fail(response, 400, error.message);
        handleRouteError("admin assessment reorder")(error, response);
      }
    },
  );

  return router;
}
