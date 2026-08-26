/**
 * Quiet Authority review placeholder: preserves the active Review stage while final application review and submission are intentionally deferred.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function ApplicantReviewPlaceholder() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={3}>
      <section className="mx-auto max-w-[640px] py-8 sm:py-12">
        <p className="section-kicker">Step 4 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Review your application</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">The final application review and submission experience will be added in the next stage.</p>
        <FoundationButton className="mt-8" onClick={() => setLocation("/apply/business-development-manager/assessment/complete")} variant="secondary">Back to assessment</FoundationButton>
      </section>
    </ApplicationShell>
  );
}
