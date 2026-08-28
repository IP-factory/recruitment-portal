/**
 * Task 24D-1 — eligibility closeout page.
 *
 * Shown when the server-side eligibility evaluation determines that the
 * applicant does not meet one or more mandatory eligibility gates.
 * The closeout state is persisted in TiDB.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { Link } from "wouter";

export default function ApplicantEligibilityCloseout() {
  return <ApplicationShell activeStep={0} showSummary>
    <section className="max-w-2xl">
      <p className="section-kicker">Application eligibility</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">We cannot continue this application.</h1>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Based on the information provided, one or more mandatory eligibility requirements for this role are not currently met.</p>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">Thank you for your interest in the Business Development Officer opportunity.</p>
      <div className="mt-8 border-t border-border pt-6"><Link href="/apply"><FoundationButton size="lg">Return to opportunities</FoundationButton></Link></div>
    </section>
  </ApplicationShell>;
}
