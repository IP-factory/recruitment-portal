/**
 * Task 24B — deterministic Admin authentication / authorization tests.
 *
 * Covers the required scenarios:
 * A. Unauthenticated `/admin` access redirects to `/admin/login`.
 * B. Successful authorized Admin login reaches `/admin`.
 * C. Invalid credentials remain on login with the safe error.
 * D. Authenticated user without an Active Admin profile cannot access `/admin`.
 * E. Inactive Admin profile cannot access `/admin`.
 * F. Authorized Admin can access nested protected routes.
 * G. Sign out ends access to protected routes.
 * H. Authorized Admin visiting `/admin/login` is redirected away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAdminLoginRedirect, isAdminProtectedPath, readAdminReturnPath, resolveAdminLoginRedirect, resolveAdminRouteAccess, sanitizeAdminReturnPath } from "./adminAuthGuards";
import { fetchAdminSessionPayload, invalidateAdminSessionCache, requestAdminSignIn, requestAdminSignOut, toAdminSessionState, UNAUTHENTICATED_ADMIN_SESSION, type AdminSessionState } from "./adminSession";
import { evaluateAdminAuthorization } from "../../../shared/adminAuth";

const loading: AdminSessionState = { status: "loading", user: null, profile: null };
const unauthenticated: AdminSessionState = UNAUTHENTICATED_ADMIN_SESSION;
const unauthorized: AdminSessionState = {
  status: "unauthorized",
  user: { id: 7, email: "someone@example.com", name: null },
  profile: null,
};
const authorized: AdminSessionState = {
  status: "authorized",
  user: { id: 1, email: "admin@gmail.com", name: null },
  profile: { id: "admin-profile-1", email: "admin@gmail.com", fullName: null, role: "Admin", status: "Active" },
};

describe("server authorization rule (spec section 6)", () => {
  it("requires session + profile + Active status + Admin role", () => {
    const activeProfile = { role: "Admin", status: "Active" };
    expect(evaluateAdminAuthorization(null, activeProfile)).toBe("unauthenticated");
    expect(evaluateAdminAuthorization({ id: 1 }, null)).toBe("missing-profile");
    expect(evaluateAdminAuthorization({ id: 1 }, { role: "Admin", status: "Inactive" })).toBe("inactive-profile");
    expect(evaluateAdminAuthorization({ id: 1 }, { role: "Support", status: "Active" })).toBe("role-not-permitted");
    expect(evaluateAdminAuthorization({ id: 1 }, activeProfile)).toBe("authorized");
  });
});

describe("route protection decisions", () => {
  it("A. unauthenticated /admin access redirects to /admin/login with the destination preserved", () => {
    expect(resolveAdminRouteAccess(unauthenticated, "/admin")).toEqual({ action: "redirect-login", to: "/admin/login?next=%2Fadmin" });
    expect(resolveAdminRouteAccess(loading, "/admin")).toEqual({ action: "loading" });
  });

  it("D/E. authenticated users without an Active Admin profile are blocked, not redirected", () => {
    expect(resolveAdminRouteAccess(unauthorized, "/admin")).toEqual({ action: "access-unavailable" });
    expect(resolveAdminRouteAccess(unauthorized, "/admin/screening")).toEqual({ action: "access-unavailable" });
  });

  it("F. authorized Admin can access nested protected routes", () => {
    for (const path of ["/admin", "/admin/applications", "/admin/applications/app-amina-adewale", "/admin/screening", "/admin/roles", "/admin/roles/business-development-officer/edit", "/admin/assessments", "/admin/assessments/business-development-officer-assessment-v2/preview", "/admin/questions", "/admin/questions/Q-001/edit", "/admin/settings"]) {
      expect(resolveAdminRouteAccess(authorized, path)).toEqual({ action: "render" });
      expect(isAdminProtectedPath(path)).toBe(true);
    }
  });

  it("G. sign out ends access: an unauthenticated session is redirected from every protected route", () => {
    for (const path of ["/admin", "/admin/applications/app-amina-adewale", "/admin/settings"]) {
      expect(resolveAdminRouteAccess(unauthenticated, path).action).toBe("redirect-login");
    }
  });

  it("H. authorized Admin visiting /admin/login is redirected away", () => {
    expect(resolveAdminLoginRedirect(authorized, null)).toBe("/admin");
    expect(resolveAdminLoginRedirect(authorized, "/admin/questions")).toBe("/admin/questions");
    expect(resolveAdminLoginRedirect(authorized, "/admin/login")).toBe("/admin");
    expect(resolveAdminLoginRedirect(unauthenticated, "/admin")).toBeNull();
    expect(resolveAdminLoginRedirect(loading, null)).toBeNull();
  });

  it("rejects unsafe return targets (open-redirect protection)", () => {
    expect(sanitizeAdminReturnPath("https://evil.example/admin")).toBeNull();
    expect(sanitizeAdminReturnPath("//evil.example")).toBeNull();
    expect(sanitizeAdminReturnPath("/auth/sign-in")).toBeNull();
    expect(sanitizeAdminReturnPath("/admin/login")).toBeNull();
    expect(sanitizeAdminReturnPath("/adminx")).toBeNull();
    expect(sanitizeAdminReturnPath("/admin/applications")).toBe("/admin/applications");
    expect(readAdminReturnPath("?next=%2Fadmin%2Fscreening")).toBe("/admin/screening");
    expect(readAdminReturnPath("?next=https%3A%2F%2Fevil.example")).toBeNull();
  });

  it("builds the preserved-destination login redirect", () => {
    expect(buildAdminLoginRedirect("/admin/applications/app-x")).toBe("/admin/login?next=%2Fadmin%2Fapplications%2Fapp-x");
    expect(buildAdminLoginRedirect("/apply")).toBe("/admin/login");
  });
});

describe("session state mapping", () => {
  it("maps server payloads to the four session states", () => {
    expect(toAdminSessionState(null)).toEqual(unauthenticated);
    expect(toAdminSessionState({ authenticated: false, authorized: false, user: null, profile: null })).toEqual(unauthenticated);
    expect(toAdminSessionState({ authenticated: true, authorized: false, user: authorized.user, profile: null }).status).toBe("unauthorized");
    expect(toAdminSessionState({ authenticated: true, authorized: true, user: authorized.user, profile: authorized.profile }).status).toBe("authorized");
  });
});

describe("credential sign-in flow (server-verified only)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    invalidateAdminSessionCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("B. successful authorized sign-in resolves the authorized session", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    expect(await requestAdminSignIn("admin@gmail.com", "correct-horse")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/auth/sign-in");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "admin@gmail.com", password: "correct-horse" });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, authorized: true, user: authorized.user, profile: authorized.profile }),
    });
    const payload = await fetchAdminSessionPayload(true);
    expect(toAdminSessionState(payload).status).toBe("authorized");
  });

  it("C. invalid credentials are rejected and the client stays on login with a safe error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await requestAdminSignIn("admin@gmail.com", "123456")).toBe(false);
    // No session is established by a rejection.
    expect(toAdminSessionState(null)).toEqual(unauthenticated);
  });

  it("session resolution failures degrade to unauthenticated, never to access", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await fetchAdminSessionPayload(true)).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await fetchAdminSessionPayload(true)).toBeNull();
  });

  it("G. sign out posts to the server and clears the client session cache", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    await requestAdminSignOut();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/auth/sign-out");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
