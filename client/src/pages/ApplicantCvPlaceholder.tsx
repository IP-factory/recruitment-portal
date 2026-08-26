/**
 * Quiet Authority CV-stage placeholder: preserves application context and progress while file upload remains a later implementation step.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { useLocation } from "wouter";

export default function ApplicantCvPlaceholder() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={1}>
      <section className="mx-auto max-w-[640px] py-8 sm:py-12">
        <p className="section-kicker">Step 2 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">CV Upload</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">The CV upload experience will be added in the next stage.</p>
        <FoundationButton className="mt-8" onClick={() => setLocation("/apply/business-development-manager")} variant="secondary">Back to information</FoundationButton>
      </section>
    </ApplicationShell>
  );
}
