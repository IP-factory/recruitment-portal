/**
 * Quiet Authority Assessment Introduction: a calm, role-specific preparation step with no questions, scoring, timer, or backend state.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { BriefcaseBusiness, Check, CircleDot, Info, MessagesSquare } from "lucide-react";
import { useLocation } from "wouter";

const expectations = [
  [BriefcaseBusiness, "Role-related questions", "Questions will focus on relevant Business Development experience and responsibilities."],
  [MessagesSquare, "Practical scenarios", "Some questions will ask how you would respond to common commercial or client situations."],
  [CircleDot, "Choose the closest answer", "Select the option that best reflects your actual experience or how you would most likely respond."],
] as const;

const guidance = [
  ["Answer based on your actual experience", "Choose the response that most accurately reflects what you have done or would do."],
  ["Read each question carefully", "Some answer options may appear similar, so consider the question before selecting your response."],
  ["Complete the assessment yourself", "Your responses should reflect your own experience and judgement."],
  ["Review before final submission", "You will have an opportunity to review your application before submitting it."],
] as const;

export default function ApplicantAssessmentPlaceholder() {
  const [, setLocation] = useLocation();
  return (
    <ApplicationShell activeStep={2} showSummary>
      <section>
        <p className="section-kicker">Step 3 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Business Development Assessment</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">This short role-specific assessment helps us understand your experience, commercial judgement and approach to common Business Development situations.</p>
        <div className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
          <section aria-labelledby="expect-title">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="expect-title">What to expect</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">You will answer a series of questions related to your experience and how you would approach Business Development situations.</p>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {expectations.map(([Icon, title, description]) => <div className="flex gap-3 py-4" key={title}><Icon className="mt-0.5 size-4 shrink-0 text-portal-blue" /><div><h3 className="text-sm font-semibold text-primary">{title}</h3><p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p></div></div>)}
            </div>
          </section>
          <section aria-labelledby="before-begin-title" className="mt-8 border-t border-border pt-7">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary" id="before-begin-title">Before you begin</h2>
            <div className="mt-5 space-y-4">
              {guidance.map(([title, description]) => <div className="flex gap-3" key={title}><Check className="mt-0.5 size-4 shrink-0 text-portal-blue" /><div><h3 className="text-sm font-semibold text-primary">{title}</h3><p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p></div></div>)}
            </div>
          </section>
          <section className="alert-info mt-8 flex gap-3 rounded-lg border px-4 py-3.5" aria-labelledby="assessment-note-title">
            <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
            <div><h2 className="text-sm font-semibold" id="assessment-note-title">A note about the assessment</h2><p className="mt-0.5 text-[13px] leading-5 opacity-85">There are no visible scores while completing the assessment. Focus on selecting the response that best represents you.</p></div>
          </section>
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><FoundationButton className="w-full sm:w-auto" onClick={() => setLocation("/apply/business-development-manager/cv")} variant="secondary">Back to CV</FoundationButton><FoundationButton className="w-full sm:w-auto" onClick={() => setLocation("/apply/business-development-manager/assessment/questions")} size="lg">Start assessment</FoundationButton></div>
        </div>
      </section>
    </ApplicationShell>
  );
}
