/**
 * Quiet Authority prototype completion: a restrained confirmation state that records local completion without implying backend submission.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { BUSINESS_DEVELOPMENT_MANAGER } from "@/lib/applicationData";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

export default function ApplicantSubmitted() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={3} submitted>
      <section className="mx-auto max-w-[620px] py-10 text-center sm:py-14">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-portal-blue-soft text-primary"><CheckCircle2 className="size-5" /></div>
        <p className="section-kicker mt-5">Application complete</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Your application is ready for submission.</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">You have completed all stages of the Business Development Manager application. Backend submission and processing will be connected in a later implementation stage.</p>
        <div className="mt-8 rounded-xl border border-border bg-white p-6 text-left shadow-none"><dl className="grid gap-5 sm:grid-cols-3"><div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role</dt><dd className="mt-1 text-sm font-semibold text-primary">{BUSINESS_DEVELOPMENT_MANAGER}</dd></div><div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</dt><dd className="mt-2"><StatusBadge status="Completed" /></dd></div><div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stages completed</dt><dd className="mt-1 text-sm font-semibold text-primary">4 of 4</dd></div></dl></div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"><FoundationButton onClick={() => setLocation("/apply")} size="lg">Return to opportunities</FoundationButton><FoundationButton onClick={() => setLocation("/apply/business-development-manager/review")} variant="secondary">View completed application</FoundationButton></div>
      </section>
    </ApplicationShell>
  );
}
