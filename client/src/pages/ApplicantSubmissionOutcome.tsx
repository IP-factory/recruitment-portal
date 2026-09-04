/**
 * Task 24F — submission outcome route for `/apply/:roleSlug/submitted`.
 *
 * Replaces the guard-wrapped success page that rendered blank for ineligible
 * applicants. The page loads the real application state and branches:
 * - eligibility Closed → professional "Not Eligible" outcome (never exposes
 *   gate codes or scoring internals)
 * - applicationStatus Submitted → the normal success confirmation
 * - anything else → redirect back into the application flow
 *
 * Role slug is derived from the URL so this works for any role, not just BDO.
 * Loading and error states always render visible content — never a blank page.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton } from "@/components/foundation/ui";
import { ApplicationApiError, fetchApplication, loadApplicantSession } from "@/lib/applicationApi";
import { resolveSubmissionOutcome } from "@/lib/submissionOutcome";
import { XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import ApplicantSubmitted from "./ApplicantSubmitted";

function useRoleSlug() {
  return useMemo(() => {
    if (typeof window === "undefined") return "business-development-officer";
    const match = window.location.pathname.match(/^\/apply\/([^/]+)/);
    return match?.[1] ?? "business-development-officer";
  }, []);
}

export default function ApplicantSubmissionOutcome() {
  const [, setLocation] = useLocation();
  const roleSlug = useRoleSlug();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"not-eligible" | "submitted" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const hasSession = Boolean(loadApplicantSession());
    if (!hasSession) {
      setLocation(`/apply/${roleSlug}/information`);
      return;
    }
    let cancelled = false;
    fetchApplication()
      .then((state) => {
        if (cancelled) return;
        // If the session belongs to a different role, send to that role's
        // information page rather than showing a stale outcome.
        const effectiveSlug = state.roleSlug || roleSlug;
        const resolved = resolveSubmissionOutcome({
          hasSession: true,
          eligibilityStatus: state.eligibilityStatus,
          applicationStatus: state.applicationStatus,
          roleSlug: effectiveSlug,
        });
        if (resolved.redirect) {
          setLocation(resolved.redirect);
          return;
        }
        setOutcome(resolved.kind === "not-eligible" ? "not-eligible" : "submitted");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApplicationApiError && (err.status === 401 || err.status === 403)) {
          setLocation(`/apply/${roleSlug}/information`);
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load your application status.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt, setLocation, roleSlug]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (loading) {
    return <ApplicationShell activeStep={3} submitted><section className="mx-auto max-w-[620px] py-10 sm:py-14"><DataLoadingState label="Checking your application status" /></section></ApplicationShell>;
  }

  if (error) {
    return <ApplicationShell activeStep={3} submitted><section className="mx-auto max-w-[620px] py-10 sm:py-14"><DataErrorState message={error} onRetry={retry} /></section></ApplicationShell>;
  }

  if (outcome === "submitted") return <ApplicantSubmitted />;

  // Not-eligible outcome — shown when eligibilityStatus is "Closed"
  return (
    <ApplicationShell activeStep={0}>
      <section className="mx-auto max-w-[620px] py-10 text-center sm:py-14">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-status-error-soft text-status-error-strong">
          <XCircle className="size-5" />
        </div>
        <p className="section-kicker mt-5">Application outcome</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">
          We cannot proceed with your application.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
          Thank you for your interest. Based on the eligibility information you provided, your
          application does not currently meet one or more of the requirements for this position.
          We appreciate the time you took to apply.
        </p>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          You are welcome to explore other open opportunities below.
        </p>
        <div className="mt-8">
          <FoundationButton onClick={() => setLocation("/apply")} size="lg">
            View other opportunities
          </FoundationButton>
        </div>
      </section>
    </ApplicationShell>
  );
}
