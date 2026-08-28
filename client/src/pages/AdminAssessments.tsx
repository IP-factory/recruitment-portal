/**
 * Task 24C-3 — Assessment list cut over to TiDB.
 *
 * All assessment data now comes from /api/admin/assessments. There is no
 * localStorage fallback and no import from adminAssessmentData.ts for runtime
 * data. A controlled error state is shown on API failure.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { StatusBadge } from "@/components/foundation/ui";
import { useAdminAssessments } from "@/hooks/useRecruitmentData";
import type { AdminAssessmentListItem } from "@/lib/recruitmentApi";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

function AssessmentRow({ assessment, onView }: { assessment: AdminAssessmentListItem; onView: () => void }) {
  return (
    <tr>
      <td className="px-3 py-4">
        <p className="text-sm font-medium text-primary">{assessment.name}</p>
        <p className="mt-1 max-w-[300px] truncate text-[12px] text-muted-foreground" title={assessment.description}>
          {assessment.description || "No description."}
        </p>
      </td>
      <td className="px-3 py-4 text-[13px] text-primary">{assessment.role.title}</td>
      <td className="px-3 py-4 text-[13px] text-primary">{assessment.version}</td>
      <td className="px-3 py-4 text-[13px] text-primary">{assessment.questionCount}</td>
      <td className="px-3 py-4">
        <StatusBadge status={assessment.status} />
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-[13px] text-muted-foreground">
        {new Date(assessment.updatedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })}
      </td>
      <td className="px-3 py-4 text-right">
        <button
          className="inline-flex items-center gap-1 text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline"
          onClick={onView}
          type="button"
        >
          View<ArrowRight className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}

function AssessmentCard({ assessment, onView }: { assessment: AdminAssessmentListItem; onView: () => void }) {
  return (
    <article className="py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{assessment.name}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{assessment.role.title}</p>
        </div>
        <StatusBadge status={assessment.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Version</dt>
          <dd className="mt-1 text-[13px] font-medium text-primary">{assessment.version}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Questions</dt>
          <dd className="mt-1 text-[13px] font-medium text-primary">{assessment.questionCount}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Last updated</dt>
          <dd className="mt-1 text-[13px] text-primary">
            {new Date(assessment.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
          </dd>
        </div>
      </dl>
      <button
        className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline"
        onClick={onView}
        type="button"
      >
        View assessment<ArrowRight className="size-3.5" />
      </button>
    </article>
  );
}

export default function AdminAssessments() {
  const [, setLocation] = useLocation();
  const assessmentsState = useAdminAssessments();

  const navigate = (slug: string) => setLocation(`/admin/assessments/${slug}`);

  return (
    <AdminShell title="Assessments">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Assessment setup</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Assessments</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">
            Configure the assessment structure assigned to each recruitment role.
          </p>
        </div>
      </section>

      {/* Summary cards */}
      <section aria-label="Assessment summary" className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-white p-4">
          <p className="text-[12px] font-medium text-muted-foreground">Total Assessments</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">
            {assessmentsState.status === "ready" ? assessmentsState.data?.summary.total ?? "—" : "—"}
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Available in this workspace</p>
        </article>
        <article className="rounded-xl border border-border bg-white p-4">
          <p className="text-[12px] font-medium text-muted-foreground">Active Assessments</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">
            {assessmentsState.status === "ready" ? assessmentsState.data?.summary.active ?? "—" : "—"}
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Currently active</p>
        </article>
        <article className="rounded-xl border border-border bg-white p-4">
          <p className="text-[12px] font-medium text-muted-foreground">Assigned Roles</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary">
            {assessmentsState.status === "ready" ? assessmentsState.data?.summary.assignedRoles ?? "—" : "—"}
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Roles with an assessment assignment</p>
        </article>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-white p-4 sm:p-5 lg:p-6">
        <div className="border-b border-border pb-4">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Assessment configuration</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Review question selection and role assignment for each assessment.
          </p>
        </div>

        {assessmentsState.status === "loading" && (
          <div className="py-10">
            <DataLoadingState label="Loading assessments" />
          </div>
        )}

        {assessmentsState.status === "error" && (
          <div className="py-8">
            <DataErrorState
              message={assessmentsState.error ?? "Unable to load assessments."}
              onRetry={assessmentsState.reload}
            />
          </div>
        )}

        {assessmentsState.status === "ready" && (
          <>
            {assessmentsState.data && assessmentsState.data.assessments.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="mt-3 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] text-left">
                    <thead className="border-b border-border">
                      <tr>
                        {["Assessment", "Role", "Version", "Questions", "Status", "Last updated", "Action"].map(
                          (heading) => (
                            <th
                              className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground last:text-right"
                              key={heading}
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {assessmentsState.data.assessments.map((assessment) => (
                        <AssessmentRow
                          assessment={assessment}
                          key={assessment.id}
                          onView={() => navigate(assessment.slug)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="mt-3 divide-y divide-border md:hidden">
                  {assessmentsState.data.assessments.map((assessment) => (
                    <AssessmentCard
                      assessment={assessment}
                      key={assessment.id}
                      onView={() => navigate(assessment.slug)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="py-14 text-center">
                <h3 className="text-base font-semibold text-primary">No assessments available</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Assessment configuration will appear here when available.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </AdminShell>
  );
}
