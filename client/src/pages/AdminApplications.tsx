/**
 * Task 24D-2 — Admin Applications workspace.
 *
 * Real TiDB application data replaces mock candidates. Columns show
 * eligibility, assessment status, Final Score, Applied Band, evaluation
 * status, and application status from the database.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationInput, FoundationSelect, StatusBadge } from "@/components/foundation/ui";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { fetchAdminApplications, type AdminApplicationSummary, type EvaluationStatus, type ScreeningBand } from "@/lib/adminApplicationApi";
import { Search, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type SortKey = "candidateName" | "finalScore" | "appliedBand" | "applicationStatus" | "appliedDate";
type SortDirection = "asc" | "desc";
const PAGE_SIZE = 10;

function SortControl({ column, label, sortKey, direction, onSort }: { column: SortKey; label: string; sortKey: SortKey; direction: SortDirection; onSort: (column: SortKey) => void }) {
  const Icon = sortKey !== column ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-primary" onClick={() => onSort(column)} type="button">{label}<Icon className="size-3" /></button>;
}

function CandidateCell({ app }: { app: AdminApplicationSummary }) {
  return <div><p className="font-medium text-primary">{app.fullName}</p><p className="mt-1 text-[12px] text-muted-foreground">{app.email}</p></div>;
}

function EligibilityCell({ status }: { status: string }) {
  const label = status === "Eligible" ? "Eligible" : status === "Closed" ? "Closed" : "Pending";
  return <span className={`text-[13px] font-semibold ${label === "Eligible" ? "text-status-success-strong" : label === "Closed" ? "text-status-error-strong" : "text-[#765d22]"}`}>{label}</span>;
}

function AssessmentStatusCell({ status }: { status: string }) {
  return <span className="text-[13px] text-muted-foreground">{status}</span>;
}

function ScoreCell({ score, evaluationStatus }: { score: number | null; evaluationStatus: EvaluationStatus | null }) {
  if (evaluationStatus === "Pending Assessment" || evaluationStatus === "Pending OPEN Review") return <span className="text-[13px] text-muted-foreground">Pending review</span>;
  if (score === null) return <span className="text-[13px] text-muted-foreground">—</span>;
  return <span className="text-[13px] font-semibold text-primary">{score.toFixed(1)}</span>;
}

function BandCell({ band }: { band: ScreeningBand | null }) {
  if (!band) return <span className="text-[13px] text-muted-foreground">—</span>;
  return <span className="text-[13px] font-semibold text-primary">{band}</span>;
}

function sortValue(app: AdminApplicationSummary, key: SortKey): string | number | null {
  if (key === "candidateName") return app.fullName;
  if (key === "applicationStatus") return app.applicationStatus;
  if (key === "appliedDate") return app.createdAt;
  if (key === "finalScore") return app.finalScore;
  if (key === "appliedBand") return app.appliedBand ?? "Z";
  return null;
}

export default function AdminApplications() {
  const [, setLocation] = useLocation();
  const [applications, setApplications] = useState<AdminApplicationSummary[]>([]);
  const [counts, setCounts] = useState({ total: 0, submitted: 0, pendingReview: 0, shortlisted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("all");
  const [eligibility, setEligibility] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminApplications()
      .then((data) => { if (!cancelled) { setApplications(data.applications); setCounts(data.counts); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load applications."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const hasActiveFilters = Boolean(normalizedSearch) || applicationStatus !== "all" || eligibility !== "all";

  const filteredApplications = useMemo(() => {
    const records = applications.filter((app) => {
      const eligibilityMatch = eligibility === "all" || eligibility === "eligible" && app.eligibilityStatus === "Eligible" || eligibility === "pending" && app.eligibilityStatus === "Pending" || eligibility === "closed" && app.eligibilityStatus === "Closed";
      return (!normalizedSearch || app.fullName.toLowerCase().includes(normalizedSearch) || app.email.toLowerCase().includes(normalizedSearch)) && (applicationStatus === "all" || app.applicationStatus === applicationStatus) && eligibilityMatch;
    });
    return [...records].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDirection === "asc" ? av - bv : bv - av;
      return sortDirection === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [applications, applicationStatus, eligibility, normalizedSearch, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleApplications = filteredApplications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sort = (column: SortKey) => { if (column === sortKey) setSortDirection((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(column); setSortDirection(column === "appliedDate" ? "desc" : "asc"); } };
  const resetFilters = () => { setSearch(""); setApplicationStatus("all"); setEligibility("all"); setPage(1); };

  if (loading) return <AdminShell title="Applications"><section className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading applications…</p></section></AdminShell>;
  if (error) return <AdminShell title="Applications"><section className="py-12 text-center"><p className="text-sm text-status-error-strong">{error}</p><button className="mt-4 text-[13px] font-medium text-portal-blue hover:underline" onClick={() => window.location.reload()} type="button">Retry</button></section></AdminShell>;

  return <AdminShell title="Applications">
    <section><p className="text-[12px] font-medium text-muted-foreground">Recruitment management</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Applications</h2><p className="mt-2 max-w-3xl text-[15px] leading-6 text-muted-foreground">Review real candidate applications, eligibility, v2 evaluation scores, and application status.</p></section>

    <section aria-label="Application summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Total Applications</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{counts.total}</p><p className="mt-1.5 text-[12px] text-muted-foreground">All applications</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Submitted</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{counts.submitted}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Ready for review</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Pending Review</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{counts.pendingReview}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Awaiting scoring</p></article>
      <article className="rounded-xl border border-border bg-white p-4"><p className="text-[12px] font-medium text-muted-foreground">Shortlisted</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">{counts.shortlisted}</p><p className="mt-1.5 text-[12px] text-muted-foreground">Manual Admin selection</p></article>
    </section>

    <section className="mt-6 rounded-xl border border-border bg-white p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <label className="sr-only" htmlFor="application-search">Search by candidate name or email</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <FoundationInput className="pl-10" id="application-search" onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by candidate name or email" value={search} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
          <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="application-status-filter">Application status</label><FoundationSelect id="application-status-filter" onChange={(e) => { setApplicationStatus(e.target.value); setPage(1); }} value={applicationStatus}><option value="all">All statuses</option><option value="In Progress">In Progress</option><option value="Submitted">Submitted</option><option value="Shortlisted">Shortlisted</option><option value="Hold">Hold</option><option value="Closed">Closed</option></FoundationSelect></div>
          <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="eligibility-filter">Eligibility</label><FoundationSelect id="eligibility-filter" onChange={(e) => { setEligibility(e.target.value); setPage(1); }} value={eligibility}><option value="all">All eligibility states</option><option value="eligible">Eligible</option><option value="pending">Pending</option><option value="closed">Closed</option></FoundationSelect></div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-[13px] text-muted-foreground">{filteredApplications.length} {filteredApplications.length === 1 ? "application" : "applications"}</p>
        {hasActiveFilters ? <button className="text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={resetFilters} type="button">Clear filters</button> : null}
      </div>

      {visibleApplications.length ? <>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1180px] text-left">
            <thead className="border-b border-border"><tr>
              <th className="px-3 py-3"><SortControl column="candidateName" direction={sortDirection} label="Candidate" onSort={sort} sortKey={sortKey} /></th>
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role</th>
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligibility</th>
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Assessment</th>
              <th className="px-3 py-3"><SortControl column="finalScore" direction={sortDirection} label="Final Score" onSort={sort} sortKey={sortKey} /></th>
              <th className="px-3 py-3"><SortControl column="appliedBand" direction={sortDirection} label="Applied Band" onSort={sort} sortKey={sortKey} /></th>
              <th className="px-3 py-3"><SortControl column="applicationStatus" direction={sortDirection} label="Status" onSort={sort} sortKey={sortKey} /></th>
              <th className="px-3 py-3"><SortControl column="appliedDate" direction={sortDirection} label="Applied" onSort={sort} sortKey={sortKey} /></th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {visibleApplications.map((app) => <tr key={app.id}>
                <td className="px-3 py-4 text-sm"><CandidateCell app={app} /></td>
                <td className="max-w-[170px] px-3 py-4 text-[13px] leading-5 text-muted-foreground">{app.roleTitle}</td>
                <td className="px-3 py-4"><EligibilityCell status={app.eligibilityStatus} /></td>
                <td className="px-3 py-4"><AssessmentStatusCell status={app.assessmentStatus} /></td>
                <td className="px-3 py-4"><ScoreCell evaluationStatus={app.evaluationStatus} score={app.finalScore} /></td>
                <td className="px-3 py-4"><BandCell band={app.appliedBand} /></td>
                <td className="px-3 py-4"><StatusBadge status={app.applicationStatus} /></td>
                <td className="whitespace-nowrap px-3 py-4 text-[13px] text-muted-foreground">{new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-3 py-4 text-right"><button className="text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={() => setLocation(`/admin/applications/${app.id}`)} type="button">View</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-3 divide-y divide-border md:hidden">
          {visibleApplications.map((app) => <article className="py-4" key={app.id}>
            <CandidateCell app={app} />
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Role</p><p className="mt-1 text-[13px] text-primary">{app.roleTitle}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligibility</p><p className="mt-1"><EligibilityCell status={app.eligibilityStatus} /></p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Final Score</p><p className="mt-1"><ScoreCell evaluationStatus={app.evaluationStatus} score={app.finalScore} /></p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Applied Band</p><p className="mt-1"><BandCell band={app.appliedBand} /></p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</p><div className="mt-1.5"><StatusBadge status={app.applicationStatus} /></div></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Applied</p><p className="mt-1 text-[13px] text-primary">{new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div>
            </div>
            <button className="mt-4 text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={() => setLocation(`/admin/applications/${app.id}`)} type="button">View application</button>
          </article>)}
        </div>
        <Pagination className="mt-6 justify-end border-t border-border pt-4">
          <PaginationContent>
            <PaginationItem><PaginationPrevious aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-45" : undefined} href="#applications" onClick={(e) => { e.preventDefault(); if (currentPage > 1) setPage(currentPage - 1); }} /></PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <PaginationItem key={n}><PaginationLink href="#applications" isActive={n === currentPage} onClick={(e) => { e.preventDefault(); setPage(n); }}>{n}</PaginationLink></PaginationItem>)}
            <PaginationItem><PaginationNext aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-45" : undefined} href="#applications" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setPage(currentPage + 1); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </> : <div className="py-14 text-center"><h3 className="text-base font-semibold text-primary">No applications found</h3><p className="mt-2 text-sm text-muted-foreground">Try changing your search or filters.</p>{hasActiveFilters ? <button className="mt-4 text-[13px] font-medium text-portal-blue hover:underline" onClick={resetFilters} type="button">Clear filters</button> : null}</div>}
    </section>
  </AdminShell>;
}
