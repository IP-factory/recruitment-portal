/**
 * Task 24F — submission outcome route for `/apply/business-development-officer/submitted`.
 *
 * Replaces the guard-wrapped success page that rendered blank for ineligible
 * applicants. The page loads the real application state and branches:
 * - eligibility Closed → professional "Not Eligible" outcome (never exposes
 *   gate codes or scoring internals)
 * - applicationStatus Submitted → the normal success confirmation
 * - anything else → redirect back into the application flow
 *
 * Loading and error states always render visible content — never a blank page.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton } from "@/components/foundation/ui";
import { ApplicationApiError, fetchApplication, loadApplicantSession } from "@/lib/applicationApi";
import { resolveSubmissionOutcome } from "@/lib/submissionOutcome";
import { XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import ApplicantSubmitted from "./ApplicantSubmitted";

export default function ApplicantSubmissionOutcome() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"not-eligible" | "submitted" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const hasSession = Boolean(loadApplicantSession());
    if (!hasSession) {
      setLocation("/apply/business-development-officer/information");
      return;
    }
    let cancelled = false;
    fetchApplication()
      .then((state) => {
        if (cancelled) return;
        const resolved = resolveSubmissionOutcome({
          hasSession: true,
          eligibilityStatus: state.eligibilityStatus,
          applicationStatus: state.applicationStatus,
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
          setLocation("/apply/business-development-officer/information");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load your application status.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt, setLocation]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (loading) {
    return <ApplicationShell activeStep={3} submitted><section className="mx-auto max-w-[620px] py-10 sm:py-14"><DataLoadingState label="Checking your application status" /></section></ApplicationShell>;
  }

  if (error) {
    return <ApplicationShell activeStep={3} submitted><section className="mx-auto max-w-[620px] py-10 sm:py-14"><DataErrorState message={error} onRetry={retry} /></section></ApplicationShell>;
  }

  if (outcome === "submitted") return <ApplicantSubmitted />;

  return (
    <ApplicationShell activeStep={0}>
      <section className="mx-auto max-w-[620px] py-10 text-center sm:py-14">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-status-error-soft text-status-error-strong"><XCircle className="size-5" /></div>
        <p className="section-kicker mt-5">Application outcome</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">We're unable to continue with your application</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Thank you for your interest in the role. Based on the eligibility information provided, your application does not currently meet one or more of the requirements for this position, so we're unable to proceed to the assessment stage. We appreciate the time you took to apply.</p>
        <div className="mt-8">
          <FoundationButton onClick={() => setLocation("/apply")} size="lg">Return to opportunities</FoundationButton>
        </div>
      </section>
    </ApplicationShell>
  );
}
