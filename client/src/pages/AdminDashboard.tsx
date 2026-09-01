/**
 * Task 24D-2 — Admin Dashboard with real TiDB counts.
 *
 * Dashboard application counts now come from the real applications API
 * instead of mock data.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/foundation/ui";
import { fetchAdminApplications, type AdminApplicationSummary } from "@/lib/adminApplicationApi";
import { applicationStatusDisplayLabel } from "@/lib/adminDisplay";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [applications, setApplications] = useState<AdminApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAdminApplications()
      .then((d) => { if (!cancelled) setApplications(d.applications); })
      .catch(() => { /* graceful degradation — show empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalApplications = applications.length;
  const submitted = applications.filter((a) => a.applicationStatus !== "In Progress" && a.applicationStatus !== "Eligibility Closed").length;
  const pendingReview = applications.filter((a) => a.evaluationStatus === "Pending OPEN Review" || a.evaluationStatus === "Pending Assessment").length;
  const shortlisted = applications.filter((a) => a.shortlisted).length;
  const recentApplications = [...applications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const metrics = [
    { label: "Total Applications", value: String(totalApplications), detail: "All applications" },
    { label: "Submitted", value: String(submitted), detail: "Ready for review" },
    { label: "Pending Review", value: String(pendingReview), detail: "Awaiting scoring" },
    { label: "Shortlisted", value: String(shortlisted), detail: shortlisted ? "Manual shortlist selections" : "Shortlisting not started" },
  ];

  return <AdminShell title="Dashboard">
    <section><p className="text-[12px] font-medium text-muted-foreground">Recruitment overview</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Dashboard</h2><p className="mt-2 text-[15px] leading-6 text-muted-foreground">A summary of current recruitment activity and real applications.</p></section>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => <article className="rounded-xl border border-border bg-white p-5 shadow-none" key={m.label}><p className="text-[13px] font-medium text-muted-foreground">{m.label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-primary">{loading ? "—" : m.value}</p><p className="mt-2 text-[12px] leading-5 text-muted-foreground">{m.detail}</p></article>)}
    </section>

    <section className="mt-7">
      <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div><h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Recent applications</h3><p className="mt-1 text-[13px] text-muted-foreground">Latest real applications from TiDB.</p></div>
          <button className="shrink-0 text-[13px] font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => setLocation("/admin/applications")} type="button">View all applications</button>
        </div>
        {recentApplications.length > 0 ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Final Score</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Date</th></tr></thead><tbody className="divide-y divide-border">{recentApplications.map((app) => <tr key={app.id}><td className="px-3 py-4 text-sm font-medium text-primary">{app.fullName}</td><td className="px-3 py-4 text-[13px] text-muted-foreground">{app.roleTitle}</td><td className="px-3 py-4 text-[13px] text-muted-foreground">{app.finalScore !== null ? app.finalScore.toFixed(1) : "Pending"}</td><td className="px-3 py-4"><StatusBadge status={applicationStatusDisplayLabel(app.applicationStatus)} /></td><td className="whitespace-nowrap px-3 py-4 text-[13px] text-muted-foreground">{new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td></tr>)}</tbody></table></div> : <p className="mt-6 py-8 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "No applications yet."}</p>}
      </article>
    </section>
  </AdminShell>;
}
