/**
 * Task 24D-1 — eligibility closeout page.
 *
 * Shown when the server-side eligibility evaluation determines that the
 * applicant does not meet one or more mandatory eligibility criteria for
 * this specific role. The user can still apply for other open roles.
 *
 * Role title is derived from the URL and confirmed against ApplicationState
 * so the message is accurate for any role, not hardcoded to BDO.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useApplicantRoleTitle } from "@/hooks/useApplicantRoleTitle";
import { XCircle } from "lucide-react";
import { useLocation, useRoute } from "wouter";

export default function ApplicantEligibilityCloseout() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/apply/:roleSlug/eligibility");
  const roleSlug = params?.roleSlug ?? "";
  const dynamicRoleTitle = useApplicantRoleTitle(roleSlug);
  const displayTitle = dynamicRoleTitle || roleSlug;

  return (
    <ApplicationShell activeStep={0} roleTitle={displayTitle} showSummary>
      <section className="max-w-2xl">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#fdeaea] text-status-error-strong">
          <XCircle className="size-6" />
        </div>
        <p className="section-kicker mt-5">Application eligibility</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">
          We cannot proceed with your application.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
          Based on the information you provided, you do not currently meet one or more of the
          mandatory eligibility requirements for the <strong className="font-semibold text-primary">{displayTitle}</strong> role.
        </p>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
          We appreciate your interest and encourage you to check back when your circumstances change,
          or to explore other open opportunities below.
        </p>

        <div className="mt-8 rounded-xl border border-[#fdeaea] bg-[#fff5f5] p-5">
          <p className="text-sm font-semibold text-status-error-strong">What this means</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-6 text-muted-foreground">
            <li>Your application for <strong className="font-medium text-primary">{displayTitle}</strong> has been closed at the eligibility stage.</li>
            <li>This decision cannot be reversed for this application.</li>
            <li>You are welcome to apply for any other open roles.</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
          <FoundationButton onClick={() => setLocation("/apply")} size="lg">
            View other opportunities
          </FoundationButton>
        </div>
      </section>
    </ApplicationShell>
  );
}
