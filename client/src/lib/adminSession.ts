/**
 * Quiet Authority admin session client (Task 24B).
 *
 * Real authentication state is resolved from the server session endpoint —
 * the HttpOnly `app_session_id` cookie is the only session carrier. The old
 * frontend-only demo credentials and localStorage session were removed; the
 * legacy storage key is cleared on load so no demo grant survives.
 */
import type { AdminProfileSummary, AdminSessionPayload, AdminSessionUser } from "@shared/adminAuth";

export type AdminSessionStatus = "loading" | "unauthenticated" | "unauthorized" | "authorized";

export interface AdminSessionState {
  status: AdminSessionStatus;
  user: AdminSessionUser | null;
  profile: AdminProfileSummary | null;
}

const LEGACY_DEMO_SESSION_KEY = "recruitment-portal:admin-demo-session";

/** Remove any surviving demo-session artifact from the old prototype. */
export function clearLegacyDemoSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_DEMO_SESSION_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export const LOADING_ADMIN_SESSION: AdminSessionState = { status: "loading", user: null, profile: null };
export const UNAUTHENTICATED_ADMIN_SESSION: AdminSessionState = { status: "unauthenticated", user: null, profile: null };

export function toAdminSessionState(payload: AdminSessionPayload | null): AdminSessionState {
  if (!payload || !payload.authenticated) return UNAUTHENTICATED_ADMIN_SESSION;
  if (!payload.authorized) return { status: "unauthorized", user: payload.user, profile: payload.profile };
  return { status: "authorized", user: payload.user, profile: payload.profile };
}

// Module-level in-flight cache so simultaneous mounts resolve one request.
let sessionRequest: Promise<AdminSessionPayload | null> | null = null;

export function invalidateAdminSessionCache() {
  sessionRequest = null;
}

export function fetchAdminSessionPayload(force = false): Promise<AdminSessionPayload | null> {
  if (!sessionRequest || force) {
    sessionRequest = (async () => {
      try {
        const response = await fetch("/api/admin/session", { credentials: "same-origin" });
        if (!response.ok) return null;
        return (await response.json()) as AdminSessionPayload;
      } catch {
        return null;
      }
    })();
  }
  return sessionRequest;
}

/** Server-verified sign-in. Returns true only when the server accepted the credentials. */
export async function requestAdminSignIn(email: string, password: string): Promise<boolean> {
  invalidateAdminSessionCache();
  try {
    const response = await fetch("/api/admin/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Ends the real server session and clears the client session cache. */
export async function requestAdminSignOut(): Promise<void> {
  try {
    await fetch("/api/admin/auth/sign-out", { method: "POST", credentials: "same-origin" });
  } catch {
    /* even if the request fails, the client cache must be cleared below */
  }
  invalidateAdminSessionCache();
}

/** Resolve the authenticated Admin identity for display (never hard-coded). */
export function resolveAdminDisplayName(state: Pick<AdminSessionState, "user" | "profile">): string {
  return state.profile?.fullName || state.user?.name || state.profile?.email || state.user?.email || "Administrator";
}

export function resolveAdminDisplayEmail(state: Pick<AdminSessionState, "user" | "profile">): string | null {
  return state.profile?.email || state.user?.email || null;
}
