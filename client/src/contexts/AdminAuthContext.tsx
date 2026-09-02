/**
 * Task 24B — reusable Admin auth/session provider and route guard.
 *
 * Session logic lives here once; Admin pages never reimplement it. The guard
 * resolves the real server session before rendering anything protected, so
 * protected content never flashes while the session is unresolved.
 */
import { AlignmentMark, BrandLogo } from "@/components/foundation/navigation";
import { FoundationButton } from "@/components/foundation/ui";
import { isAdminProtectedPath, resolveAdminLoginRedirect, resolveAdminRouteAccess, sanitizeAdminReturnPath } from "@/lib/adminAuthGuards";
import { clearLegacyDemoSession, fetchAdminSessionPayload, invalidateAdminSessionCache, LOADING_ADMIN_SESSION, requestAdminSignIn, requestAdminSignOut, toAdminSessionState, UNAUTHENTICATED_ADMIN_SESSION, type AdminSessionState } from "@/lib/adminSession";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";

interface AdminAuthContextValue {
  state: AdminSessionState;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminSessionState>(LOADING_ADMIN_SESSION);

  useEffect(() => {
    clearLegacyDemoSession();
    let active = true;
    fetchAdminSessionPayload().then((payload) => {
      if (active) setState(toAdminSessionState(payload));
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const accepted = await requestAdminSignIn(email, password);
    if (accepted) {
      const payload = await fetchAdminSessionPayload(true);
      setState(toAdminSessionState(payload));
    }
    return accepted;
  }, []);

  const signOut = useCallback(async () => {
    await requestAdminSignOut();
    invalidateAdminSessionCache();
    setState(UNAUTHENTICATED_ADMIN_SESSION);
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminSession(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminSession must be used inside AdminAuthProvider");
  return context;
}

/** Restrained resolver shown while the real session is being verified. */
function AdminSessionResolving() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-portal-surface p-5">
      <div className="flex flex-col items-center gap-4" role="status">
        <BrandLogo className="max-h-9" />
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Verifying session</p>
      </div>
    </main>
  );
}

/** Restrained block page for authenticated users without an Active Admin profile. */
function AdminAccessUnavailable() {
  const { signOut } = useAdminSession();
  const [, setLocation] = useLocation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-portal-surface p-5 sm:p-8">
      <section className="w-full max-w-[450px] rounded-xl border border-border bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-8">
        <div className="flex items-center gap-2.5"><BrandLogo className="max-h-8" /></div>
        <h1 className="mt-7 text-3xl font-semibold tracking-[-0.035em] text-primary">Access unavailable</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Your account does not currently have access to the Xceptional by IPFactory administration workspace.</p>
        <FoundationButton className="mt-8 w-full" onClick={() => { void signOut().then(() => setLocation("/admin/login")); }} size="lg" type="button">Sign out</FoundationButton>
      </section>
    </main>
  );
}

/**
 * Session-level protection for every `/admin/*` route. Unauthenticated
 * visitors are redirected to `/admin/login` with their destination preserved;
 * authenticated non-Admin accounts see the restrained block page.
 */
export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { state } = useAdminSession();
  const [location] = useLocation();
  const decision = resolveAdminRouteAccess(state, isAdminProtectedPath(location) ? location : "/admin");
  if (decision.action === "loading") return <AdminSessionResolving />;
  if (decision.action === "redirect-login") return <Redirect to={decision.to} />;
  if (decision.action === "access-unavailable") return <AdminAccessUnavailable />;
  return <>{children}</>;
}

/** Safe Admin return target parsed from the login page `next` parameter. */
export function useAdminReturnPath(): string | null {
  const search = useSearch();
  const params = new URLSearchParams(search);
  return sanitizeAdminReturnPath(params.get("next"));
}

export { resolveAdminLoginRedirect };
