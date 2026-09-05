/**
 * Task 24D-2 — Admin Screening workspace.
 *
 * Real TiDB application data replaces mock candidates. Default sort is
 * Final Score highest-first so the first page gives the 10 highest-scoring
 * candidates. Shortlisting is manual and persistent.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationButton, FoundationInput, FoundationSelect, StatusBadge } from "@/components/foundation/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  fetchAdminApplications,
  updateShortlist,
  updateApplicationStatus,
  type AdminApplicationSummary,
  type EvaluationStatus,
  type ScreeningBand,
} from "@/lib/adminApplicationApi";
import { applicationStatusDisplayLabel, eligibilityDisplayLabel } from "@/lib/adminDisplay";
import { screeningRoleKey, screeningRoleOptions } from "@/lib/screeningRoles";
import { calculateOverallCandidateScore, describeCvScore, describeOverallCandidateScore } from "@shared/candidateScore";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SortOption = "final-score-desc" | "final-score-asc" | "overall-desc" | "overall-asc" | "cv-desc" | "cv-asc" | "application-desc" | "application-asc" | "candidate";
type FilterValue = "all" | string;
type PendingAction = { type: "shortlist" | "hold" | "close"; app: AdminApplicationSummary } | null;
const bandOptions: { value: FilterValue; label: string }[] = [{ value: "all", label: "All bands" }, { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }, { value: "D", label: "D" }, { value: "Pending", label: "Pending" }];
const statusOptions = ["all", "Submitted", "Shortlisted", "Hold", "Closed"];
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function EligibilityValue({ value }: { value: string }) {
  const label = eligibilityDisplayLabel(value);
  return <span className={`text-[13px] font-semibold ${label === "Eligible" ? "text-status-success-strong" : label === "Not Eligible" ? "text-status-error-strong" : "text-[#765d22]"}`}>{label}</span>;
}
function ScoreValue({ score, status }: { score: number | null; status: EvaluationStatus | null }) {
  if (status === "Pending Assessment" || status === "Pending OPEN Review") return <span className="text-[13px] text-muted-foreground">Pending review</span>;
  if (score === null) return <span className="text-[13px] text-muted-foreground">—</span>;
  return <span className="text-[13px] font-semibold text-primary">{score.toFixed(1)}</span>;
}
function CvScoreValue({ cvScore, cvUploaded }: { cvScore: number | null; cvUploaded: boolean }) {
  if (cvScore === null) return <span className="text-[13px] text-muted-foreground">{describeCvScore(cvScore, cvUploaded)}</span>;
  return <span className="text-[13px] font-semibold text-primary">{describeCvScore(cvScore, cvUploaded)}</span>;
}
function OverallScoreValue({ assessmentScore, cvScore, status }: { assessmentScore: number | null; cvScore: number | null; status: EvaluationStatus | null }) {
  const label = status === "Pending Assessment" || status === "Pending OPEN Review" ? "Pending review" : describeOverallCandidateScore(assessmentScore, cvScore);
  if (assessmentScore === null || cvScore === null) return <span className="text-[13px] text-muted-foreground">{label}</span>;
  return <span className="text-[13px] font-semibold text-primary">{label}</span>;
}
function BandValue({ band }: { band: ScreeningBand | null }) {
  if (!band) return <span className="text-[13px] text-muted-foreground">Pending</span>;
  return <span className="text-[13px] font-semibold text-primary">{band}</span>;
}
function IntegrityValue({ shortlisted }: { shortlisted: boolean }) {
  return shortlisted ? <span className="text-[13px] font-semibold text-status-success-strong">Shortlisted</span> : <span className="text-[13px] text-muted-foreground">—</span>;
}

export default function AdminScreening() {
  const [, setLocation] = useLocation();
  const [applications, setApplications] = useState<AdminApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [applicationStatus, setApplicationStatus] = useState("all");
  const [band, setBand] = useState<FilterValue>("all");
  const [shortlistOnly, setShortlistOnly] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortOption>("final-score-desc");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const load = () => {
    setLoading(true);
    fetchAdminApplications()
      .then((d) => { setApplications(d.applications); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load applications."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const roleOptions = useMemo(() => screeningRoleOptions(applications), [applications]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = applications.filter((app) =>
      (!term || app.fullName.toLowerCase().includes(term) || app.email.toLowerCase().includes(term)) &&
      (roleFilter === "all" || screeningRoleKey(app) === roleFilter) &&
      (applicationStatus === "all" || app.applicationStatus === applicationStatus) &&
      (band === "all" || (band === "Pending" ? !app.appliedBand : app.appliedBand === band)) &&
      (shortlistOnly === "all" || shortlistOnly === "shortlisted" && app.shortlisted || shortlistOnly === "not-shortlisted" && !app.shortlisted)
    );
    return [...filtered].sort((a, b) => {
      if (sort === "candidate") return a.fullName.localeCompare(b.fullName);
      if (sort === "final-score-desc" || sort === "final-score-asc") {
        const descending = sort === "final-score-desc";
        const av = a.finalScore ?? (descending ? -1 : 999);
        const bv = b.finalScore ?? (descending ? -1 : 999);
        if (av !== bv) return descending ? bv - av : av - bv;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "overall-desc" || sort === "overall-asc") {
        const descending = sort === "overall-desc";
        const av = calculateOverallCandidateScore(a.finalScore, a.cvScore) ?? (descending ? -1 : 999);
        const bv = calculateOverallCandidateScore(b.finalScore, b.cvScore) ?? (descending ? -1 : 999);
        if (av !== bv) return descending ? bv - av : av - bv;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "cv-desc" || sort === "cv-asc") {
        const descending = sort === "cv-desc";
        const av = a.cvScore ?? (descending ? -1 : 999);
        const bv = b.cvScore ?? (descending ? -1 : 999);
        if (av !== bv) return descending ? bv - av : av - bv;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "application-asc" ? comparison : -comparison;
    });
  }, [applications, applicationStatus, band, search, shortlistOnly, sort, roleFilter]);

  const hasFilters = Boolean(search.trim()) || roleFilter !== "all" || applicationStatus !== "all" || band !== "all" || shortlistOnly !== "all" || sort !== "final-score-desc";
  const clearFilters = () => { setSearch(""); setRoleFilter("all"); setApplicationStatus("all"); setBand("all"); setShortlistOnly("all"); setSort("final-score-desc"); };
  const shortlistedCount = applications.filter((a) => a.shortlisted).length;

  const confirmAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === "shortlist") await updateShortlist(pendingAction.app.id, { shortlisted: true });
      else if (pendingAction.type === "hold") await updateApplicationStatus(pendingAction.app.id, { status: "Hold" });
      else if (pendingAction.type === "close") await updateApplicationStatus(pendingAction.app.id, { status: "Closed" });
      toast_success(pendingAction.type);
      load();
    } catch (err) {
      toast_error(err);
    }
    setPendingAction(null);
  };

  const modalCopy = pendingAction?.type === "shortlist"
    ? { title: "Add candidate to shortlist?", description: `${pendingAction.app.fullName} will be marked for further recruitment review.`, action: "Add to shortlist" }
    : pendingAction?.type === "hold"
    ? { title: "Put candidate on Hold?", description: `${pendingAction.app.fullName} will be placed on Hold.`, action: "Put on Hold" }
    : { title: "Close candidate?", description: `${pendingAction?.app.fullName} will be closed.`, action: "Close application" };

  if (loading) return <AdminShell title="Screening"><section className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading candidates…</p></section></AdminShell>;
  if (error) return <AdminShell title="Screening"><section className="py-12 text-center"><p className="text-sm text-status-error-strong">{error}</p><button className="mt-4 text-[13px] font-medium text-portal-blue hover:underline" onClick={load} type="button">Retry</button></section></AdminShell>;

  return <AdminShell title="Screening">
    <section><p className="text-[12px] font-medium text-muted-foreground">Candidate review</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Candidate Screening</h2><p className="mt-2 max-w-3xl text-[15px] leading-6 text-muted-foreground">Review real candidates sorted by Assessment, CV or Overall Score. Shortlist, hold or close manually. All actions persist in TiDB.</p></section>

    <section aria-label="Screening summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Applications</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{applications.length}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Total candidates</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Scored</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{applications.filter((a) => a.finalScore !== null).length}</p><p className="mt-1.5 text-[12px] text-muted-foreground">With Final Score</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Shortlisted</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{shortlistedCount}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Manual Admin selection</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Pending Review</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{applications.filter((a) => a.evaluationStatus === "Pending OPEN Review" || a.evaluationStatus === "Pending Assessment").length}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Awaiting scoring</p></article>
    </section>

    <section className="mt-6 rounded-xl border border-border bg-white p-4 shadow-none sm:p-5 lg:p-6">
      <div className="flex flex-col gap-5 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[550px]">
          <div className="sm:col-span-2"><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="screening-role">Role applied for</label><FoundationSelect id="screening-role" onChange={(e) => setRoleFilter(e.target.value)} value={roleFilter}><option value="all">All roles</option>{roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</FoundationSelect></div>
          <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="screening-sort">Sort by</label><FoundationSelect id="screening-sort" onChange={(e) => setSort(e.target.value as SortOption)} value={sort}><option value="overall-desc">Overall Score — highest first</option><option value="overall-asc">Overall Score — lowest first</option><option value="final-score-desc">Assessment Score — highest first</option><option value="final-score-asc">Assessment Score — lowest first</option><option value="cv-desc">CV Score — highest first</option><option value="cv-asc">CV Score — lowest first</option><option value="application-desc">Application date — newest first</option><option value="application-asc">Application date — oldest first</option><option value="candidate">Candidate name</option></FoundationSelect></div>
          <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="screening-status">Status</label><FoundationSelect id="screening-status" onChange={(e) => setApplicationStatus(e.target.value)} value={applicationStatus}><option value="all">All statuses</option>{statusOptions.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s}</option>)}</FoundationSelect></div>
        </div>
        <div className="rounded-lg border border-border bg-portal-surface px-4 py-3"><p className="text-[12px] font-medium text-muted-foreground">Current shortlist</p><div className="mt-1 flex items-center gap-4"><p className="text-sm font-semibold text-primary">{shortlistedCount} {shortlistedCount === 1 ? "candidate" : "candidates"}</p>{shortlistedCount > 0 && <button className="text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={() => setShortlistOnly("shortlisted")} type="button">View shortlisted only</button>}</div></div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(145px,1fr))]">
        <div className="relative"><label className="sr-only" htmlFor="screening-search">Search candidates</label><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><FoundationInput className="pl-10" id="screening-search" onChange={(e) => setSearch(e.target.value)} placeholder="Search candidates" value={search} /></div>
        <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="band-filter">Applied Band</label><FoundationSelect id="band-filter" onChange={(e) => setBand(e.target.value)} value={band}>{bandOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</FoundationSelect></div>
        <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="shortlist-filter">Shortlist</label><FoundationSelect id="shortlist-filter" onChange={(e) => setShortlistOnly(e.target.value)} value={shortlistOnly}><option value="all">All</option><option value="shortlisted">Shortlisted</option><option value="not-shortlisted">Not shortlisted</option></FoundationSelect></div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-[13px] text-muted-foreground">{filteredRecords.length} {filteredRecords.length === 1 ? "candidate" : "candidates"}</p>{hasFilters ? <button className="text-[13px] font-medium text-portal-blue hover:underline" onClick={clearFilters} type="button">Clear filters</button> : null}</div>

      {filteredRecords.length ? <>
        <div className="mt-3 hidden overflow-x-auto md:block"><table className="w-full min-w-[1350px] text-left"><thead className="border-b border-border"><tr>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Candidate</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role applied for</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligibility</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Assessment Score</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">CV Score</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Overall Score</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Applied Band</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Integrity</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
          <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Shortlist</th>
        </tr></thead><tbody className="divide-y divide-border">{filteredRecords.map((app) => <tr key={app.id} className="cursor-pointer transition-colors hover:bg-portal-surface" onClick={() => setLocation(`/admin/applications/${app.id}`)}>
          <td className="px-3 py-4"><div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-portal-surface text-[11px] font-semibold text-primary">{initials(app.fullName)}</span><div><p className="text-sm font-medium text-primary">{app.fullName}</p><p className="mt-1 text-[12px] text-muted-foreground">{app.email}</p></div></div></td>
          <td className="min-w-[180px] px-3 py-4 text-[13px] text-primary">{app.roleTitle}</td>
          <td className="px-3 py-4"><EligibilityValue value={app.eligibilityStatus} /></td>
          <td className="px-3 py-4"><ScoreValue score={app.finalScore} status={app.evaluationStatus} /></td>
          <td className="px-3 py-4"><CvScoreValue cvScore={app.cvScore} cvUploaded={app.cvUploaded} /></td>
          <td className="px-3 py-4"><OverallScoreValue assessmentScore={app.finalScore} cvScore={app.cvScore} status={app.evaluationStatus} /></td>
          <td className="px-3 py-4"><BandValue band={app.appliedBand} /></td>
          <td className="px-3 py-4"><IntegrityValue shortlisted={app.shortlisted} /></td>
          <td className="px-3 py-4"><StatusBadge status={applicationStatusDisplayLabel(app.applicationStatus)} /></td>
          <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>{app.shortlisted ? <StatusBadge status="Shortlisted" /> : <FoundationButton onClick={() => setPendingAction({ type: "shortlist", app })} size="sm" variant="secondary">Shortlist</FoundationButton>}</td>
        </tr>)}</tbody></table></div>

        <div className="mt-3 divide-y divide-border md:hidden">{filteredRecords.map((app) => <article className="cursor-pointer py-4 transition-colors hover:bg-portal-surface" key={app.id} onClick={() => setLocation(`/admin/applications/${app.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/admin/applications/${app.id}`); }}>
          <div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-portal-surface text-[11px] font-semibold text-primary">{initials(app.fullName)}</span><div><p className="text-sm font-medium text-primary">{app.fullName}</p><p className="mt-1 text-[12px] text-muted-foreground">{app.email}</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role applied for</p><p className="mt-1 text-[13px] text-primary">{app.roleTitle}</p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligibility</p><p className="mt-1"><EligibilityValue value={app.eligibilityStatus} /></p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Assessment Score</p><p className="mt-1"><ScoreValue score={app.finalScore} status={app.evaluationStatus} /></p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">CV Score</p><p className="mt-1"><CvScoreValue cvScore={app.cvScore} cvUploaded={app.cvUploaded} /></p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Overall Score</p><p className="mt-1"><OverallScoreValue assessmentScore={app.finalScore} cvScore={app.cvScore} status={app.evaluationStatus} /></p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Applied Band</p><p className="mt-1"><BandValue band={app.appliedBand} /></p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</p><div className="mt-1.5"><StatusBadge status={applicationStatusDisplayLabel(app.applicationStatus)} /></div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {!app.shortlisted && <FoundationButton onClick={() => setPendingAction({ type: "shortlist", app })} size="sm" variant="secondary">Shortlist</FoundationButton>}
            <button className="text-[13px] font-medium text-portal-blue hover:underline" onClick={() => setPendingAction({ type: "hold", app })} type="button">Hold</button>
          </div>
        </article>)}</div>
      </> : <div className="py-14 text-center"><h3 className="text-base font-semibold text-primary">No candidates found</h3><p className="mt-2 text-sm text-muted-foreground">Try changing your search or filters.</p>{hasFilters ? <button className="mt-4 text-[13px] font-medium text-portal-blue hover:underline" onClick={clearFilters} type="button">Clear filters</button> : null}</div>}
    </section>

    <Dialog onOpenChange={(open) => { if (!open) setPendingAction(null); }} open={Boolean(pendingAction)}>
      <DialogContent><DialogHeader><DialogTitle>{modalCopy.title}</DialogTitle><DialogDescription>{modalCopy.description}</DialogDescription></DialogHeader><DialogFooter><FoundationButton onClick={() => setPendingAction(null)} variant="secondary">Cancel</FoundationButton><FoundationButton onClick={confirmAction}>{modalCopy.action}</FoundationButton></DialogFooter></DialogContent>
    </Dialog>
  </AdminShell>;
}

function toast_success(type: string) {
  if (type === "shortlist") toast.success("Candidate added to shortlist.");
  else if (type === "hold") toast.success("Candidate placed on Hold.");
  else toast.success("Application closed.");
}
function toast_error(err: unknown) {
  toast.error(err instanceof Error ? err.message : "Action failed.");
}
