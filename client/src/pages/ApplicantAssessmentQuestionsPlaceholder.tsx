/**
 * Quiet Authority assessment-questions placeholder: preserves the active assessment stage while question content remains a later implementation step.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function ApplicantAssessmentQuestionsPlaceholder() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={2}>
      <section className="mx-auto max-w-[640px] py-8 sm:py-12">
        <p className="section-kicker">Assessment in progress</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Assessment questions</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">The question-by-question assessment experience will be added in the next stage.</p>
        <FoundationButton className="mt-8" onClick={() => setLocation("/apply/business-development-manager/assessment")} variant="secondary">Back to assessment introduction</FoundationButton>
      </section>
    </ApplicationShell>
  );
}
