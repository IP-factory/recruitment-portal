/**
 * Task 24B — deterministic Admin route-protection decisions.
 *
 * Pure functions so redirect behavior (unauthenticated, unauthorized,
 * authorized, sign-out) can be unit-tested without a browser. The actual
 * session state comes from the server; these helpers only map state + path
 * to a routing decision.
 */
import type { AdminSessionState } from "@/lib/adminSession";

export function isAdminProtectedPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * Return paths must stay inside the Admin area, never reopen the login page,
 * and never carry absolute/protocol URLs (open-redirect protection).
 */
export function sanitizeAdminReturnPath(candidate: string | null | undefined): string | null {
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (trimmed === "/admin") return trimmed;
  if (!trimmed.startsWith("/admin/")) return null;
  if (trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes(":")) return null;
  if (trimmed === "/admin/login" || trimmed.startsWith("/admin/login?") || trimmed.startsWith("/admin/login/")) return null;
  return trimmed;
}

export function readAdminReturnPath(search: string | null | undefined): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return sanitizeAdminReturnPath(params.get("next"));
}

export function buildAdminLoginRedirect(path: string): string {
  const next = sanitizeAdminReturnPath(path);
  return next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login";
}

export type AdminRouteDecision =
  | { action: "loading" }
  | { action: "render" }
  | { action: "redirect-login"; to: string }
  | { action: "access-unavailable" };

/**
 * Route/session-level authorization decision for any `/admin/*` path:
 * - loading: restrained resolver, never render protected content early.
 * - unauthenticated: redirect to /admin/login preserving the destination.
 * - authenticated without an Active Admin profile: restrained block page.
 * - authorized: render.
 */
export function resolveAdminRouteAccess(state: Pick<AdminSessionState, "status">, path: string): AdminRouteDecision {
  if (state.status === "loading") return { action: "loading" };
  if (state.status === "unauthenticated") return { action: "redirect-login", to: buildAdminLoginRedirect(path) };
  if (state.status === "unauthorized") return { action: "access-unavailable" };
  return { action: "render" };
}

/**
 * Decision for `/admin/login` itself: an already-authorized Admin is
 * redirected away (to the safe return target or `/admin`); everyone else
 * sees the login form.
 */
export function resolveAdminLoginRedirect(state: Pick<AdminSessionState, "status">, returnPath: string | null): string | null {
  if (state.status !== "authorized") return null;
  return sanitizeAdminReturnPath(returnPath) ?? "/admin";
}
