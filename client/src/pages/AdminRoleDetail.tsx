/**
 * Quiet Authority Recruitment Role detail — Task 24F: every Overview value
 * (application counts, linked assessment, evaluation framework, eligibility
 * summary) is derived from live TiDB records; no hard-coded configuration
 * state remains.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { RichDescription } from "@/components/foundation/RichDescription";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminApplicationsLive, useAdminAssessments, useAdminEligibility, useAdminRole, useEvaluationFramework } from "@/hooks/useRecruitmentData";
import { applicationStatusDisplayLabel } from "@/lib/adminDisplay";
import { deriveEligibilityGateSummary, describeEligibilityGateSummary, formatRoleDateLabel, formatRoleUpdatedLabel, type AdminRecruitmentRole, type EligibilityGateSummary } from "@/lib/recruitmentApi";
import { deriveRoleApplicationCounts, describeLinkedAssessment, describeFrameworkState, findLinkedAssessment } from "@/lib/roleConfigurationDisplay";
import type { AdminApplicationSummary } from "@/lib/adminApplicationApi";
import { RoleEligibilityTab } from "@/components/admin/RoleEligibilityTab";
import { V2EvaluationFrameworkTab } from "@/components/admin/V2EvaluationFrameworkTab";
import { AssessmentBuilderGuidance } from "@/components/admin/AssessmentBuilderPrompt";
import { downloadCsvTemplate, fetchCsvTemplate } from "@/lib/csvImportApi";
import { ArrowLeft, Download, Pencil, Upload } from "lucide-react";
import { useState } from "react";
import { useLocation, useRoute } from "wouter";

interface OverviewLiveState {
  applications: AdminApplicationSummary[];
  applicationsLoading: boolean;
  linkedAssessment: ReturnType<typeof findLinkedAssessment>;
  assessmentsLoading: boolean;
  frameworkLabel: string;
  frameworkActive: boolean;
  frameworkLoading: boolean;
}

function OverviewTab({ role, gateSummary, live }: { role: AdminRecruitmentRole; gateSummary: EligibilityGateSummary | null; live: OverviewLiveState }) {
  const counts = deriveRoleApplicationCounts(live.applications, role.title);
  const assessmentValue = live.assessmentsLoading ? "Loading…" : live.linkedAssessment ? describeLinkedAssessment(live.linkedAssessment) : "Not yet assigned";
  const frameworkValue = live.frameworkLoading ? "Loading…" : live.frameworkLabel;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,68fr)_minmax(260px,32fr)]"><article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6"><h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Role information</h3><section className="mt-6"><h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Short description</h4><p className="mt-3 max-w-3xl text-sm leading-6 text-primary">{role.shortDescription}</p></section><dl className="mt-6 grid gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-2"><div><dt className="text-[12px] text-muted-foreground">Department</dt><dd className="mt-1 text-sm font-medium text-primary">{role.department}</dd></div><div><dt className="text-[12px] text-muted-foreground">Location</dt><dd className="mt-1 text-sm font-medium text-primary">{role.location}</dd></div><div><dt className="text-[12px] text-muted-foreground">Employment type</dt><dd className="mt-1 text-sm font-medium text-primary">{role.employmentType}</dd></div><div><dt className="text-[12px] text-muted-foreground">Application opening date</dt><dd className="mt-1 text-sm font-medium text-primary">{formatRoleDateLabel(role.openingDate)}</dd></div><div><dt className="text-[12px] text-muted-foreground">Application closing date</dt><dd className="mt-1 text-sm font-medium text-primary">{formatRoleDateLabel(role.closingDate)}</dd></div><div><dt className="text-[12px] text-muted-foreground">Last updated</dt><dd className="mt-1 text-sm font-medium text-primary">{formatRoleUpdatedLabel(role.updatedAt)}</dd></div></dl>{role.fullDescription ? <section className="mt-6 border-t border-border pt-6"><h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Role description</h4><RichDescription className="mt-3 max-w-3xl text-sm leading-6 text-primary" source={role.fullDescription} /></section> : null}</article><article className="h-fit rounded-xl border border-border bg-white p-5 shadow-none"><h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Role summary</h3><dl className="mt-5 space-y-4"><div><dt className="text-[12px] text-muted-foreground">Status</dt><dd className="mt-1.5"><StatusBadge status={role.status} /></dd></div><div><dt className="text-[12px] text-muted-foreground">Applications</dt><dd className="mt-1 text-sm font-medium text-primary">{live.applicationsLoading ? "Loading…" : counts.total}</dd></div><div><dt className="text-[12px] text-muted-foreground">Submitted</dt><dd className="mt-1 text-sm font-medium text-primary">{live.applicationsLoading ? "Loading…" : counts.submitted}</dd></div><div><dt className="text-[12px] text-muted-foreground">In Progress</dt><dd className="mt-1 text-sm font-medium text-primary">{live.applicationsLoading ? "Loading…" : counts.inProgress}</dd></div><div><dt className="text-[12px] text-muted-foreground">Assessment</dt><dd className="mt-1 text-sm font-medium text-primary">{assessmentValue}</dd></div><div><dt className="text-[12px] text-muted-foreground">Evaluation Framework</dt><dd className={`mt-1 text-sm font-medium ${live.frameworkActive ? "text-status-success-strong" : "text-primary"}`}>{frameworkValue}</dd></div><div><dt className="text-[12px] text-muted-foreground">Eligibility</dt><dd className={`mt-1 text-sm font-medium ${gateSummary && gateSummary.configurationRequiredCount ? "text-[#765d22]" : "text-primary"}`}>{gateSummary ? describeEligibilityGateSummary(gateSummary) : "Loading…"}</dd></div></dl></article></div>;
}

function ApplicationsTab({ roleTitle, live, onViewAll, onViewCandidate }: { roleTitle: string; live: Pick<OverviewLiveState, "applications" | "applicationsLoading">; onViewAll: () => void; onViewCandidate: (id: string) => void }) {
  const applications = live.applications.filter((application) => application.roleTitle === roleTitle);
  if (live.applicationsLoading) return <section><DataLoadingState label="Loading applications" /></section>;
  return <section><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Applications</h3><p className="mt-1 text-sm text-muted-foreground">Applications received for this recruitment role.</p></div>{applications.length ? <button className="text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={onViewAll} type="button">View all applications</button> : null}</div>{applications.length ? <article className="mt-5 rounded-xl border border-border bg-white p-4 shadow-none sm:p-5"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left"><thead className="border-b border-border"><tr>{["Candidate", "Status", "Assessment", "Applied", "View"].map((heading) => <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground last:text-right" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-border">{applications.map((application) => <tr key={application.id}><td className="px-3 py-4"><p className="text-sm font-medium text-primary">{application.fullName}</p><p className="mt-1 text-[12px] text-muted-foreground">{application.email}</p></td><td className="px-3 py-4"><StatusBadge status={applicationStatusDisplayLabel(application.applicationStatus)} /></td><td className="px-3 py-4"><StatusBadge status={application.assessmentStatus === "Complete" ? "Completed" : application.assessmentStatus} /></td><td className="whitespace-nowrap px-3 py-4 text-[13px] text-muted-foreground">{new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td><td className="px-3 py-4 text-right"><button className="text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={() => onViewCandidate(application.id)} type="button">View</button></td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{applications.map((application) => <article className="py-4" key={application.id}><p className="text-sm font-medium text-primary">{application.fullName}</p><p className="mt-1 text-[12px] text-muted-foreground">{application.email}</p><div className="mt-4 flex flex-wrap items-center gap-3"><StatusBadge status={applicationStatusDisplayLabel(application.applicationStatus)} /><StatusBadge status={application.assessmentStatus === "Complete" ? "Completed" : application.assessmentStatus} /><span className="text-[13px] text-muted-foreground">{new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div><button className="mt-4 text-[13px] font-medium text-portal-blue hover:underline" onClick={() => onViewCandidate(application.id)} type="button">View application</button></article>)}</div></article> : <article className="mt-5 rounded-xl border border-border bg-white p-6"><h4 className="text-base font-semibold text-primary">No applications received</h4><p className="mt-2 text-sm text-muted-foreground">Applications will appear here when candidates apply for this role.</p></article>}</section>;
}

/**
 * CSV import entry point (task #22): a Download CSV Template action and an
 * Import Questions from CSV action, available whether or not the role already
 * has a linked assessment. Import creates the assessment when one is missing
 * (task #21), so both states expose the same controls.
 */
function CsvImportActions({ roleSlug, onImportCsv }: { roleSlug: string; onImportCsv: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const payload = await fetchCsvTemplate(roleSlug);
      downloadCsvTemplate(payload.filename, payload.template);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the CSV template.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <section className="mt-5 border-t border-border pt-5">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Import questions from CSV</h4>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">
        Download the template, configure up to 100 questions, then upload it here. Every row is validated and
        previewed before anything is saved, and imported questions are scored by the same engine as the Question Bank.
        If you include <span className="font-medium text-primary">dimension_name</span>, <span className="font-medium text-primary">dimension_weight</span> and <span className="font-medium text-primary">dimension_floor</span> in your CSV, the importer can generate the Evaluation Framework automatically when one is missing.
      </p>
      <div className="mt-4">
        <FoundationButton disabled={downloading} onClick={handleDownload} variant="secondary">
          <Download className="size-4" />{downloading ? "Preparing…" : "Download CSV Template"}
        </FoundationButton>
      </div>
      {error ? <p className="mt-3 text-[13px] font-medium text-status-error-strong">{error}</p> : null}
      <div className="mt-4">
        <AssessmentBuilderGuidance />
      </div>
      <div className="mt-4">
        <FoundationButton onClick={onImportCsv} variant="secondary">
          <Upload className="size-4" />Import Questions from CSV
        </FoundationButton>
      </div>
    </section>
  );
}

function AssessmentTab({ role, live, onManageAssessments, onImportCsv }: { role: AdminRecruitmentRole; live: Pick<OverviewLiveState, "linkedAssessment" | "assessmentsLoading">; onManageAssessments: () => void; onImportCsv: () => void }) {
  if (live.assessmentsLoading) return <article className="rounded-xl border border-border bg-white p-6"><DataLoadingState label="Loading assessment configuration" /></article>;
  if (!live.linkedAssessment) return <article className="rounded-xl border border-border bg-white p-6"><h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Assessment</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">No assessment is assigned to this recruitment role yet. Import questions from a CSV to create one, or manage assessments manually.</p><CsvImportActions onImportCsv={onImportCsv} roleSlug={role.slug} /><div className="mt-5"><FoundationButton onClick={onManageAssessments} variant="secondary">Manage assessments</FoundationButton></div></article>;
  const assessment = live.linkedAssessment;
  return <article className="rounded-xl border border-border bg-white p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Assessment</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">The assessment linked to {role.title}. Applicants who pass eligibility complete this assessment as part of their application.</p></div><StatusBadge status={assessment.status} /></div><dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-3"><div><dt className="text-[12px] text-muted-foreground">Assessment</dt><dd className="mt-1 text-sm font-medium text-primary">{assessment.name}</dd></div><div><dt className="text-[12px] text-muted-foreground">Version</dt><dd className="mt-1 text-sm font-medium text-primary">Version {assessment.version}</dd></div><div><dt className="text-[12px] text-muted-foreground">Questions</dt><dd className="mt-1 text-sm font-medium text-primary">{assessment.questionCount} questions</dd></div></dl><div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-5"><FoundationButton onClick={() => onManageAssessments()} variant="secondary">Manage assessments</FoundationButton><p className="text-[13px] text-muted-foreground">{assessment.status === "Active" ? "Live for applicants." : "Not currently live for applicants."}</p></div><CsvImportActions onImportCsv={onImportCsv} roleSlug={role.slug} /></article>;
}

export default function AdminRoleDetail() {
  const [, params] = useRoute("/admin/roles/:roleSlug");
  const [location, setLocation] = useLocation();
  const slug = params?.roleSlug ?? "";
  const roleState = useAdminRole(slug);
  const eligibilityState = useAdminEligibility(slug);
  const applicationsState = useAdminApplicationsLive();
  const assessmentsState = useAdminAssessments();
  const frameworkState = useEvaluationFramework(slug);
  if (roleState.status === "loading") return <AdminShell title="Recruitment Roles"><div className="mt-6"><DataLoadingState label="Loading recruitment role" /></div></AdminShell>;
  if (roleState.status === "error" || !roleState.data) return <AdminShell title="Recruitment Roles"><section className="py-8"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">{roleState.status === "error" ? "Role unavailable" : "Role not found"}</h2><p className="mt-2 text-sm text-muted-foreground">{roleState.error ?? "The requested recruitment role could not be found."}</p>{roleState.status === "error" ? <div className="mt-6"><DataErrorState message={roleState.error ?? "Unable to load the recruitment role."} onRetry={roleState.reload} /></div> : <FoundationButton className="mt-6" onClick={() => setLocation("/admin/roles")} variant="secondary">Back to recruitment roles</FoundationButton>}</section></AdminShell>;
  const role = roleState.data;
  const gateSummary = eligibilityState.status === "ready" && eligibilityState.data ? deriveEligibilityGateSummary(eligibilityState.data.gates) : null;
  const frameworkDescription = describeFrameworkState(frameworkState.status === "ready" ? frameworkState.data : null);
  const live: OverviewLiveState = {
    applications: applicationsState.status === "ready" && applicationsState.data ? applicationsState.data.applications : [],
    applicationsLoading: applicationsState.status === "loading",
    linkedAssessment: assessmentsState.status === "ready" && assessmentsState.data ? findLinkedAssessment(assessmentsState.data.assessments, role.slug) : null,
    assessmentsLoading: assessmentsState.status === "loading",
    frameworkLabel: frameworkDescription.label,
    frameworkActive: frameworkDescription.active,
    frameworkLoading: frameworkState.status === "loading",
  };
  const initialTab = typeof window !== "undefined" && window.location.hash === "#evaluation-framework" ? "evaluation-framework" : "overview";
  return <AdminShell title="Recruitment Roles"><button className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary" onClick={() => setLocation("/admin/roles")} type="button"><ArrowLeft className="size-4" />Back to recruitment roles</button><article className="mt-5 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">{role.title}</h2><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground"><span className="font-medium text-primary">{role.department}</span><span>{role.employmentType}</span><span>Location: {role.location}</span><StatusBadge status={role.status} /></div></div><FoundationButton onClick={() => setLocation(`/admin/roles/${role.slug}/edit`)} variant="secondary"><Pencil className="size-4" />Edit role</FoundationButton></div></article><Tabs className="mt-6" defaultValue={initialTab}><div className="overflow-x-auto pb-1"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="eligibility">Eligibility</TabsTrigger><TabsTrigger value="assessment">Assessment</TabsTrigger><TabsTrigger value="evaluation-framework">Evaluation Framework</TabsTrigger></TabsList></div><TabsContent value="overview"><OverviewTab gateSummary={gateSummary} live={live} role={role} /></TabsContent><TabsContent value="applications"><ApplicationsTab live={live} onViewAll={() => setLocation("/admin/applications")} onViewCandidate={(id) => setLocation(`/admin/applications/${id}`)} roleTitle={role.title} /></TabsContent><TabsContent value="eligibility"><RoleEligibilityTab roleSlug={role.slug} /></TabsContent><TabsContent value="assessment"><AssessmentTab live={live} onImportCsv={() => setLocation(`/admin/roles/${role.slug}/assessment/import`)} onManageAssessments={() => setLocation("/admin/assessments")} role={role} /></TabsContent><TabsContent value="evaluation-framework"><V2EvaluationFrameworkTab roleSlug={role.slug} /></TabsContent></Tabs></AdminShell>;
}
