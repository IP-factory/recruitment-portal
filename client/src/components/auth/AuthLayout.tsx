/**
 * Quiet Authority auth shell: a focused, form-led applicant access layout using quiet process context rather than the public navigation.
 */
import { AlignmentMark } from "@/components/foundation/navigation";
import { Check, ChevronLeft, FileCheck2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const reassurances = [
  [FileCheck2, "Save your progress", "Return to your application without starting again."],
  [ShieldCheck, "Keep your information together", "Your application details and CV remain linked to your account."],
  [Check, "Submit when ready", "Review your information before final submission."],
] as const;

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-foreground lg:flex">
      <aside className="hidden min-h-screen w-[42%] flex-col bg-portal-surface px-10 py-9 lg:flex xl:px-14">
        <a aria-label="Recruitment Portal home" className="flex items-center gap-2.5 text-primary" href="/"><AlignmentMark /><span className="text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</span></a>
        <div className="flex flex-1 items-center">
          <div className="max-w-sm">
            <p className="section-kicker">Application Portal</p>
            <h1 className="mt-4 text-[38px] font-semibold leading-[1.1] tracking-[-0.04em] text-primary">Your application, in one place.</h1>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">Create an account to complete your profile, upload your CV, take the role assessment and return to your application if you need more time.</p>
            <ul className="mt-9 space-y-5 border-t border-border pt-6">
              {reassurances.map(([Icon, title, description]) => <li className="flex gap-3" key={title}><Icon className="mt-0.5 size-4 shrink-0 text-portal-blue" /><div><p className="text-sm font-semibold text-primary">{title}</p><p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p></div></li>)}
            </ul>
          </div>
        </div>
      </aside>
      <main className="min-h-screen flex-1 bg-white">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-8">
          <a aria-label="Recruitment Portal home" className="flex items-center gap-2.5 text-primary lg:hidden" href="/"><AlignmentMark /><span className="text-[15px] font-semibold tracking-[-0.02em]">Recruitment Portal</span></a>
          <span className="hidden lg:block" />
          <a className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary" href="/apply"><ChevronLeft className="size-4" />Back to opportunities</a>
        </header>
        <div className="mx-auto flex w-full max-w-[420px] flex-col px-5 pb-10 pt-8 sm:px-0 sm:pt-14 lg:min-h-[calc(100vh-96px)] lg:justify-center lg:pb-24 lg:pt-0">
          {children}
          <p className="mt-8 text-center text-[12px] leading-5 text-muted-foreground lg:hidden">Your progress will be saved once your account is connected to your application.</p>
        </div>
      </main>
    </div>
  );
}
