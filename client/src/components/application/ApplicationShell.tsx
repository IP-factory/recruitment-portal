/**
 * Quiet Authority application shell: a focused, rule-led workspace that deliberately replaces public-site chrome during an active application.
 */
import { AlignmentMark } from "@/components/foundation/navigation";
import { ProgressStepper, StatusBadge } from "@/components/foundation/ui";
import { APPLICATION_STEPS, BUSINESS_DEVELOPMENT_MANAGER } from "@/lib/applicationData";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

function ApplicationHeader() {
  return (
    <header className="h-[72px] border-b border-border bg-white">
      <div className="portal-container flex h-full items-center justify-between">
        <div className="flex min-w-0 items-center gap-3 text-primary"><a aria-label="Recruitment Portal home" className="flex items-center gap-2.5" href="/"><AlignmentMark /><span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</span></a><span className="hidden h-5 w-px bg-border sm:block" /><span className="hidden truncate text-sm text-muted-foreground sm:block">{BUSINESS_DEVELOPMENT_MANAGER}</span></div>
        <a className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="/apply"><ChevronLeft className="size-4" />Exit application</a>
      </div>
    </header>
  );
}

export function ApplicationSummary() {
  return (
    <aside className="sticky top-8 rounded-xl border border-border bg-white p-6 shadow-none">
      <p className="section-kicker">Your application</p>
      <h2 className="mt-3 text-base font-semibold text-primary">{BUSINESS_DEVELOPMENT_MANAGER}</h2>
      <div className="mt-3"><StatusBadge status="In Progress" /></div>
      <div className="mt-6 border-t border-border pt-5"><p className="text-sm font-semibold text-primary">Current stage</p><p className="mt-1 text-sm text-muted-foreground">Information</p></div>
      <div className="mt-6"><p className="text-sm font-semibold text-primary">Application stages</p><ol className="mt-3 space-y-1.5">{APPLICATION_STEPS.map((stage, index) => <li className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${index === 0 ? "bg-portal-blue-soft font-medium text-primary" : "text-muted-foreground"}`} key={stage}><span className="text-[11px] font-semibold tracking-[0.08em]">0{index + 1}</span>{stage}</li>)}</ol></div>
      <p className="mt-6 border-t border-border pt-4 text-[12px] leading-5 text-muted-foreground">Your information is currently stored on this device while the application experience is being developed.</p>
    </aside>
  );
}

export function ApplicationShell({ activeStep, children, showSummary = false }: { activeStep: number; children: ReactNode; showSummary?: boolean }) {
  return (
    <div className="min-h-screen bg-portal-surface text-foreground">
      <ApplicationHeader />
      <section className="border-b border-border bg-white"><div className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6"><ProgressStepper current={activeStep} steps={APPLICATION_STEPS} /></div></section>
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 sm:py-12">{showSummary ? <div className="grid gap-10 lg:grid-cols-[minmax(0,69fr)_minmax(250px,31fr)] lg:gap-12"><div>{children}</div><div className="hidden lg:block"><ApplicationSummary /></div></div> : children}</main>
    </div>
  );
}
