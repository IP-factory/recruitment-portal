/**
 * Task 24C-2 — Admin Question Bank API.
 *
 * Question Bank list, detail, create and update endpoints. Every route reuses
 * the Task 24B authorization guard (valid session + Active Admin profile);
 * there are deliberately no public Question Bank endpoints.
 *
 * Error responses keep the restrained `{ ok: false, error }` shape — SQL,
 * connection details and stack traces are logged server-side only.
 */
import express, { type Request, type Response, type Router } from "express";
import { fail, handleRouteError, requireAuthorizedAdmin } from "./recruitmentApi";
import { createQuestion, getQuestionDetail, listQuestions, QuestionBankValidationError, updateQuestion } from "./questionBankRepository";
import { QUESTION_BANK_STATUSES, QUESTION_TYPES, validateQuestionInput, type QuestionListSortKey, type QuestionType } from "../shared/questionBankApi";

const SORT_KEYS: readonly QuestionListSortKey[] = ["reference", "dimension", "type", "qWeight", "status"];

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createQuestionBankApiRouter(): Router {
  const router = express.Router();

  router.get("/api/admin/questions", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const query = request.query;
      const type = typeof query.type === "string" && (QUESTION_TYPES as readonly string[]).includes(query.type) ? (query.type as QuestionType) : undefined;
      const status = typeof query.status === "string" && (QUESTION_BANK_STATUSES as readonly string[]).includes(query.status) ? (query.status as "Active" | "Inactive") : undefined;
      const sortKey = typeof query.sortKey === "string" && (SORT_KEYS as readonly string[]).includes(query.sortKey) ? (query.sortKey as QuestionListSortKey) : undefined;
      const payload = await listQuestions({
        search: typeof query.search === "string" ? query.search : undefined,
        dimension: typeof query.dimension === "string" && query.dimension && query.dimension !== "all" ? query.dimension : undefined,
        type,
        status,
        sortKey,
        sortDirection: query.sortDirection === "desc" ? "desc" : "asc",
        page: toPositiveInt(query.page, 1),
        pageSize: toPositiveInt(query.pageSize, 10),
      });
      response.json({ ok: true, ...payload });
    } catch (error) {
      handleRouteError("admin question list")(error, response);
    }
  });

  router.post("/api/admin/questions", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const validated = validateQuestionInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);
      const question = await createQuestion(validated.input);
      response.status(201).json({ ok: true, question });
    } catch (error) {
      if (error instanceof QuestionBankValidationError) return fail(response, 400, error.message);
      handleRouteError("admin question create")(error, response);
    }
  });

  router.get("/api/admin/questions/:idOrReference", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const question = await getQuestionDetail(request.params.idOrReference ?? "");
      if (!question) return fail(response, 404, "Unable to load this question.");
      response.json({ ok: true, question });
    } catch (error) {
      handleRouteError("admin question detail")(error, response);
    }
  });

  router.patch("/api/admin/questions/:idOrReference", requireAuthorizedAdmin, async (request: Request, response: Response) => {
    try {
      const validated = validateQuestionInput(request.body);
      if ("errors" in validated) return fail(response, 400, validated.errors[0]);
      const question = await updateQuestion(request.params.idOrReference ?? "", validated.input);
      if (!question) return fail(response, 404, "Unable to load this question.");
      response.json({ ok: true, question });
    } catch (error) {
      if (error instanceof QuestionBankValidationError) return fail(response, 400, error.message);
      handleRouteError("admin question update")(error, response);
    }
  });

  return router;
}
