/**
 * Task 24D-1 — review page with real persisted data.
 *
 * Loads applicant information, eligibility summary, and assessment responses
 * from TiDB. No scores, no internal IDs, no CV section for MVP.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { fetchReviewData, submitApplication, ApplicationApiError } from "@/lib/applicationApi";
import { AlertTriangle, Check, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useApplicantRoleTitle } from "@/hooks/useApplicantRoleTitle";

function useRoleSlug() {
  return useMemo(() => {
    if (typeof window === "undefined") return "business-development-officer";
    const match = window.location.pathname.match(/^\/apply\/([^/]+)/);
    return match?.[1] ?? "business-development-officer";
  }, []);
}

function valueOrNotProvided(value: string | undefined | null) { return value?.trim() || "Not provided"; }

function ReviewCard({ title, actionLabel, onAction, children, completed = false }: { title: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode; completed?: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-none sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary">{title}</h2>
        {completed ? <StatusBadge status="Completed" /> : actionLabel && onAction ? <button className="text-sm font-medium text-portal-blue hover:text-primary hover:underline" onClick={onAction} type="button">{actionLabel}</button> : null}
      </div>
      {children}
    </section>
  );
}

function DefinitionItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{value}</dd></div>;
}

interface ReviewData {
  applicant: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    /** New field: current employment/career status. */
    currentStatus?: string;
    /** New field: free-text when currentStatus is "Other". */
    currentStatusOther?: string;
    totalExperience: string;
    linkedinUrl: string;
    /** Legacy fields — populated for older records only. */
    recentRole?: string;
    recentEmployer?: string;
    relevantExperience?: string;
  };
  eligibility: {
    gates: Array<{ gateReference: string; outcome: string }>;
    eligible: boolean;
  };
  assessmentResponses: Record<string, string>;
  submittedAt: string | null;
}

export default function ApplicantReviewPlaceholder() {
  const [, setLocation] = useLocation();
  const roleSlug = useRoleSlug();
  const roleTitle = useApplicantRoleTitle(roleSlug);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [declarationOne, setDeclarationOne] = useState(false);
  const [declarationTwo, setDeclarationTwo] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    fetchReviewData()
      .then((data) => {
        setReviewData(data);
        if (data.submittedAt) setSubmitted(true);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApplicationApiError && (err.status === 401 || err.status === 403)) {
          setLocation(`/apply/${roleSlug}/information`);
        }
        setError(err instanceof Error ? err.message : "Unable to load your application for review.");
        setLoading(false);
      });
  }, [setLocation]);

  const handleSubmit = async () => {
    setAttempted(true);
    if (!declarationOne || !declarationTwo) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitApplication();
      setSubmitted(true);
      setLocation(`/apply/${roleSlug}/submitted`);
    } catch (err) {
      setError(err instanceof ApplicationApiError ? err.message : "Unable to submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ApplicationShell activeStep={3} roleTitle={roleTitle}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading your review...</div></section></ApplicationShell>;
  }

  if (error && !reviewData) {
    return <ApplicationShell activeStep={3} roleTitle={roleTitle}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="rounded-xl border border-border bg-white p-6 sm:p-8"><p className="text-status-error-strong">{error}</p></div></section></ApplicationShell>;
  }

  const applicant = reviewData?.applicant;
  const assessmentResponses = reviewData?.assessmentResponses ?? {};
  const responseEntries = Object.entries(assessmentResponses);

  return (
    <ApplicationShell activeStep={3} roleTitle={roleTitle} showSummary submitted={submitted}>
      <section>
        <p className="section-kicker">Step 4 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">{submitted ? "Completed application" : "Review your application"}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">{submitted ? "This application has been submitted." : "Check the information below before submitting your application."}</p>
        {submitted ? (
          <div className="alert-success mt-6 flex gap-3 rounded-lg border px-4 py-3.5"><CheckCircle2 className="mt-0.5 size-[18px] shrink-0" /><div><p className="text-sm font-semibold">Application submitted</p><p className="mt-0.5 text-[13px] leading-5 opacity-85">Your application has been submitted successfully.</p></div></div>
        ) : (
          <div className="alert-info mt-6 flex gap-3 rounded-lg border px-4 py-3.5"><Info className="mt-0.5 size-[18px] shrink-0" /><p className="text-[13px] leading-5 opacity-85">You can return to any section to make changes before submitting.</p></div>
        )}

        <div className="mt-8 space-y-5">
          {/* Applicant Information */}
          <ReviewCard actionLabel="Edit" completed={submitted} onAction={() => setLocation(`/apply/${roleSlug}/information`)} title="Applicant information">
            {applicant ? (
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <DefinitionItem label="Full name" value={valueOrNotProvided(applicant.fullName)} />
                <DefinitionItem label="Email address" value={valueOrNotProvided(applicant.email)} />
                <DefinitionItem label="Phone number" value={valueOrNotProvided(applicant.phone)} />
                <DefinitionItem label="Current city / location" value={valueOrNotProvided(applicant.city)} />
                {/* New field — shown for applications created after the form update */}
                {applicant.currentStatus ? (
                  <DefinitionItem label="Current status" value={applicant.currentStatus === "Other" && applicant.currentStatusOther ? `${applicant.currentStatus} — ${applicant.currentStatusOther}` : applicant.currentStatus} />
                ) : applicant.recentRole ? (
                  /* Legacy fallback — shown for historical records only */
                  <DefinitionItem label="Most recent role" value={applicant.recentRole} />
                ) : null}
                {/* Legacy employer — only shown if the record has a value */}
                {applicant.recentEmployer ? (
                  <DefinitionItem label="Most recent employer" value={applicant.recentEmployer} />
                ) : null}
                <DefinitionItem label="Total professional experience" value={valueOrNotProvided(applicant.totalExperience)} />
                {applicant.linkedinUrl ? (
                  <DefinitionItem label="LinkedIn profile" value={applicant.linkedinUrl} />
                ) : null}
              </dl>
            ) : null}
          </ReviewCard>

          {/* Eligibility Summary */}
          <ReviewCard title="Eligibility" completed={submitted}>
            {reviewData?.eligibility ? (
              <div className="mt-5">
                <p className={`text-sm font-semibold ${reviewData.eligibility.eligible ? "text-primary" : "text-status-error-strong"}`}>
                  {reviewData.eligibility.eligible ? "Eligibility passed" : "Eligibility closed"}
                </p>
                <div className="mt-3 space-y-2">
                  {reviewData.eligibility.gates.filter((g) => g.outcome !== "Configuration required").map((gate) => (
                    <div className="flex items-center gap-2 text-sm" key={gate.gateReference}>
                      <span className={`inline-flex size-5 items-center justify-center rounded-full ${gate.outcome === "Passed" ? "bg-green-100 text-green-700" : gate.outcome === "Flagged" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {gate.outcome === "Passed" ? <Check className="size-3" /> : gate.outcome === "Failed" ? "✗" : "!"}
                      </span>
                      <span className="text-primary">{gate.gateReference}: {gate.outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </ReviewCard>

          {/* Assessment Responses */}
          <ReviewCard actionLabel="Review responses" completed={submitted} onAction={() => setLocation(`/apply/${roleSlug}/assessment/questions`)} title="Assessment">
            <div className="mt-5">
              <p className="text-sm font-semibold text-primary">Assessment responses</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{responseEntries.length} responses recorded</p>
            </div>
            {responseEntries.length > 0 ? (
              <div className="mt-5 divide-y divide-border border-y border-border">
                {responseEntries.map(([questionId, responseText], index) => (
                  <div className="py-5" key={questionId}>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-portal-blue">{String(index + 1).padStart(2, "0")}</p>
                    <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your response</p>
                    <p className="mt-1 text-sm leading-6 text-foreground">{responseText || "Not provided"}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </ReviewCard>
        </div>

        {!submitted ? (
          <section className="mt-5 rounded-xl border border-border bg-white p-6 shadow-none sm:p-7">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary">Declaration</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Please confirm the following before submitting your application.</p>
            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <input checked={declarationOne} className="mt-1 size-4 rounded border-input accent-primary" onChange={(event) => setDeclarationOne(event.target.checked)} type="checkbox" />
                I confirm that the information provided in this application is accurate to the best of my knowledge.
              </label>
              <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <input checked={declarationTwo} className="mt-1 size-4 rounded border-input accent-primary" onChange={(event) => setDeclarationTwo(event.target.checked)} type="checkbox" />
                I understand that my application information and assessment responses will be reviewed as part of the recruitment process.
              </label>
            </div>
            {error ? <p className="mt-4 text-[13px] text-status-error-strong">{error}</p> : null}
            {attempted && (!declarationOne || !declarationTwo) ? <p className="mt-4 text-[13px] text-status-error-strong">Confirm both declarations before submitting.</p> : null}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <FoundationButton className="w-full sm:w-auto" onClick={() => setLocation(`/apply/${roleSlug}/assessment/complete`)} variant="secondary">Back to assessment</FoundationButton>
              <FoundationButton className="w-full sm:w-auto" disabled={submitting || !declarationOne || !declarationTwo} onClick={handleSubmit} size="lg">{submitting ? "Submitting..." : "Submit application"}</FoundationButton>
            </div>
          </section>
        ) : null}
      </section>
    </ApplicationShell>
  );
}
