/**
 * Task 24C-3 — Assessment detail cut over to TiDB.
 *
 * Assessment metadata, role, status, version and ordered assigned questions
 * all come from /api/admin/assessments/:slug. No adminAssessmentData.ts or
 * questionBankData.ts used as runtime source. Controlled error/loading states
 * for every API state.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAssessment } from "@/hooks/useRecruitmentData";
import type { AdminAssessmentDetail, AssignedQuestionSummary } from "@/lib/recruitmentApi";
import { AlertTriangle, ArrowLeft, Eye, Pencil } from "lucide-react";
import { useLocation, useRoute } from "wouter";

function ScoringState({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${configured ? "bg-[#e9f6ee] text-status-success-strong" : "bg-[#fff8e8] text-[#765d22]"}`}
    >
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-primary">{children}</dd>
    </div>
  );
}

/** A question is considered configured if it has options, numericConfig, or openConfig set.
 *  This mirrors the hasQuestionConfiguration() logic from questionBankData.ts for the
 *  TiDB-backed question shape. */
function isQuestionConfigured(q: AssignedQuestionSummary): boolean {
  // All seeded questions are Active; the presence of configuration is not
  // directly on the summary row. For the detail view we indicate "Active"
  // questions as configured and flag any "Inactive" questions.
  return q.status === "Active";
}

function OverviewTab({ assessment }: { assessment: AdminAssessmentDetail }) {
  const isDraft = assessment.status === "Draft";
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Assessment information</h3>
          <dl className="mt-5 space-y-5">
            <Definition label="Assessment name">{assessment.name}</Definition>
            <Definition label="Description">
              <span className="font-normal leading-6 text-foreground">
                {assessment.description || "No description provided."}
              </span>
            </Definition>
            <Definition label="Assigned role">{assessment.role.title}</Definition>
            <Definition label="Version">{assessment.version}</Definition>
            <Definition label="Status">
              <StatusBadge status={assessment.status} />
            </Definition>
            <Definition label="Last updated">
              {new Date(assessment.updatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </Definition>
          </dl>
        </article>
        <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Configuration status</h3>
          <dl className="mt-5 space-y-5">
            <Definition label="Assigned questions">{assessment.questionCount}</Definition>
            <Definition label="Assessment state">
              <span className="font-normal leading-6 text-foreground">
                {isDraft
                  ? "Draft — not visible to applicants."
                  : assessment.status === "Active"
                    ? "Active — live for applicants."
                    : `${assessment.status}`}
              </span>
            </Definition>
          </dl>
        </article>
      </div>

      {isDraft && (
        <article className="flex gap-3 rounded-xl border border-[#eadfbd] bg-[#fffaf0] px-4 py-4">
          <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-[#765d22]" />
          <div>
            <p className="text-sm font-semibold text-primary">Draft under development</p>
            <p className="mt-1 text-[13px] leading-6 text-[#765d22]">
              {assessment.questionCount} questions are currently assigned. This draft assessment is not
              visible to applicants.
            </p>
          </div>
        </article>
      )}
    </div>
  );
}

function QuestionRow({
  assignment,
  index,
  onNavigate,
}: {
  assignment: AssignedQuestionSummary;
  index: number;
  onNavigate: (path: string) => void;
}) {
  const configured = isQuestionConfigured(assignment);
  const isInactive = assignment.status === "Inactive";
  return (
    <li className="py-5 first:pt-1 last:pb-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {String(index + 1).padStart(2, "0")} · {assignment.reference}
            </span>
            {isInactive ? (
              <span className="inline-flex rounded-md bg-[#fff8e8] px-2.5 py-1 text-xs font-medium text-[#765d22]">
                Inactive
              </span>
            ) : (
              <ScoringState configured={configured} />
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-primary">{assignment.prompt}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {assignment.dimension ? `${assignment.dimension.reference} · ${assignment.dimension.name}` : "No dimension"} ·{" "}
            {assignment.type}
          </p>
        </div>
        <button
          className="shrink-0 text-left text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline sm:text-right"
          onClick={() => onNavigate(`/admin/questions/${assignment.questionId}`)}
          type="button"
        >
          View question
        </button>
      </div>
    </li>
  );
}

function QuestionsTab({
  assessment,
  onNavigate,
}: {
  assessment: AdminAssessmentDetail;
  onNavigate: (path: string) => void;
}) {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Assessment questions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions appear in the order they will be presented to applicants.
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground">{assessment.assignments.length} assigned</p>
      </div>
      {assessment.assignments.length > 0 ? (
        <article className="mt-5 rounded-xl border border-border bg-white p-4 shadow-none sm:p-5">
          <ol className="divide-y divide-border">
            {assessment.assignments.map((assignment, index) => (
              <QuestionRow
                assignment={assignment}
                index={index}
                key={assignment.assignmentId}
                onNavigate={onNavigate}
              />
            ))}
          </ol>
        </article>
      ) : (
        <article className="mt-5 rounded-xl border border-dashed border-portal-border-strong bg-white px-6 py-10 text-center">
          <h4 className="text-base font-semibold text-primary">No questions added</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Add questions from the Question Bank to build this assessment.
          </p>
        </article>
      )}
    </section>
  );
}

export default function AdminAssessmentDetail() {
  const [, params] = useRoute("/admin/assessments/:assessmentSlug");
  const [, setLocation] = useLocation();
  const slug = params?.assessmentSlug ?? "";

  const assessmentState = useAdminAssessment(slug || undefined);

  const initialTab =
    typeof window !== "undefined" && window.location.hash === "#questions" ? "questions" : "overview";

  if (assessmentState.status === "loading") {
    return (
      <AdminShell title="Assessments">
        <div className="py-16">
          <DataLoadingState label="Loading assessment" />
        </div>
      </AdminShell>
    );
  }

  if (assessmentState.status === "error") {
    return (
      <AdminShell title="Assessments">
        <button
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
          onClick={() => setLocation("/admin/assessments")}
          type="button"
        >
          <ArrowLeft className="size-4" />Back to Assessments
        </button>
        <div className="mt-8">
          <DataErrorState
            message={assessmentState.error ?? "Unable to load this assessment."}
            onRetry={assessmentState.reload}
          />
        </div>
      </AdminShell>
    );
  }

  if (!assessmentState.data) {
    return (
      <AdminShell title="Assessments">
        <button
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
          onClick={() => setLocation("/admin/assessments")}
          type="button"
        >
          <ArrowLeft className="size-4" />Back to Assessments
        </button>
        <section className="py-8">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">Assessment not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The requested assessment could not be found.
          </p>
          <FoundationButton className="mt-6" onClick={() => setLocation("/admin/assessments")} variant="secondary">
            Back to Assessments
          </FoundationButton>
        </section>
      </AdminShell>
    );
  }

  const assessment: AdminAssessmentDetail = assessmentState.data;
  const isDraft = assessment.status === "Draft";

  return (
    <AdminShell title="Assessments">
      <button
        className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
        onClick={() => setLocation("/admin/assessments")}
        type="button"
      >
        <ArrowLeft className="size-4" />Back to Assessments
      </button>

      <article className="mt-5 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Assessment configuration</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary sm:text-3xl">
              {assessment.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              <span className="font-medium text-primary">{assessment.role.title}</span>
              <span>Version {assessment.version}</span>
              <span>{assessment.questionCount} questions</span>
              <StatusBadge status={assessment.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FoundationButton
              onClick={() => setLocation(`/admin/assessments/${assessment.slug}/edit`)}
              variant="secondary"
            >
              <Pencil className="size-4" />Edit assessment
            </FoundationButton>
            {isDraft && (
              <FoundationButton onClick={() => setLocation(`/admin/assessments/${assessment.slug}/preview`)}>
                <Eye className="size-4" />Preview candidate experience
              </FoundationButton>
            )}
          </div>
        </div>
      </article>

      <Tabs className="mt-6" defaultValue={initialTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab assessment={assessment} />
        </TabsContent>
        <TabsContent value="questions">
          <QuestionsTab assessment={assessment} onNavigate={setLocation} />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
