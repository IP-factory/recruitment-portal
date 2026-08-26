/**
 * Quiet Authority public homepage: a concise, recruitment-focused gateway using the approved foundation without introducing workflow functionality.
 */
import { AlignmentMark, PublicFooter, PublicNavigation } from "@/components/foundation/navigation";
import { FoundationButton, SpecimenCard } from "@/components/foundation/ui";
import { Check, ClipboardList, FileText, Info, ListChecks, UserRound } from "lucide-react";
import { useLocation } from "wouter";

const processSteps = [
  ["01", "Profile", "Tell us the essential information we need for your application."],
  ["02", "Experience", "Share your relevant professional background."],
  ["03", "CV", "Upload your current CV for review."],
  ["04", "Assessment", "Complete a short role-specific assessment."],
  ["05", "Review & Submit", "Check your information before submitting your application."],
] as const;

const howItWorksSteps = [
  ["01", UserRound, "Complete your profile", "Provide your basic contact and professional information."],
  ["02", FileText, "Upload your CV", "Submit your current CV so your experience can be reviewed alongside your application."],
  ["03", ClipboardList, "Take the assessment", "Answer role-related questions designed to understand your experience and judgement."],
  ["04", ListChecks, "Review and submit", "Check your application and submit it for consideration."],
] as const;

const readinessItems = [
  ["Current CV", "Your most recent professional CV in a supported file format."],
  ["Contact information", "A valid email address and phone number."],
  ["Professional history", "Basic details about your current or previous work experience."],
  ["Time for the assessment", "Enough uninterrupted time to complete the role-specific questions carefully."],
] as const;

function DossierLabel({ children, centered = false }: { children: string; centered?: boolean }) {
  return <div className={`flex items-center gap-2 ${centered ? "justify-center" : ""}`}><AlignmentMark className="size-4" /><p className="section-kicker text-muted-foreground">{children}</p></div>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-white text-foreground">
      <PublicNavigation />
      <main>
        <section className="portal-container grid gap-12 py-20 sm:py-24 lg:grid-cols-[minmax(0,1.38fr)_minmax(380px,1fr)] lg:items-center lg:gap-12">
          <div className="max-w-2xl">
            <DossierLabel>Recruitment Application Portal</DossierLabel>
            <h1 className="mt-4 max-w-2xl text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-primary sm:text-[42px]">Take the next step in your application.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">Complete your profile, upload your CV and take a short role-specific assessment to help us understand your experience and approach to work.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <FoundationButton className="w-full sm:w-auto" onClick={() => setLocation("/apply")} size="lg">Start Application</FoundationButton>
              <a className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-portal-blue transition-colors hover:bg-portal-blue-soft hover:text-primary sm:w-auto" href="#how-it-works">How It Works</a>
            </div>
          </div>

          <SpecimenCard className="w-full max-w-[420px] justify-self-center p-0 shadow-none sm:justify-self-end">
            <div className="border-b border-border px-6 py-5">
              <p className="section-kicker">Application process</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">A simple five-step process from profile setup to final submission.</p>
            </div>
            <ol className="divide-y divide-border px-6" aria-label="Application process">
              {processSteps.map(([number, title, description]) => (
                <li className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 py-4" key={number}>
                  <span className="pt-0.5 text-[12px] font-semibold tracking-[0.08em] text-portal-blue">{number}</span>
                  <div><h2 className="text-sm font-semibold text-primary">{title}</h2><p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p></div>
                </li>
              ))}
            </ol>
            <div className="flex gap-2.5 border-t border-border bg-portal-surface px-6 py-4 text-[13px] leading-5 text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-portal-blue" /><span>Your progress will be saved as you complete your application.</span></div>
          </SpecimenCard>
        </section>

        <section className="bg-portal-surface" id="how-it-works">
          <div className="portal-container py-20 sm:py-24">
            <div className="max-w-2xl">
              <DossierLabel>How it works</DossierLabel>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">A straightforward application process.</h2>
              <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">Complete each stage at your own pace and review your information before final submission.</p>
            </div>
            <ol className="mt-10 grid border-t border-border lg:grid-cols-4" aria-label="How the application works">
              {howItWorksSteps.map(([number, Icon, title, description], index) => (
                <li className={`flex gap-4 border-b border-border py-6 lg:block lg:border-b-0 lg:py-0 lg:pt-6 ${index === 0 ? "lg:pr-6" : "lg:border-l lg:px-6"}`} key={number}>
                  <div className="flex shrink-0 items-center gap-2.5"><span className="text-[12px] font-semibold tracking-[0.08em] text-portal-blue">{number}</span><Icon className="size-4 text-primary" /></div>
                  <div className="lg:mt-5"><h3 className="text-[15px] font-semibold text-primary">{title}</h3><p className="mt-2 text-[13px] leading-5 text-muted-foreground">{description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="portal-container grid gap-12 py-20 sm:py-24 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <div className="max-w-md">
            <DossierLabel>Before you start</DossierLabel>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Have these ready before beginning your application.</h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Having the information below available will make the application process easier to complete.</p>
          </div>
          <div className="border-y border-border">
            {readinessItems.map(([title, description]) => (
              <div className="flex gap-4 border-b border-border py-5 last:border-b-0" key={title}>
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-portal-blue-soft text-primary"><Check className="size-3" /></span>
                <div><h3 className="text-sm font-semibold text-primary">{title}</h3><p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-portal-surface">
          <div className="portal-container py-20 text-center sm:py-24">
            <div className="mx-auto max-w-[650px]">
              <DossierLabel centered>Next step</DossierLabel>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Ready to begin your application?</h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Start your application and complete each stage when you are ready.</p>
              <FoundationButton className="mt-7" onClick={() => setLocation("/apply")} size="lg">Start Application</FoundationButton>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
