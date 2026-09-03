/**
 * CSV Assessment Question Import — Admin API.
 *
 * Three Admin-only endpoints, all guarded by the Task 24B authorization guard:
 *
 *   GET  /api/admin/recruitment-roles/:idOrSlug/assessment/csv-template
 *        → the downloadable CSV template + plain-language instructions.
 *   POST /api/admin/recruitment-roles/:idOrSlug/assessment/csv-preview
 *        → role-scoped validation of an uploaded CSV; writes nothing.
 *   POST /api/admin/recruitment-roles/:idOrSlug/assessment/csv-import?scope=…
 *        → re-validates server-authoritatively, then atomically imports.
 *
 * Transport: the CSV travels as a raw text body (never JSON), parsed by a
 * route-level `express.text` middleware so the global 100 KB JSON limit does not
 * apply. The route limit carries headroom above the logical MAX_CSV_BYTES cap;
 * the pure parser rejects oversized files with a restrained, user-facing message.
 *
 * Errors keep the restrained `{ ok: false, error }` shape — SQL, connection
 * details and stack traces are logged server-side only.
 */
import express, { type Request, type Response, type Router } from "express";
import { fail, handleRouteError, requireAuthorizedAdmin } from "./recruitmentApi";
import { confirmCsvImport, createCsvFramework, CsvImportValidationError, previewCsvImport } from "./csvImportRepository";
import { buildCsvTemplate, CSV_COLUMNS, csvTemplateInstructions, type CsvScope } from "../shared/csvImport";

/** Transport headroom above the logical cap so the parser emits the friendly message. */
const CSV_BODY_LIMIT = "2mb";

function readCsvBody(request: Request): string {
  return typeof request.body === "string" ? request.body : "";
}

export function createCsvImportApiRouter(): Router {
  const router = express.Router();

  router.get("/api/admin/recruitment-roles/:idOrSlug/assessment/csv-template", requireAuthorizedAdmin, async (_request: Request, response: Response) => {
    try {
      response.json({
        ok: true,
        filename: "assessment-question-import-template.csv",
        template: buildCsvTemplate(),
        instructions: csvTemplateInstructions(),
        columns: CSV_COLUMNS,
      });
    } catch (error) {
      handleRouteError("admin csv template")(error, response);
    }
  });

  router.post(
    "/api/admin/recruitment-roles/:idOrSlug/assessment/csv-preview",
    requireAuthorizedAdmin,
    express.text({ type: () => true, limit: CSV_BODY_LIMIT }),
    async (request: Request, response: Response) => {
      try {
        const preview = await previewCsvImport(request.params.idOrSlug ?? "", readCsvBody(request));
        response.json({ ok: true, preview });
      } catch (error) {
        if (error instanceof CsvImportValidationError) return fail(response, 400, error.message);
        handleRouteError("admin csv preview")(error, response);
      }
    },
  );

  /**
   * POST /api/admin/recruitment-roles/:idOrSlug/assessment/csv-framework
   *
   * Create missing Evaluation Framework dimensions from a previously-parsed CSV.
   * The CSV travels as the raw text body (same transport as preview/import) so
   * the client can send the same file it already holds in state without a second
   * upload. The server re-parses and re-validates everything authoritatively.
   *
   * On success, returns a refreshed CsvImportPreviewDto so the client can
   * re-render the preview with the now-resolved dimensions in one round trip.
   */
  router.post(
    "/api/admin/recruitment-roles/:idOrSlug/assessment/csv-framework",
    requireAuthorizedAdmin,
    express.text({ type: () => true, limit: CSV_BODY_LIMIT }),
    async (request: Request, response: Response) => {
      try {
        const preview = await createCsvFramework(request.params.idOrSlug ?? "", readCsvBody(request));
        response.json({ ok: true, preview });
      } catch (error) {
        if (error instanceof CsvImportValidationError) return fail(response, 400, error.message);
        handleRouteError("admin csv framework create")(error, response);
      }
    },
  );

  router.post(
    "/api/admin/recruitment-roles/:idOrSlug/assessment/csv-import",
    requireAuthorizedAdmin,
    express.text({ type: () => true, limit: CSV_BODY_LIMIT }),
    async (request: Request, response: Response) => {
      try {
        const scopeParam = request.query.scope;
        const scope = (typeof scopeParam === "string" ? scopeParam : "") as CsvScope;
        const result = await confirmCsvImport(request.params.idOrSlug ?? "", readCsvBody(request), scope);
        response.json({ ok: true, result });
      } catch (error) {
        if (error instanceof CsvImportValidationError) return fail(response, 400, error.message);
        handleRouteError("admin csv import")(error, response);
      }
    },
  );

  return router;
}
