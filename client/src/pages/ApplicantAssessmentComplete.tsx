/**
 * Quiet Authority assessment completion: a calm success state that retains responses and directs applicants to the forthcoming review step.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { loadAssessmentResponseState, saveAssessmentResponseState } from "@/lib/assessmentData";
import { CheckCircle2, Info } from "lucide-react";
import { useLocation } from "wouter";

export default function ApplicantAssessmentComplete() {
  const [, setLocation] = useLocation();
  const reviewResponses = () => { const state = loadAssessmentResponseState(); saveAssessmentResponseState({ ...state, currentQuestionIndex: 0 }); setLocation("/apply/business-development-manager/assessment/questions"); };
  return (
    <ApplicationShell activeStep={2}>
      <section className="mx-auto max-w-[620px] py-10 text-center sm:py-14">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-portal-blue-soft text-primary"><CheckCircle2 className="size-5" /></div>
        <p className="section-kicker mt-5">Assessment complete</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Your responses have been recorded.</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">You have completed the Business Development Assessment. You can now continue to review your application before submission.</p>
        <div className="alert-info mt-7 flex gap-3 rounded-lg border px-4 py-3.5 text-left"><Info className="mt-0.5 size-[18px] shrink-0" /><p className="text-[13px] leading-5 opacity-85">Your assessment responses will remain part of your application and will not display a score to you.</p></div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"><FoundationButton onClick={() => setLocation("/apply/business-development-manager/review")} size="lg">Continue to review</FoundationButton><FoundationButton onClick={reviewResponses} variant="secondary">Review assessment responses</FoundationButton></div>
      </section>
    </ApplicationShell>
  );
}
