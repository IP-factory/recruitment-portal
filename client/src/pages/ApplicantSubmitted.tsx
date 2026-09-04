/**
 * Task 24D-1 — application submitted confirmation.
 *
 * Confirms the application has been persisted and submitted to TiDB.
 * Role title is read from the live ApplicationState so this page works
 * correctly for any recruitment role, not just BDO.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { fetchApplication } from "@/lib/applicationApi";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";

export default function ApplicantSubmitted() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/apply/:roleSlug/submitted");
  const roleSlug = params?.roleSlug ?? "";
  const [roleTitle, setRoleTitle] = useState<string>("");

  useEffect(() => {
    fetchApplication()
      .then((state) => setRoleTitle(state.roleTitle || roleSlug))
      .catch(() => setRoleTitle(roleSlug));
  }, [roleSlug]);

  const displayTitle = roleTitle || roleSlug;

  return (
    <ApplicationShell activeStep={3} submitted>
      <section className="mx-auto max-w-[620px] py-10 text-center sm:py-14">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-portal-blue-soft text-primary">
          <CheckCircle2 className="size-5" />
        </div>
        <p className="section-kicker mt-5">Application submitted</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">
          Your application has been submitted.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
          Thank you for completing the {displayTitle} application. Your information and assessment
          responses have been received and will be reviewed by the recruitment team.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-white p-6 text-left shadow-none">
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role</dt>
              <dd className="mt-1 text-sm font-semibold text-primary">{displayTitle}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</dt>
              <dd className="mt-2"><StatusBadge status="Completed" /></dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stages completed</dt>
              <dd className="mt-1 text-sm font-semibold text-primary">3 of 3</dd>
            </div>
          </dl>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <FoundationButton onClick={() => setLocation("/apply")} size="lg">
            Return to opportunities
          </FoundationButton>
          <FoundationButton
            onClick={() => setLocation(`/apply/${roleSlug}/review`)}
            variant="secondary"
          >
            View submitted application
          </FoundationButton>
        </div>
      </section>
    </ApplicationShell>
  );
}
