/**
 * Task 24C-3 — Assessment Builder cut over to TiDB.
 *
 * Assigned questions come from assessment_question_assignments via
 * /api/admin/assessments/:slug. Available questions come from the Question
 * Bank API. Reorder (up/down) persists to TiDB on Save. Add and Remove
 * persist immediately via individual API calls.
 *
 * No adminAssessmentData.ts or questionBankData.ts used as runtime source.
 * No localStorage fallback. A controlled error state is shown on API failure.
 *
 * Scoring preview boundary (Task 24C-3):
 * The builder shows each question's reference, prompt, dimension and type
 * sourced from TiDB. The builder does NOT source scoring configuration from
 * local compatibility files — scoring display ("configured/not configured")
 * uses the question status field from the TiDB response.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FieldFrame, FoundationButton, FoundationInput, FoundationTextarea } from "@/components/foundation/ui";
import {
  addAssessmentQuestion,
  fetchAssessments,
  removeAssessmentQuestion,
  reorderAssessmentQuestions,
  updateAssessment,
  QUESTION_TYPES,
  type AdminAssessmentDetail,
  type AdminQuestionListResponse,
  type AssignedQuestionSummary,
} from "@/lib/recruitmentApi";
import { useAdminAssessment, useQuestionBank } from "@/hooks/useRecruitmentData";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Copy, Info, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

function ScoringState({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${active ? "bg-[#e9f6ee] text-status-success-strong" : "bg-[#fff8e8] text-[#765d22]"}`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function QuietAction({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-portal-surface hover:text-primary disabled:pointer-events-none disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export default function AdminAssessmentBuilder() {
  const [, params] = useRoute("/admin/assessments/:assessmentSlug/edit");
  const [, setLocation] = useLocation();
  const slug = params?.assessmentSlug ?? "";

  // ── Server data ───────────────────────────────────────────────────────────
  const assessmentState = useAdminAssessment(slug || undefined);
  const questionBankState = useQuestionBank({ pageSize: 100 });

  // ── Local working state (reorder only — mutations applied immediately) ────
  // The working order is a local copy of assignment IDs, reflecting any
  // pending reorder before the Save action writes to TiDB.
  const [workingOrder, setWorkingOrder] = useState<string[] | null>(null);
  const [nameValue, setNameValue] = useState<string | null>(null);
  const [descriptionValue, setDescriptionValue] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dimensionFilter, setDimensionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync local state from server when it first loads.
  const assessment = assessmentState.data;
  const serverAssignments = assessment?.assignments ?? [];

  const effectiveOrder: string[] = workingOrder ?? serverAssignments.map((a) => a.questionId);
  const effectiveName = nameValue ?? assessment?.name ?? "";
  const effectiveDescription = descriptionValue ?? assessment?.description ?? "";

  // Build ordered assignment objects from the working order.
  const assignmentMap = useMemo(
    () => new Map(serverAssignments.map((a) => [a.questionId, a])),
    [serverAssignments],
  );
  const orderedAssignments: AssignedQuestionSummary[] = useMemo(
    () => effectiveOrder.flatMap((id) => { const a = assignmentMap.get(id); return a ? [a] : []; }),
    [effectiveOrder, assignmentMap],
  );

  const hasReorderChanges =
    workingOrder !== null &&
    JSON.stringify(workingOrder) !== JSON.stringify(serverAssignments.map((a) => a.questionId));
  const hasMetaChanges =
    (nameValue !== null && nameValue !== assessment?.name) ||
    (descriptionValue !== null && descriptionValue !== assessment?.description);
  const hasUnsavedChanges = hasReorderChanges || hasMetaChanges;

  // Available questions: all active questions not already assigned.
  const assignedIds = new Set(effectiveOrder);
  const allBankItems = questionBankState.data?.items ?? [];
  const dimensions = questionBankState.data?.dimensions ?? [];
  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allBankItems.filter((q) => {
      const matchesSearch =
        !term ||
        q.prompt.toLowerCase().includes(term) ||
        q.reference.toLowerCase().includes(term) ||
        (q.dimension?.name ?? "").toLowerCase().includes(term);
      const matchesDimension =
        dimensionFilter === "all" || q.dimension?.reference === dimensionFilter;
      const matchesType = typeFilter === "all" || q.type === typeFilter;
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesDimension && matchesType && matchesStatus;
    });
  }, [allBankItems, search, dimensionFilter, typeFilter, statusFilter]);

  // Multi-select (task #18): only questions not already assigned are selectable.
  const selectableIds = useMemo(
    () => filteredQuestions.filter((q) => !assignedIds.has(q.id)).map((q) => q.id),
    // assignedIds is rebuilt each render from the working order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredQuestions, effectiveOrder],
  );
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }, [allVisibleSelected, selectableIds]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const moveQuestion = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= effectiveOrder.length) return;
      const next = [...effectiveOrder];
      [next[index], next[target]] = [next[target], next[index]];
      setWorkingOrder(next);
    },
    [effectiveOrder],
  );

  const handleRemove = useCallback(
    async (questionId: string) => {
      if (!assessment) return;
      setActionError(null);
      try {
        const updated = await removeAssessmentQuestion(assessment.slug, questionId);
        // Update working order to reflect server state.
        setWorkingOrder(updated.map((a) => a.questionId));
        // Trigger a re-fetch to get fresh server data.
        assessmentState.reload();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to remove this question.");
      }
    },
    [assessment, assessmentState],
  );

  const handleAdd = useCallback(
    async (questionId: string) => {
      if (!assessment) return;
      setActionError(null);
      try {
        const updated = await addAssessmentQuestion(assessment.slug, questionId);
        setWorkingOrder(updated.map((a) => a.questionId));
        setSelectedIds((current) => {
          if (!current.has(questionId)) return current;
          const next = new Set(current);
          next.delete(questionId);
          return next;
        });
        assessmentState.reload();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to add this question.");
      }
    },
    [assessment, assessmentState],
  );

  // Bulk add (task #18): add every selected question sequentially, then reload
  // once. The server appends each assignment after the current highest order.
  const handleAddSelected = useCallback(async () => {
    if (!assessment || selectedIds.size === 0) return;
    setActionError(null);
    setAdding(true);
    try {
      let latest: AssignedQuestionSummary[] | null = null;
      for (const questionId of Array.from(selectedIds)) {
        if (assignedIds.has(questionId)) continue;
        latest = await addAssessmentQuestion(assessment.slug, questionId);
      }
      if (latest) setWorkingOrder(latest.map((a) => a.questionId));
      setSelectedIds(new Set());
      assessmentState.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to add the selected questions.");
    } finally {
      setAdding(false);
    }
    // assignedIds derives from effectiveOrder; include it to avoid a stale skip-set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, assessmentState, selectedIds, effectiveOrder]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assessment) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Persist metadata update if name/description changed.
      if (hasMetaChanges) {
        await updateAssessment(assessment.slug, {
          name: effectiveName.trim() || assessment.name,
          description: effectiveDescription.trim(),
        });
      }
      // Persist reorder if order changed.
      if (hasReorderChanges && workingOrder) {
        await reorderAssessmentQuestions(assessment.slug, workingOrder);
      }
      setWorkingOrder(null);
      setNameValue(null);
      setDescriptionValue(null);
      setLocation(`/admin/assessments/${assessment.slug}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update the assessment.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

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
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-primary"
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

  if (!assessment) {
    return (
      <AdminShell title="Assessments">
        <button
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-primary"
          onClick={() => setLocation("/admin/assessments")}
          type="button"
        >
          <ArrowLeft className="size-4" />Back to Assessments
        </button>
        <section className="py-8">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">Assessment not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">The requested assessment could not be found.</p>
          <FoundationButton className="mt-6" onClick={() => setLocation("/admin/assessments")} variant="secondary">
            Back to Assessments
          </FoundationButton>
        </section>
      </AdminShell>
    );
  }

  const isDraft = assessment.status === "Draft";

  return (
    <AdminShell title="Assessments">
      <button
        className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
        onClick={() => setLocation(`/admin/assessments/${slug}`)}
        type="button"
      >
        <ArrowLeft className="size-4" />Back to Assessment
      </button>

      <section className="mt-5">
        <p className="text-[12px] font-medium text-muted-foreground">Assessment configuration</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">Edit assessment</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">
          Set the assessment context, then assemble the questions in the order applicants will receive them.
        </p>
      </section>

      {actionError && (
        <div className="mt-4 rounded-lg border border-status-error-strong/20 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-status-error-strong">{actionError}</p>
        </div>
      )}

      <form noValidate onSubmit={handleSave}>
        <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Assessment settings</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                Core information and role assignment for this assessment.
              </p>
            </div>
            <p className="text-[13px] text-muted-foreground">{orderedAssignments.length} assigned questions</p>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]">
            <FieldFrame label="Assessment name" required>
              <FoundationInput
                onChange={(e) => setNameValue(e.target.value)}
                value={effectiveName}
              />
            </FieldFrame>
            <FieldFrame label="Assigned role">
              <p className="h-10 flex items-center text-sm font-medium text-primary px-3">
                {assessment.role.title}
              </p>
            </FieldFrame>
          </div>
          <div className="mt-5">
            <FieldFrame label="Description">
              <FoundationTextarea
                className="min-h-24"
                onChange={(e) => setDescriptionValue(e.target.value)}
                value={effectiveDescription}
              />
            </FieldFrame>
          </div>

          {/* Status indicator */}
          {isDraft && (
            <div className="mt-5 flex gap-3 rounded-lg border border-[#d9e5f0] bg-[#f3f8fc] px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-portal-blue" />
              <p className="text-[13px] leading-6 text-primary">
                <span className="font-semibold">Assessment status: Draft.</span>{" "}
                Save your changes, then use the Assessment detail page to activate it when it is ready.
              </p>
            </div>
          )}
        </section>

        {hasUnsavedChanges && (
          <section className="mt-4 flex gap-3 rounded-xl border border-[#eadfbd] bg-[#fffaf0] px-4 py-4">
            <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-[#765d22]" />
            <div>
              <p className="text-sm font-semibold text-primary">Unsaved changes</p>
              <p className="mt-1 text-[13px] leading-6 text-[#765d22]">
                You have unsaved changes to the question order or assessment details. Save to persist them.
              </p>
            </div>
          </section>
        )}

        {saveError && (
          <div className="mt-4 rounded-lg border border-status-error-strong/20 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-status-error-strong">{saveError}</p>
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          {/* Left panel: assigned questions */}
          <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Assessment Questions</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  Order determines the applicant experience.
                </p>
              </div>
              <p className="text-[13px] text-muted-foreground">{orderedAssignments.length} assigned</p>
            </div>
            {orderedAssignments.length > 0 ? (
              <ol className="mt-5 divide-y divide-border border-t border-border">
                {orderedAssignments.map((assignment, index) => (
                  <li className="py-4" key={assignment.assignmentId}>
                    <div className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-portal-surface text-[12px] font-semibold text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {assignment.reference}
                          </span>
                          <span className="text-[12px] text-muted-foreground">{assignment.type}</span>
                          {assignment.status === "Inactive" && (
                            <span className="inline-flex rounded-md bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#765d22]">
                              Inactive — warning
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium leading-6 text-primary">{assignment.prompt}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {assignment.dimension
                            ? `${assignment.dimension.reference} · ${assignment.dimension.name}`
                            : "No dimension"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-0.5">
                        <QuietAction
                          disabled={index === 0}
                          label={`Move ${assignment.reference} up`}
                          onClick={() => moveQuestion(index, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </QuietAction>
                        <QuietAction
                          disabled={index === orderedAssignments.length - 1}
                          label={`Move ${assignment.reference} down`}
                          onClick={() => moveQuestion(index, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </QuietAction>
                        <QuietAction
                          label={`Remove ${assignment.reference}`}
                          onClick={() => handleRemove(assignment.questionId)}
                        >
                          <Trash2 className="size-4" />
                        </QuietAction>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-portal-border-strong bg-portal-surface px-5 py-9 text-center">
                <h4 className="text-base font-semibold text-primary">No questions added</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Add questions from the Question Bank to build this assessment.
                </p>
              </div>
            )}
          </article>

          {/* Right panel: question bank picker */}
          <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Question Bank</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                Add Active questions to this assessment.
              </p>
            </div>
            <div className="mt-5 space-y-3">
              <div className="relative">
                <label className="sr-only" htmlFor="builder-question-search">
                  Search questions
                </label>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <FoundationInput
                  className="pl-10"
                  id="builder-question-search"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions"
                  value={search}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="builder-dimension-filter">
                    Dimension
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-primary"
                    id="builder-dimension-filter"
                    onChange={(e) => setDimensionFilter(e.target.value)}
                    value={dimensionFilter}
                  >
                    <option value="all">All dimensions</option>
                    {dimensions.map((d) => (
                      <option key={d.reference} value={d.reference}>
                        {d.reference} · {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="builder-type-filter">
                    Type
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-primary"
                    id="builder-type-filter"
                    onChange={(e) => setTypeFilter(e.target.value)}
                    value={typeFilter}
                  >
                    <option value="all">All types</option>
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="builder-status-filter">
                    Status
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-primary"
                    id="builder-status-filter"
                    onChange={(e) => setStatusFilter(e.target.value)}
                    value={statusFilter}
                  >
                    <option value="all">All statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {questionBankState.status === "loading" && (
              <div className="mt-5 py-8 text-center text-[13px] text-muted-foreground">Loading questions…</div>
            )}

            {questionBankState.status === "error" && (
              <div className="mt-5">
                <DataErrorState
                  message={questionBankState.error ?? "Unable to load questions."}
                  onRetry={questionBankState.reload}
                />
              </div>
            )}

            {questionBankState.status === "ready" && (
              <>
                {filteredQuestions.length > 0 ? (
                  <>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-portal-surface px-3 py-2.5">
                      <label className="flex items-center gap-2 text-[13px] font-medium text-primary">
                        <input
                          checked={allVisibleSelected}
                          className="size-4 accent-[#436C9E] disabled:opacity-30"
                          disabled={selectableIds.length === 0}
                          onChange={toggleSelectAll}
                          type="checkbox"
                        />
                        Select all
                      </label>
                      <FoundationButton
                        disabled={selectedIds.size === 0 || adding}
                        onClick={handleAddSelected}
                        size="sm"
                        variant="tertiary"
                      >
                        {adding ? "Adding…" : `Add selected (${selectedIds.size})`}
                      </FoundationButton>
                    </div>
                    <div className="mt-3 divide-y divide-border border-t border-border">
                      {filteredQuestions.map((question) => {
                        const added = assignedIds.has(question.id);
                        const selected = selectedIds.has(question.id);
                        return (
                          <article className="flex gap-3 py-4" key={question.id}>
                            <input
                              aria-label={`Select ${question.reference}`}
                              checked={selected}
                              className="mt-1 size-4 shrink-0 accent-[#436C9E] disabled:opacity-30"
                              disabled={added}
                              onChange={() => toggleSelect(question.id)}
                              type="checkbox"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                  {question.reference}
                                </span>
                                <span className="text-[12px] text-muted-foreground">{question.type}</span>
                                {question.status === "Inactive" && (
                                  <span className="inline-flex rounded-md bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#765d22]">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p
                                className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-primary"
                                title={question.prompt}
                              >
                                {question.prompt}
                              </p>
                              <p className="mt-1 text-[13px] text-muted-foreground">
                                {question.dimension
                                  ? `${question.dimension.reference} · ${question.dimension.name}`
                                  : "No dimension"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-1">
                              <QuietAction
                                label={`Duplicate and edit ${question.reference}`}
                                onClick={() => setLocation(`/admin/questions/${question.id}/duplicate`)}
                              >
                                <Copy className="size-4" />
                              </QuietAction>
                              <FoundationButton
                                disabled={added}
                                onClick={() => !added && handleAdd(question.id)}
                                size="sm"
                                variant={added ? "secondary" : "tertiary"}
                              >
                                {added ? "Added" : "Add"}
                              </FoundationButton>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="py-14 text-center">
                    <h4 className="text-base font-semibold text-primary">No questions found</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try changing your search or filters.
                    </p>
                  </div>
                )}
              </>
            )}
          </article>
        </section>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <FoundationButton onClick={() => setLocation(`/admin/assessments/${slug}`)} variant="secondary">
            Cancel
          </FoundationButton>
          <FoundationButton disabled={saving} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </FoundationButton>
        </div>
      </form>

      <aside className="mt-6 flex gap-3 rounded-xl border border-border bg-white p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-portal-blue-soft text-portal-blue">
          <Info className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-primary">Scoring stays in Question Bank</h3>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
            This workspace controls which questions are assigned and in what order. Score values are
            managed from the Question Bank.
          </p>
        </div>
      </aside>
    </AdminShell>
  );
}
