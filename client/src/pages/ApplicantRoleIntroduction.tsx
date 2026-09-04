/**
 * Task 24G (Part E / 15A) — public Role Detail & Introduction page.
 *
 * DB-driven introduction step rendered at `/apply/:roleSlug` BEFORE the
 * information step. Everything (title, department, location, employment type,
 * short + full description, closing date) comes from the recruitment role
 * record in TiDB — no hardcoded role copy. The long description renders
 * through the controlled rich renderer (no raw markup, no HTML injection) and
 * stays fully backward compatible with plain-text descriptions.
 */
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { AlignmentMark, PublicFooter, PublicNavigation } from "@/components/foundation/navigation";
import { RichDescription } from "@/components/foundation/RichDescription";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { fetchApplication, loadApplicantSession } from "@/lib/applicationApi";
import { fetchPublicRole, formatRoleDateLabel, type PublicRecruitmentRole } from "@/lib/recruitmentApi";
import { BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";

/** Descriptions longer than this preview collapsed behind "View full description". */
const FULL_DESCRIPTION_PREVIEW_LENGTH = 420;

export default function ApplicantRoleIntroduction() {
  const [, params] = useRoute("/apply/:roleSlug");
  const [, setLocation] = useLocation();
  const roleSlug = params?.roleSlug ?? "";
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [role, setRole] = useState<PublicRecruitmentRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const load = () => {
    setStatus("loading");
    fetchPublicRole(roleSlug)
      .then((data) => { setRole(data); setStatus("ready"); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Unable to load this recruitment role."); setStatus("error"); });
  };
  useEffect(() => { load(); }, [roleSlug]);

  // Check whether the stored session belongs to THIS role so we show the
  // correct button label ("Continue" vs "Start application").
  useEffect(() => {
    const session = loadApplicantSession();
    if (!session) { setHasSession(false); return; }
    fetchApplication()
      .then((state) => setHasSession(state.roleSlug === roleSlug))
      .catch(() => setHasSession(false));
  }, [roleSlug]);

  const startApplication = () => setLocation(`/apply/${roleSlug}/information`);
  const isLongDescription = (role?.fullDescription.trim().length ?? 0) > FULL_DESCRIPTION_PREVIEW_LENGTH;
  const closed = role?.status === "Closed";

  return (
    <div className="min-h-screen bg-white text-foreground">
      <PublicNavigation />
      <main>
        <section className="portal-container pt-16 sm:pt-20">
          <button className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary" onClick={() => setLocation("/apply")} type="button"><ChevronLeft className="size-4" />All opportunities</button>
          {status === "loading" ? <div className="mt-10"><DataLoadingState label="Loading role details" /></div> : null}
          {status === "error" ? <div className="mt-10"><DataErrorState message={error ?? "Unable to load this recruitment role."} onRetry={load} /></div> : null}
          {status === "ready" && role ? (
            <div className="mt-8 max-w-[760px]">
              <div className="flex items-center gap-2"><AlignmentMark className="size-4" /><p className="section-kicker text-muted-foreground">Role introduction</p></div>
              <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-primary sm:text-[42px]">{role.title}</h1>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5 text-portal-blue" />{role.department}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-portal-blue" />{role.employmentType}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-portal-blue" />Location: {role.location}</span>
                <StatusBadge status={role.status} />
              </div>
              <p className="mt-6 text-[15px] leading-7 text-muted-foreground">{role.shortDescription}</p>
            </div>
          ) : null}
        </section>

        {status === "ready" && role ? (
          <section className="portal-container pb-20 pt-12 sm:pb-24 sm:pt-14">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:gap-12">
              <article className="rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-primary">About this opportunity</h2>
                {role.fullDescription.trim() ? (
                  <>
                    <RichDescription className="mt-4" source={expanded || !isLongDescription ? role.fullDescription : `${role.fullDescription.slice(0, FULL_DESCRIPTION_PREVIEW_LENGTH).replace(/\s+\S*$/, "")}…`} />
                    {isLongDescription ? (
                      <button className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={() => setExpanded((current) => !current)} type="button">
                        {expanded ? <>Show less<ChevronDown className="size-3.5 rotate-180" /></> : <>View full description<ChevronDown className="size-3.5" /></>}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 text-[14px] leading-6 text-muted-foreground">The full description for this role will be published soon.</p>
                )}
              </article>

              <aside className="h-fit rounded-xl border border-border bg-portal-surface p-6 sm:p-7">
                <p className="section-kicker">Application</p>
                <dl className="mt-4 space-y-4">
                  <div><dt className="text-[12px] text-muted-foreground">Role</dt><dd className="mt-1 text-sm font-medium text-primary">{role.title}</dd></div>
                  <div><dt className="text-[12px] text-muted-foreground">Department</dt><dd className="mt-1 text-sm font-medium text-primary">{role.department}</dd></div>
                  <div><dt className="text-[12px] text-muted-foreground">Application closing date</dt><dd className="mt-1 text-sm font-medium text-primary">{formatRoleDateLabel(role.closingDate)}</dd></div>
                </dl>
                <FoundationButton className="mt-6 w-full" disabled={closed} onClick={startApplication} size="lg">{closed ? "Applications closed" : hasSession ? "Continue your application" : "Start application"}</FoundationButton>
                <p className="mt-4 text-[13px] leading-5 text-muted-foreground">You will move through Information, CV, Assessment and Review before final submission.</p>
              </aside>
            </div>

            <div className="mt-8 border border-border bg-portal-surface px-6 py-5 sm:px-7">
              <h2 className="text-base font-semibold text-primary">What happens after you start?</h2>
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] font-medium text-primary">
                {["Information", "CV", "Assessment", "Review"].map((stage, index, stages) => <span className="inline-flex items-center gap-2" key={stage}><span>{stage}</span>{index < stages.length - 1 ? <ChevronRight className="size-3.5 text-portal-blue" /> : null}</span>)}
              </div>
              <p className="mt-3 text-[13px] leading-5 text-muted-foreground">Your application will move through these four stages before final submission.</p>
            </div>
          </section>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
