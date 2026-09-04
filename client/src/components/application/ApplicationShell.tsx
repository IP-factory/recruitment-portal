/**
 * Quiet Authority application shell: a focused, rule-led workspace that
 * deliberately replaces public-site chrome during an active application.
 *
 * The role title is passed as a prop — never hardcoded to any specific role.
 * Pages that have already fetched ApplicationState pass state.roleTitle; pages
 * that are still loading pass an empty string so a neutral placeholder shows.
 */
import { AlignmentMark, BrandLogo } from "@/components/foundation/navigation";
import { ProgressStepper, StatusBadge } from "@/components/foundation/ui";
import { APPLICATION_STEPS } from "@/lib/applicationData";
import { Check, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

function ApplicationHeader({ roleTitle }: { roleTitle: string }) {
  return (
    <header className="h-[72px] border-b border-border bg-white">
      <div className="portal-container flex h-full items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <a aria-label="Xceptional by IPFactory home" className="flex items-center" href="/">
            <BrandLogo className="max-h-8" />
          </a>
          <span className="hidden h-5 w-px bg-border sm:block" />
          {roleTitle ? (
            <span className="hidden truncate text-sm text-muted-foreground sm:block">{roleTitle}</span>
          ) : null}
        </div>
        <a
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          href="/apply"
        >
          <ChevronLeft className="size-4" />Exit application
        </a>
      </div>
    </header>
  );
}

export function ApplicationSummary({
  activeStep,
  roleTitle,
  submitted = false,
}: {
  activeStep: number;
  roleTitle: string;
  submitted?: boolean;
}) {
  return (
    <aside className="sticky top-8 rounded-xl border border-border bg-white p-6 shadow-none">
      <p className="section-kicker">Your application</p>
      {roleTitle ? (
        <h2 className="mt-3 text-base font-semibold text-primary">{roleTitle}</h2>
      ) : (
        <h2 className="mt-3 text-base font-semibold text-muted-foreground">Application</h2>
      )}
      <div className="mt-3">
        <StatusBadge status={submitted ? "Completed" : "In Progress"} />
      </div>
      {!submitted ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-semibold text-primary">Current stage</p>
          <p className="mt-1 text-sm text-muted-foreground">{APPLICATION_STEPS[activeStep]}</p>
        </div>
      ) : null}
      <div className="mt-6">
        <p className="text-sm font-semibold text-primary">Application stages</p>
        <ol className="mt-3 space-y-1.5">
          {APPLICATION_STEPS.map((stage, index) => (
            <li
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${
                !submitted && index === activeStep
                  ? "bg-portal-blue-soft font-medium text-primary"
                  : index < activeStep || submitted
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
              key={stage}
            >
              {index < activeStep || submitted ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-2.5" />
                </span>
              ) : (
                <span className="text-[11px] font-semibold tracking-[0.08em]">0{index + 1}</span>
              )}
              {stage}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 border-t border-border pt-4 text-[12px] leading-5 text-muted-foreground">
        Your application is persisted securely. You can resume at any time from this device.
      </p>
    </aside>
  );
}

export function ApplicationShell({
  activeStep,
  children,
  roleTitle = "",
  showSummary = false,
  submitted = false,
}: {
  activeStep: number;
  children: ReactNode;
  /** Role title for the header and sidebar. Pass empty string while loading. */
  roleTitle?: string;
  showSummary?: boolean;
  submitted?: boolean;
}) {
  return (
    <div className="min-h-screen bg-portal-surface text-foreground">
      <ApplicationHeader roleTitle={roleTitle} />
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6">
          <ProgressStepper current={activeStep} steps={APPLICATION_STEPS} />
        </div>
      </section>
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 sm:py-12">
        {showSummary ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,69fr)_minmax(250px,31fr)] lg:gap-12">
            <div>{children}</div>
            <div className="hidden lg:block">
              <ApplicationSummary activeStep={activeStep} roleTitle={roleTitle} submitted={submitted} />
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
