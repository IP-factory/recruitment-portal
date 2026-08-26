/**
 * Quiet Authority assessment placeholder: preserves the application shell and active stage without exposing assessment content prematurely.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function ApplicantAssessmentPlaceholder() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={2}>
      <section className="mx-auto max-w-[640px] py-8 sm:py-12">
        <p className="section-kicker">Step 3 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Assessment</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">The assessment introduction and quiz experience will be added in the next stage.</p>
        <FoundationButton className="mt-8" onClick={() => setLocation("/apply/business-development-manager/cv")} variant="secondary">Back to CV</FoundationButton>
      </section>
    </ApplicationShell>
  );
}
