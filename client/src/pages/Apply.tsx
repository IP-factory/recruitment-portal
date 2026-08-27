/**
 * Quiet Authority role selection: a concise, reusable opportunity selector before the focused application workspace begins.
 */
import { AlignmentMark, PublicFooter, PublicNavigation } from "@/components/foundation/navigation";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { getBusinessDevelopmentOfficerRole, type RecruitmentRole } from "@/lib/adminRoleData";
import { BriefcaseBusiness, Check, ChevronRight, Clock3, MapPin } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const assessments = ["Relevant business development experience", "Commercial and sales judgement", "Client relationship capability", "Approach to business growth opportunities"] as const;

function RoleCard({ role, onApply }: { role: RecruitmentRole; onApply: () => void }) {
  return (
    <article className="rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(240px,3fr)] lg:gap-8">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-primary sm:text-2xl">{role.title}</h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5 text-portal-blue" />{role.department}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-portal-blue" />{role.employmentType}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-portal-blue" />Location: {role.location}</span>
          </div>
          <p className="mt-6 max-w-3xl text-[15px] leading-7 text-muted-foreground">{role.shortDescription}</p>
          <div className="mt-7 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-primary">What we will assess</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {assessments.map((item) => <li className="flex gap-2.5 text-[13px] leading-5 text-muted-foreground" key={item}><Check className="mt-0.5 size-3.5 shrink-0 text-portal-blue" />{item}</li>)}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="section-kicker">Application</p>
          <div className="mt-3"><StatusBadge status={role.status} /></div>
          <FoundationButton className="mt-6 w-full" disabled={role.status === "Closed"} onClick={onApply} size="lg">{role.status === "Closed" ? "Applications closed" : "Apply for this role"}</FoundationButton>
          <p className="mt-4 text-[13px] leading-5 text-muted-foreground">You will begin by providing your contact and professional information.</p>
        </div>
      </div>
    </article>
  );
}

export default function Apply() {
  const [, setLocation] = useLocation();
  const [availableRoles] = useState(() => [getBusinessDevelopmentOfficerRole()].filter((role) => role.status === "Open" || role.status === "Closed"));

  return (
    <div className="min-h-screen bg-white text-foreground">
      <PublicNavigation />
      <main>
        <section className="portal-container pt-20 sm:pt-20">
          <div className="max-w-[700px]">
            <div className="flex items-center gap-2"><AlignmentMark className="size-4" /><p className="section-kicker text-muted-foreground">Open Opportunities</p></div>
            <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-primary sm:text-[42px]">Choose the role you would like to apply for.</h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted-foreground">Review the available opportunity below and select the role to begin your application.</p>
          </div>
        </section>

        <section className="portal-container pb-20 pt-14 sm:pb-24 sm:pt-16">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-5"><div><p className="section-kicker">Available role</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary">Available role</h2></div></div>
          <div className="space-y-5">
            {availableRoles.map((role) => <RoleCard key={role.title} onApply={() => setLocation("/apply/business-development-officer")} role={role} />)}
          </div>

          <div className="mt-8 border border-border bg-portal-surface px-6 py-5 sm:px-7">
            <h2 className="text-base font-semibold text-primary">What happens after you start?</h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] font-medium text-primary">
              {["Information", "CV", "Assessment", "Review"].map((stage, index, stages) => <span className="inline-flex items-center gap-2" key={stage}><span>{stage}</span>{index < stages.length - 1 ? <ChevronRight className="size-3.5 text-portal-blue" /> : null}</span>)}
            </div>
            <p className="mt-3 text-[13px] leading-5 text-muted-foreground">Your application will move through these four stages before final submission.</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
