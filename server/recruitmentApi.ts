/**
 * Task 24C-1 — Recruitment Role, Eligibility and Evaluation Framework API.
 *
 * Public endpoints expose applicant-safe data only (never weights, floors,
 * bands, multipliers, penalties, bonus configuration, or database IDs).
 * Admin endpoints reuse the Task 24B authorization: valid session + Active
 * Admin profile; no second auth system is introduced.
 *
 * Error responses always use the restrained JSON shape
 * `{ ok: false, error }` — SQL, connection details, and stack traces are
 * logged server-side only and never returned to the client.
 */
import { Router, type RequestHandler, type Response } from "express";
import { findAdminProfileForUser, readSessionToken, resolveSession } from "./adminAuth";
import {
  createRecruitmentRole,
  getRecruitmentRoleByIdOrSlug,
  getRoleEligibilityGates,
  getRoleEvaluationFramework,
  listRecruitmentRoles,
  toAdminGate,
  toAdminRole,
  toPublicEligibility,
  toPublicRole,
  updateRecruitmentRole,
} from "./recruitmentRepository";
import { isAdminAuthorized } from "../shared/adminAuth";
import { validateRecruitmentRoleInput } from "../shared/recruitmentApi";

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function fail(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error });
}

/** Restrained fallback — never reveals database internals. */
export function handleRouteError(context: string) {
  return (error: unknown, res: Response) => {
    console.error(`[recruitment] ${context} failed:`, error instanceof Error ? error.message : String(error));
    fail(res, 503, "Unable to load recruitment data.");
  };
}

/** Task 24B authorization guard for Admin configuration endpoints. */
export const requireAuthorizedAdmin: RequestHandler = async (request, response, next) => {
  if (!databaseConfigured()) {
    fail(response, 503, "Unable to load recruitment data.");
    return;
  }
  try {
    const token = readSessionToken(request);
    const session = token ? await resolveSession(token) : null;
    const profile = session ? await findAdminProfileForUser(session.user.id) : null;
    if (!session || !isAdminAuthorized(session.user, profile)) {
      fail(response, 401, "Admin authorization is required.");
      return;
    }
    next();
  } catch (error) {
    console.error("[recruitment] admin authorization failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to load recruitment data.");
  }
};

// ── Public handlers ───────────────────────────────────────────────────────────

const getPublicRoles: RequestHandler = async (_request, response) => {
  if (!databaseConfigured()) return void fail(response, 503, "Unable to load recruitment roles.");
  try {
    const roles = await listRecruitmentRoles();
    // Open roles apply normally; Closed roles remain listed with Apply
    // disabled (existing /apply behavior). Draft and Archived stay hidden.
    const visible = roles.filter((role) => role.status === "Open" || role.status === "Closed");
    response.json({ ok: true, roles: visible.map(toPublicRole) });
  } catch (error) {
    handleRouteError("public role list")(error, response);
  }
};

const getPublicRoleEligibility: RequestHandler = async (request, response) => {
  if (!databaseConfigured()) return void fail(response, 503, "Unable to load eligibility configuration.");
  try {
    const slug = request.params.slug ?? "";
    const role = await getRecruitmentRoleByIdOrSlug(slug);
    if (!role || role.slug !== slug || (role.status !== "Open" && role.status !== "Closed")) {
      return void fail(response, 404, "Unable to load this recruitment role.");
    }
    const gates = await getRoleEligibilityGates(role.id);
    response.json({ ok: true, ...toPublicEligibility(role.slug, gates) });
  } catch (error) {
    handleRouteError("public eligibility")(error, response);
  }
};

const getPublicRole: RequestHandler = async (request, response) => {
  if (!databaseConfigured()) return void fail(response, 503, "Unable to load this recruitment role.");
  try {
    const slug = request.params.slug ?? "";
    const role = await getRecruitmentRoleByIdOrSlug(slug);
    if (!role || role.slug !== slug || (role.status !== "Open" && role.status !== "Closed")) {
      return void fail(response, 404, "Unable to load this recruitment role.");
    }
    response.json({ ok: true, role: toPublicRole(role) });
  } catch (error) {
    handleRouteError("public role detail")(error, response);
  }
};

// ── Admin handlers ────────────────────────────────────────────────────────────

const getAdminRoles: RequestHandler = async (_request, response) => {
  try {
    const roles = await listRecruitmentRoles();
    response.json({ ok: true, roles: roles.map(toAdminRole) });
  } catch (error) {
    handleRouteError("admin role list")(error, response);
  }
};

const createAdminRole: RequestHandler = async (request, response) => {
  try {
    const validated = validateRecruitmentRoleInput(request.body);
    if ("errors" in validated) return void fail(response, 400, validated.errors[0]);
    const role = await createRecruitmentRole(validated.input);
    response.status(201).json({ ok: true, role });
  } catch (error) {
    handleRouteError("admin role create")(error, response);
  }
};

const getAdminRole: RequestHandler = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail(response, 404, "Unable to load this recruitment role.");
    response.json({ ok: true, role: toAdminRole(role) });
  } catch (error) {
    handleRouteError("admin role detail")(error, response);
  }
};

const patchAdminRole: RequestHandler = async (request, response) => {
  try {
    const existing = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!existing) return void fail(response, 404, "Unable to load this recruitment role.");
    const validated = validateRecruitmentRoleInput(request.body);
    if ("errors" in validated) return void fail(response, 400, validated.errors[0]);
    // Metadata-only update: gates, dimensions, assessments and screening
    // configuration are intentionally left untouched.
    const updated = await updateRecruitmentRole(existing.id, validated.input);
    if (!updated) return void fail(response, 404, "Unable to load this recruitment role.");
    response.json({ ok: true, role: updated });
  } catch (error) {
    handleRouteError("admin role update")(error, response);
  }
};

const getAdminRoleEligibility: RequestHandler = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail(response, 404, "Unable to load this recruitment role.");
    const gates = await getRoleEligibilityGates(role.id);
    response.json({ ok: true, roleId: role.id, gates: gates.map(toAdminGate) });
  } catch (error) {
    handleRouteError("admin eligibility")(error, response);
  }
};

const getAdminEvaluationFramework: RequestHandler = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail(response, 404, "Unable to load this recruitment role.");
    const framework = await getRoleEvaluationFramework(role.id);
    response.json({ ok: true, ...framework });
  } catch (error) {
    handleRouteError("admin evaluation framework")(error, response);
  }
};

// ── Router assembly ───────────────────────────────────────────────────────────

export function createRecruitmentApiRouter(): Router {
  const router = Router();

  // Public (applicant-safe) endpoints
  router.get("/api/public/recruitment-roles", getPublicRoles);
  router.get("/api/public/recruitment-roles/:slug/eligibility", getPublicRoleEligibility);
  router.get("/api/public/recruitment-roles/:slug", getPublicRole);

  // Admin endpoints (Task 24B authorization)
  router.get("/api/admin/recruitment-roles", requireAuthorizedAdmin, getAdminRoles);
  router.post("/api/admin/recruitment-roles", requireAuthorizedAdmin, createAdminRole);
  router.get("/api/admin/recruitment-roles/:idOrSlug", requireAuthorizedAdmin, getAdminRole);
  router.patch("/api/admin/recruitment-roles/:idOrSlug", requireAuthorizedAdmin, patchAdminRole);
  router.get("/api/admin/recruitment-roles/:idOrSlug/eligibility", requireAuthorizedAdmin, getAdminRoleEligibility);
  router.get("/api/admin/recruitment-roles/:idOrSlug/evaluation-framework", requireAuthorizedAdmin, getAdminEvaluationFramework);

  return router;
}
