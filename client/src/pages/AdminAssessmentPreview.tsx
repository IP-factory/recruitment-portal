/**
 * Task 24C-3 — Admin Assessment Preview cut over to TiDB.
 *
 * The assessment composition (which questions, in what order) now comes from
 * /api/admin/assessments/:slug/preview. This ensures that any reorder or
 * assignment change made in the Builder is immediately reflected here.
 *
 * Shape adapter boundary (Task 24C-3):
 *   The preview renderer was written for QuestionBankQuestion (questionBankData.ts).
 *   TiDB returns AdminQuestionDetail (shared/questionBankApi.ts). The function
 *   `toPreviewQuestion()` maps TiDB DTOs into the renderer's expected shape.
 *   This adapter is intentionally local to this file and NOT a runtime fallback
 *   to local data — if the API fails the preview shows an error, not local content.
 *
 * Scoring preview boundary (Task 24C-3):
 *   v2BaseScoring.ts, v2ModifierScoring.ts, and the OPEN rubric rating panel
 *   still consume the QuestionBankQuestion shape via the adapter. The scoring
 *   engine is NOT migrated in this task. The ScoringPreview panel at the end
 *   of the preview run continues to work via the adapter output.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { V2ModifierPanel } from "@/components/admin/V2ModifierPanel";
import { DataErrorState, DataLoadingState } from "@/components/AsyncStates";
import { FoundationButton, FoundationInput, FoundationTextarea } from "@/components/foundation/ui";
import { useAdminSession } from "@/contexts/AdminAuthContext";
import { useAdminAssessmentPreview } from "@/hooks/useRecruitmentData";
import type { AdminAssessmentPreviewPayload, AdminQuestionDetail, AdminQuestionOption as TiDbOption } from "@/lib/recruitmentApi";
import type { AdminQuestionOption, QuestionBankQuestion } from "@/lib/questionBankData";
import {
  ASSESSMENT_V2_PREVIEW_STORAGE_KEY,
  ASSESSMENT_V2_PREVIEW_TIMERS_KEY,
  EMPTY_PREVIEW_STATE,
  countPreviewWords,
  formatPreviewRemaining,
  loadPreviewJson,
  savePreviewJson,
  trimPreviewWords,
  type NumericPreviewAnswer,
  type PreviewAnswer,
  type PreviewState,
  type PreviewTimerState,
} from "@/lib/assessmentPreviewData";
import { calculateV2BaseAssessmentScore, type V2RubricRatings } from "@/lib/v2BaseScoring";
import {
  calculateV2Modifiers,
  V2_BONUS_ITEMS,
  V2_INTEGRITY_PENALTY,
  type V2IntegrityStatus,
  type V2ModifierResult,
} from "@/lib/v2ModifierScoring";
import { Check, Clock3, ExternalLink, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

// ── Shape adapter: TiDB AdminQuestionDetail → QuestionBankQuestion ────────────
//
// This adapter maps the database-backed DTO into the shape the existing
// preview renderer expects. It is a structural mapping only — all content
// comes from the TiDB response. There is no fallback to local question data.

function toPreviewOption(opt: TiDbOption, index: number): AdminQuestionOption {
  const id = String.fromCharCode(97 + index); // a, b, c, …
  return {
    id,
    label: id.toUpperCase(),
    text: opt.text,
    rawPoints: opt.rawScore ?? undefined,
    decoy: opt.isDecoy || undefined,
    outcome: opt.outcomeType === "close" ? "close" : undefined,
    relatedGate: opt.relatedGate?.reference,
    whatThisReveals: opt.internalExplanation ?? undefined,
    verificationMultiplier: (opt.verificationMultiplier as 1 | 0.95 | 0.85 | undefined) ?? undefined,
    gateOutcome: (opt.outcomeType as "pass" | "fail" | "flag" | undefined) ?? undefined,
  };
}

function toPreviewQuestion(detail: AdminQuestionDetail): QuestionBankQuestion {
  const opts = detail.options.map(toPreviewOption);

  // Build config in the QuestionBankQuestion shape.
  const config: QuestionBankQuestion["config"] = {};
  if (detail.type === "GATE") {
    config.gateConfig = { options: opts };
  } else if (detail.type === "ORDINAL") {
    config.ordinalConfig = { options: opts };
  } else if (detail.type === "MULTI") {
    config.multiConfig = { options: opts, scoreCap: detail.scoreCap ?? 5 };
  } else if (detail.type === "SJT") {
    config.sjtConfig = { options: opts };
  } else if (detail.type === "EVIDENCE") {
    config.evidenceConfig = {
      pairedQuestionRef: detail.evidenceLink?.claimedQuestionReference ?? "",
      options: opts,
    };
  } else if (detail.type === "NUMERIC" && detail.numericConfig) {
    const nc = detail.numericConfig;
    config.numericConfig = {
      mode: nc.mode as "single" | "twoValueDerived" | "calendarYearExperience",
      inputs: nc.inputDefinitions.map((inp) => ({ label: inp.label, unit: inp.unit })),
      bands: nc.bands.map((b, i) => ({
        id: `band-${i + 1}`,
        lowerBound: b.lowerBound,
        ...(b.upperBound !== null ? { upperBound: b.upperBound } : {}),
        rawPoints: b.rawScore,
      })),
    };
  } else if (detail.type === "OPEN" && detail.openConfig) {
    const oc = detail.openConfig;
    config.openConfig = {
      pasteAllowed: oc.pasteAllowed,
      timeLimitSec: oc.timeLimitSec ?? undefined,
      wordLimit: oc.maximumWords ?? undefined,
      minimumWords: oc.minimumWords ?? undefined,
      rubric: oc.rubric.map((r, i) => ({
        id: r.scoreMin === r.scoreMax ? String(r.scoreMin) : `${r.scoreMin}-${r.scoreMax}`,
        points: r.scoreMax as 0 | 1 | 2 | 3 | 4 | 5,
        anchor: r.anchorText,
      })),
    };
  }

  // Dimension mapping.
  const dimCode = (detail.dimension?.reference ?? "NA") as QuestionBankQuestion["dimension"];

  return {
    id: detail.id,
    reference: detail.reference,
    dimension: dimCode,
    dimensionLabel: detail.dimension?.name ?? "Not Applicable",
    type: detail.type,
    qWeight: (detail.qWeight as 1 | 2 | 3 | null) ?? null,
    max: detail.maxScore === 5 ? 5 : null,
    required: detail.required,
    prompt: detail.prompt,
    helpText: detail.helpText,
    status: detail.status === "Active" ? "Active" : "Inactive",
    evidenceRef: detail.evidenceLink?.claimedQuestionReference ?? "",
    flagIf: "",
    timeLimitSec: detail.timeLimitSec,
    usedIn: detail.usedIn.join(", "),
    config,
    // Compatibility aliases used by the renderer.
    competency: detail.dimension?.name ?? "Not Applicable",
    question: detail.prompt,
    options: opts,
  };
}

// ── Preview types ─────────────────────────────────────────────────────────────

type TimerState = PreviewTimerState;
type NumericAnswer = NumericPreviewAnswer;

export const ASSESSMENT_V2_PREVIEW_RUBRIC_STORAGE_KEY =
  "recruitment-portal:assessment-v2-preview-rubric-ratings";
export const ASSESSMENT_V2_PREVIEW_INTEGRITY_STORAGE_KEY =
  "recruitment-portal:assessment-v2-preview-integrity-statuses";
export const ASSESSMENT_V2_PREVIEW_BONUS_STORAGE_KEY =
  "recruitment-portal:assessment-v2-preview-bonus-confirmations";

function optionText(option: AdminQuestionOption) {
  return option.text || option.label;
}

function questionOptions(question: QuestionBankQuestion) {
  if (question.type === "GATE") return question.config.gateConfig?.options ?? question.options;
  if (question.type === "ORDINAL") return question.config.ordinalConfig?.options ?? question.options;
  if (question.type === "MULTI") return question.config.multiConfig?.options ?? question.options;
  if (question.type === "SJT") return question.config.sjtConfig?.options ?? question.options;
  if (question.type === "EVIDENCE") return question.config.evidenceConfig?.options ?? question.options;
  return question.options;
}

function isSingleSelect(question: QuestionBankQuestion) {
  return (
    question.type === "ORDINAL" ||
    question.type === "SJT" ||
    question.type === "EVIDENCE" ||
    question.type === "GATE"
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────

function PreviewBanner({ name, slug, onExit }: { name: string; slug: string; onExit: () => void }) {
  return (
    <div className="border-b border-[#d9e5f0] bg-[#f3f8fc] px-4 py-3 text-primary">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-portal-blue" />
          <div>
            <p className="text-[13px] font-semibold">Admin Preview · {name}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              This draft assessment is not visible to applicants.
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-portal-blue hover:text-primary hover:underline"
          onClick={onExit}
          type="button"
        >
          Exit preview<ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function SelectRow({
  option,
  selected,
  onClick,
  multi = false,
}: {
  option: AdminQuestionOption;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      aria-checked={selected}
      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue/30 ${selected ? "border-primary bg-portal-blue-soft" : "border-input bg-white hover:border-portal-blue"}`}
      onClick={onClick}
      role={multi ? "checkbox" : "radio"}
      type="button"
    >
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center border text-[11px] font-semibold ${multi ? "rounded-md" : "rounded-full"} ${selected ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 text-sm leading-6 text-foreground">{optionText(option)}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminAssessmentPreview() {
  const { state } = useAdminSession();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/assessments/:assessmentSlug/preview");
  const slug = params?.assessmentSlug ?? "";

  const [allowed, setAllowed] = useState(false);

  const previewState = useAdminAssessmentPreview(slug || undefined);

  const [preview, setPreview] = useState<PreviewState>(() =>
    loadPreviewJson(ASSESSMENT_V2_PREVIEW_STORAGE_KEY, EMPTY_PREVIEW_STATE),
  );
  const [timers, setTimers] = useState<Record<string, TimerState>>(() =>
    loadPreviewJson(ASSESSMENT_V2_PREVIEW_TIMERS_KEY, {}),
  );
  const [now, setNow] = useState(() => Date.now());
  const [validationError, setValidationError] = useState("");
  const [pasteNotice, setPasteNotice] = useState("");
  const [closeOption, setCloseOption] = useState(false);
  const [rubricRatings, setRubricRatings] = useState<V2RubricRatings>(() =>
    loadPreviewJson(ASSESSMENT_V2_PREVIEW_RUBRIC_STORAGE_KEY, {}),
  );
  const [integrityStatuses, setIntegrityStatuses] = useState<Record<string, V2IntegrityStatus>>(() =>
    loadPreviewJson(ASSESSMENT_V2_PREVIEW_INTEGRITY_STORAGE_KEY, {}),
  );
  const [bonusConfirmed, setBonusConfirmed] = useState<Record<string, boolean>>(() =>
    loadPreviewJson(ASSESSMENT_V2_PREVIEW_BONUS_STORAGE_KEY, {}),
  );

  useEffect(() => {
    if (state.status === "authorized") setAllowed(true);
    else if (state.status !== "loading") setLocation("/admin/login");
  }, [state.status, setLocation]);

  useEffect(() => { savePreviewJson(ASSESSMENT_V2_PREVIEW_STORAGE_KEY, preview); }, [preview]);
  useEffect(() => { savePreviewJson(ASSESSMENT_V2_PREVIEW_TIMERS_KEY, timers); }, [timers]);
  useEffect(() => { savePreviewJson(ASSESSMENT_V2_PREVIEW_RUBRIC_STORAGE_KEY, rubricRatings); }, [rubricRatings]);
  useEffect(() => { savePreviewJson(ASSESSMENT_V2_PREVIEW_INTEGRITY_STORAGE_KEY, integrityStatuses); }, [integrityStatuses]);
  useEffect(() => { savePreviewJson(ASSESSMENT_V2_PREVIEW_BONUS_STORAGE_KEY, bonusConfirmed); }, [bonusConfirmed]);
  useEffect(() => {
    const hasActiveTimer = Object.values(timers).some((t) => !t.submitted && t.expiresAt > Date.now());
    if (!hasActiveTimer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timers]);

  // Map TiDB assignments to renderer-compatible QuestionBankQuestion array.
  const questions: readonly QuestionBankQuestion[] = useMemo(() => {
    if (!previewState.data) return [];
    return previewState.data.assignments.map((a) => toPreviewQuestion(a.question));
  }, [previewState.data]);

  const assessmentName = previewState.data?.name ?? "Assessment Preview";
  const exitSlug = slug;

  const questionIndex = Math.max(preview.currentQuestionIndex, 0);
  const question = questions[questionIndex];
  const answer = question ? preview.answers[question.id] : undefined;
  const timer = question ? timers[question.id] : undefined;
  const openConfig = question?.config.openConfig;
  const timerExpired = Boolean(timer && timer.expiresAt <= now);
  const responseLocked = Boolean(timer?.submitted || timerExpired);
  const progress = questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0;
  const scoring = useMemo(
    () => calculateV2BaseAssessmentScore(questions, preview.answers, rubricRatings),
    [questions, preview.answers, rubricRatings],
  );
  const modifiers = useMemo(
    () => calculateV2Modifiers(scoring, questions, preview.answers, integrityStatuses, bonusConfirmed),
    [scoring, questions, preview.answers, integrityStatuses, bonusConfirmed],
  );

  useEffect(() => {
    if (timerExpired && timer && !timer.submitted) {
      setTimers((current) => ({ ...current, [question.id]: { ...timer, submitted: true } }));
    }
  }, [question, timer, timerExpired]);

  const setAnswer = (value: PreviewAnswer | undefined) => {
    if (!question) return;
    setPreview((current) => {
      const answers = { ...current.answers };
      if (value === undefined) delete answers[question.id];
      else answers[question.id] = value;
      return { ...current, answers };
    });
    setValidationError("");
  };
  const selectSingle = (option: AdminQuestionOption) => {
    setAnswer(option.id);
    if (option.outcome === "close") setCloseOption(true);
  };
  const toggleMulti = (optionId: string) => {
    const selected = Array.isArray(answer) ? answer : [];
    setAnswer(selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]);
  };
  const setNumeric = (field: keyof NumericAnswer, value: string | boolean) => {
    const current = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
    setAnswer({ ...current, [field]: value });
  };
  const setOpenResponse = (value: string) => {
    const limit = openConfig?.wordLimit;
    const next = limit && countPreviewWords(value) > limit ? trimPreviewWords(value, limit) : value;
    setAnswer(next);
  };
  const startResponse = () => {
    if (!question || !openConfig) return;
    const startedAt = Date.now();
    const durationSec = openConfig.timeLimitSec ?? 0;
    setTimers((current) => ({
      ...current,
      [question.id]: { startedAt, expiresAt: startedAt + durationSec * 1000, submitted: false },
    }));
    setTimeout(() => document.getElementById("preview-response")?.focus(), 0);
  };
  const resetResponse = () => {
    setAnswer(undefined);
    if (question)
      setTimers((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
    setCloseOption(false);
  };

  const continuePreview = () => {
    if (!question) return;
    if (question.type === "MULTI" && (!Array.isArray(answer) || answer.length === 0)) {
      setValidationError("Select at least one option before continuing.");
      return;
    }
    if (question.type === "NUMERIC") {
      const numericAnswer = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
      if (question.config.numericConfig?.mode === "calendarYearExperience") {
        if (
          !numericAnswer.never &&
          (!numericAnswer.year ||
            !/^\d{4}$/.test(numericAnswer.year) ||
            Number(numericAnswer.year) > new Date().getFullYear() ||
            Number(numericAnswer.year) < 1900)
        ) {
          setValidationError(
            "Enter a sensible four-digit calendar year, or select the alternative response.",
          );
          return;
        }
      } else if (
        !numericAnswer.target ||
        !numericAnswer.actual ||
        Number(numericAnswer.target) <= 0 ||
        Number(numericAnswer.actual) < 0
      ) {
        setValidationError(
          "Enter both figures. Target must be greater than zero and actual delivered cannot be negative.",
        );
        return;
      }
    }
    if (question.type === "OPEN") {
      if ((typeof answer !== "string" || !answer.trim()) && !timerExpired) {
        setValidationError(
          openConfig?.timeLimitSec
            ? "Start your response and enter an answer before continuing."
            : "Enter a response before continuing.",
        );
        return;
      }
      if (timer && !timer.submitted && !timerExpired)
        setTimers((current) => ({ ...current, [question.id]: { ...timer, submitted: true } }));
    }
    if (questionIndex >= questions.length - 1) {
      setPreview((current) => ({ ...current, currentQuestionIndex: questions.length }));
      return;
    }
    setPreview((current) => ({ ...current, currentQuestionIndex: questionIndex + 1 }));
    setValidationError("");
    setPasteNotice("");
  };
  const moveTo = (index: number) => {
    setPreview((current) => ({ ...current, currentQuestionIndex: index }));
    setValidationError("");
    setPasteNotice("");
    setCloseOption(false);
  };
  const restart = () => {
    setPreview(EMPTY_PREVIEW_STATE);
    setTimers({});
    setRubricRatings({});
    setIntegrityStatuses({});
    setBonusConfirmed({});
    setCloseOption(false);
    setValidationError("");
  };

  if (!allowed) return null;

  // Loading state — do not render stale question composition.
  if (previewState.status === "loading") {
    return (
      <div className="min-h-screen bg-portal-surface">
        <PreviewBanner name="Assessment Preview" slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
        <ApplicationShell activeStep={3}>
          <section className="mx-auto max-w-[800px] py-12">
            <DataLoadingState label="Loading assessment preview" />
          </section>
        </ApplicationShell>
      </div>
    );
  }

  // Error state.
  if (previewState.status === "error") {
    return (
      <div className="min-h-screen bg-portal-surface">
        <PreviewBanner name="Assessment Preview" slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
        <ApplicationShell activeStep={3}>
          <section className="mx-auto max-w-[800px] py-12">
            <DataErrorState
              message={previewState.error ?? "Unable to load this assessment."}
              onRetry={previewState.reload}
            />
          </section>
        </ApplicationShell>
      </div>
    );
  }

  // Not found.
  if (!previewState.data) {
    return (
      <div className="min-h-screen bg-portal-surface">
        <PreviewBanner name="Assessment Preview" slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
        <ApplicationShell activeStep={3}>
          <section className="mx-auto max-w-[800px] py-6">
            <div className="rounded-xl border border-border bg-white p-6">
              <h1 className="text-2xl font-semibold text-primary">Assessment not found</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The requested assessment could not be found.
              </p>
            </div>
          </section>
        </ApplicationShell>
      </div>
    );
  }

  // No questions assigned.
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-portal-surface">
        <PreviewBanner name={assessmentName} slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
        <ApplicationShell activeStep={3}>
          <section className="mx-auto max-w-[800px] py-6">
            <div className="rounded-xl border border-border bg-white p-6">
              <h1 className="text-2xl font-semibold text-primary">Preview unavailable</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The draft assessment has no assigned questions.
              </p>
            </div>
          </section>
        </ApplicationShell>
      </div>
    );
  }

  // Completed state.
  if (questionIndex >= questions.length) {
    return (
      <div className="min-h-screen bg-portal-surface">
        <PreviewBanner name={assessmentName} slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
        <ApplicationShell activeStep={3}>
          <section className="mx-auto max-w-[900px] space-y-6 py-6">
            <div className="rounded-xl border border-border bg-white p-6 text-center sm:p-10">
              <p className="section-kicker">Preview complete</p>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-primary">
                Candidate experience preview completed
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                This was a preview-only run. No applicant record was created, no live assessment was
                changed, and the draft remains inactive.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <FoundationButton onClick={restart} variant="secondary">
                  <RotateCcw className="size-4" />Restart preview
                </FoundationButton>
                <FoundationButton onClick={() => setLocation(`/admin/assessments/${exitSlug}`)}>
                  Exit preview
                </FoundationButton>
              </div>
            </div>
            <ScoringPreview
              questions={questions}
              preview={preview}
              result={scoring}
              modifiers={modifiers}
              rubricRatings={rubricRatings}
              integrityStatuses={integrityStatuses}
              bonusConfirmed={bonusConfirmed}
              onSaveRating={(questionId, rating) =>
                setRubricRatings((current) => ({ ...current, [questionId]: rating }))
              }
              onSetIntegrityStatus={(flagId, status) =>
                setIntegrityStatuses((current) => ({ ...current, [flagId]: status }))
              }
              onSetBonusConfirmed={(bonusId, confirmed) =>
                setBonusConfirmed((current) => ({ ...current, [bonusId]: confirmed }))
              }
            />
          </section>
        </ApplicationShell>
      </div>
    );
  }

  const selectedSingle = typeof answer === "string" ? answer : "";
  const selectedMulti = Array.isArray(answer) ? answer : [];
  const numericAnswer = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  const remaining = timer ? Math.ceil((timer.expiresAt - now) / 1000) : 0;

  return (
    <div className="min-h-screen bg-portal-surface text-foreground">
      <PreviewBanner name={assessmentName} slug={exitSlug} onExit={() => setLocation(`/admin/assessments/${exitSlug}`)} />
      <ApplicationShell activeStep={3}>
        <section className="mx-auto max-w-[800px] py-3 sm:py-6">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <p className="text-sm font-semibold text-primary">{assessmentName}</p>
            <p className="shrink-0 text-sm font-medium text-muted-foreground">
              Question {questionIndex + 1} of {questions.length}
            </p>
          </div>
          <div
            aria-label={`Question ${questionIndex + 1} of ${questions.length}`}
            aria-valuemax={questions.length}
            aria-valuemin={1}
            aria-valuenow={questionIndex + 1}
            className="mt-4 h-1 overflow-hidden rounded-full bg-border"
            role="progressbar"
          >
            <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <article className="mt-7 rounded-xl border border-border bg-white p-6 shadow-none sm:p-8">
            <h1 className="text-xl font-semibold leading-8 tracking-[-0.025em] text-primary sm:text-2xl">
              {question.question}
            </h1>
            {question.type === "MULTI" && (
              <p className="mt-3 text-sm text-muted-foreground">Select all that apply.</p>
            )}
            {question.type === "OPEN" && (
              <div className="mt-5 rounded-lg border border-[#d9e5f0] bg-[#f7fafc] p-4">
                <p className="text-sm font-semibold text-primary">Timed written response</p>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                  You will have {openConfig?.timeLimitSec ?? 0} seconds to answer this question.
                </p>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                  Pasting is disabled for this response.
                  {openConfig?.wordLimit ? ` Maximum ${openConfig.wordLimit} words.` : ""}
                </p>
              </div>
            )}
            {(isSingleSelect(question) || question.type === "MULTI") && (
              <div
                aria-label="Answer options"
                className="mt-7 space-y-3"
                role={question.type === "MULTI" ? "group" : "radiogroup"}
              >
                {questionOptions(question).map((option) => (
                  <SelectRow
                    key={option.id}
                    multi={question.type === "MULTI"}
                    onClick={() =>
                      question.type === "MULTI" ? toggleMulti(option.id) : selectSingle(option)
                    }
                    option={option}
                    selected={
                      question.type === "MULTI"
                        ? selectedMulti.includes(option.id)
                        : selectedSingle === option.id
                    }
                  />
                ))}
              </div>
            )}
            {question.type === "NUMERIC" && (
              <div className="mt-7 space-y-5">
                {question.config.numericConfig?.mode === "calendarYearExperience" ? (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-primary" htmlFor="preview-calendar-year">
                        Calendar year
                      </label>
                      <FoundationInput
                        disabled={Boolean(numericAnswer.never)}
                        id="preview-calendar-year"
                        inputMode="numeric"
                        max={String(new Date().getFullYear())}
                        onChange={(e) => setNumeric("year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="YYYY"
                        value={numericAnswer.year ?? ""}
                      />
                    </div>
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <input
                        checked={Boolean(numericAnswer.never)}
                        className="mt-1 size-4 accent-[#16263D]"
                        onChange={(e) => setNumeric("never", e.target.checked)}
                        type="checkbox"
                      />
                      <span>I have never personally carried a new-business target</span>
                    </label>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-primary" htmlFor="preview-target">
                        Target
                      </label>
                      <FoundationInput
                        id="preview-target"
                        inputMode="decimal"
                        min="0"
                        onChange={(e) => setNumeric("target", e.target.value.replace(/[^0-9.]/g, ""))}
                        value={numericAnswer.target ?? ""}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-primary" htmlFor="preview-actual">
                        Actual delivered
                      </label>
                      <FoundationInput
                        id="preview-actual"
                        inputMode="decimal"
                        min="0"
                        onChange={(e) => setNumeric("actual", e.target.value.replace(/[^0-9.]/g, ""))}
                        value={numericAnswer.actual ?? ""}
                      />
                    </div>
                    <p className="text-[13px] text-muted-foreground">Enter both figures on the same basis.</p>
                  </>
                )}
              </div>
            )}
            {question.type === "OPEN" && (
              <div className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-primary" htmlFor="preview-response">
                    Your response
                  </label>
                  {timer && !responseLocked && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Clock3 className="size-4" />
                      {formatPreviewRemaining(remaining)} remaining
                    </span>
                  )}
                </div>
                <FoundationTextarea
                  disabled={!timer || responseLocked}
                  id="preview-response"
                  onChange={(e) => setOpenResponse(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    setPasteNotice("Pasting is disabled for this question.");
                  }}
                  value={typeof answer === "string" ? answer : ""}
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                  <span>
                    {openConfig?.wordLimit
                      ? `${countPreviewWords(typeof answer === "string" ? answer : "")} / ${openConfig.wordLimit} words`
                      : "Your response is saved locally for this preview."}
                  </span>
                  {pasteNotice && (
                    <span className="text-status-error-strong" role="alert">
                      {pasteNotice}
                    </span>
                  )}
                </div>
                {timerExpired && (
                  <p className="mt-3 text-[13px] font-medium text-[#765d22]" role="status">
                    Time ended. Your response has been saved.
                  </p>
                )}
                <div className="mt-5">
                  {!timer ? (
                    <FoundationButton onClick={startResponse}>Start response</FoundationButton>
                  ) : timer.submitted || timerExpired ? (
                    <FoundationButton onClick={continuePreview}>Continue preview</FoundationButton>
                  ) : (
                    <FoundationButton onClick={continuePreview}>Save response and continue</FoundationButton>
                  )}
                </div>
              </div>
            )}
            {validationError && (
              <p className="mt-4 text-[13px] text-status-error-strong" role="alert">
                {validationError}
              </p>
            )}
            {question.type !== "OPEN" && (
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {questionIndex > 0 && (
                    <FoundationButton onClick={() => moveTo(questionIndex - 1)} variant="secondary">
                      Previous
                    </FoundationButton>
                  )}
                </div>
                <FoundationButton onClick={continuePreview} size="lg">
                  {questionIndex === questions.length - 1 ? "Complete preview" : "Continue preview"}
                </FoundationButton>
              </div>
            )}
          </article>
          <nav aria-label="Assessment question navigator" className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {questions.map((item, index) => {
              const answered = item.id in preview.answers;
              const current = index === questionIndex;
              const reachable = index <= questionIndex || answered;
              return (
                <button
                  aria-current={current ? "step" : undefined}
                  aria-label={`Question ${index + 1}${answered ? ", answered" : ""}`}
                  className={`flex size-8 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${current ? "border-primary bg-primary text-white" : answered ? "border-portal-blue bg-portal-blue-soft text-primary" : "border-border bg-white text-muted-foreground"}`}
                  disabled={!reachable}
                  key={item.id}
                  onClick={() => moveTo(index)}
                  type="button"
                >
                  {answered && !current ? <Check className="size-3.5" /> : index + 1}
                </button>
              );
            })}
          </nav>
        </section>
      </ApplicationShell>
      {closeOption && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-[0_16px_48px_rgba(16,24,40,0.18)]">
            <p className="section-kicker">Preview-only response state</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-primary">
              Close application response selected
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              In the live assessment, this response would close the application under the relevant
              eligibility rule.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <FoundationButton onClick={resetResponse} variant="secondary">
                Reset response
              </FoundationButton>
              <FoundationButton onClick={() => setCloseOption(false)}>Continue preview</FoundationButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scoring Preview (Admin-only panel) ────────────────────────────────────────
//
// Temporary scoring boundary: v2BaseScoring and v2ModifierScoring consume the
// QuestionBankQuestion shape via the toPreviewQuestion() adapter above. The
// scoring engine is intentionally NOT migrated in Task 24C-3.

function ScoringPreview({
  questions,
  preview,
  result,
  modifiers,
  rubricRatings,
  integrityStatuses,
  bonusConfirmed,
  onSaveRating,
  onSetIntegrityStatus,
  onSetBonusConfirmed,
}: {
  questions: readonly QuestionBankQuestion[];
  preview: PreviewState;
  result: ReturnType<typeof calculateV2BaseAssessmentScore>;
  modifiers: V2ModifierResult;
  rubricRatings: V2RubricRatings;
  integrityStatuses: Record<string, V2IntegrityStatus>;
  bonusConfirmed: Record<string, boolean>;
  onSaveRating: (questionId: string, rating: number) => void;
  onSetIntegrityStatus: (flagId: string, status: V2IntegrityStatus) => void;
  onSetBonusConfirmed: (bonusId: string, confirmed: boolean) => void;
}) {
  const openQuestions = questions.filter((q) => q.type === "OPEN");
  const [draftRatings, setDraftRatings] = useState<V2RubricRatings>(rubricRatings);

  return (
    <section
      aria-labelledby="scoring-preview-title"
      className="rounded-xl border border-border bg-white p-6 sm:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">Admin-only workspace</p>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-primary" id="scoring-preview-title">
            Scoring Preview
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Weighted score before verification, integrity adjustments and decision rules.
          </p>
        </div>
        {result.scoringReady ? (
          <div className="rounded-lg bg-portal-blue-soft px-4 py-3 text-right">
            <p className="text-[12px] font-medium text-muted-foreground">Base Assessment Score</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{result.baseAssessmentScore}%</p>
          </div>
        ) : (
          <div className="rounded-lg bg-[#fff8e8] px-4 py-3 text-right">
            <p className="text-[12px] font-semibold text-[#765d22]">Base score unavailable</p>
            <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-[#765d22]">
              {result.reasonUnavailable}
            </p>
          </div>
        )}
      </div>
      <V2ModifierPanel
        result={modifiers}
        onSetIntegrityStatus={onSetIntegrityStatus}
        onSetBonusConfirmed={onSetBonusConfirmed}
      />
      <div className="mt-7 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Dimension</th>
              <th className="pb-3 pr-4 text-right font-medium">Score</th>
              <th className="pb-3 pr-4 text-right font-medium">Weight</th>
              <th className="pb-3 text-right font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {result.dimensionResults.map((dimension) => (
              <tr className="border-b border-border last:border-0" key={dimension.dimensionId}>
                <td className="py-3 pr-4">
                  <details>
                    <summary className="cursor-pointer font-medium text-primary">
                      {dimension.dimensionId} · {dimension.dimensionName}
                    </summary>
                    <div className="mt-3 space-y-2 rounded-lg bg-portal-surface p-3">
                      {dimension.questionResults.length ? (
                        dimension.questionResults.map((item) => (
                          <div className="grid grid-cols-[1fr_auto] gap-3 text-[12px]" key={item.questionId}>
                            <span className="text-muted-foreground">
                              {item.reference} · {item.type}
                            </span>
                            <span className="text-right font-medium text-primary">
                              {item.scoringState === "scored"
                                ? `${item.rawScore} / ${item.maxScore} · qWeight ${item.qWeight}`
                                : item.reason ?? item.scoringState}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[12px] text-muted-foreground">No scored questions assigned.</p>
                      )}
                    </div>
                  </details>
                </td>
                <td className="py-3 pr-4 text-right font-medium text-primary">
                  {dimension.score === undefined ? "—" : `${dimension.score}%`}
                </td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{dimension.weight}%</td>
                <td className="py-3 text-right font-medium text-primary">
                  {dimension.contribution === undefined
                    ? "—"
                    : `${dimension.contribution.toFixed(1)} / ${dimension.weight}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.unresolvedItems.length > 0 && (
        <div className="mt-5 rounded-lg border border-[#ead9b2] bg-[#fffaf0] p-4">
          <p className="text-sm font-semibold text-[#765d22]">Items awaiting resolution</p>
          <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[#765d22]">
            {result.unresolvedItems.map((item, index) => (
              <li key={`${item.reference ?? "item"}-${index}`}>
                {item.reference ? `${item.reference}: ` : ""}
                {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {openQuestions.length > 0 && (
        <div className="mt-7 border-t border-border pt-6">
          <h3 className="text-base font-semibold text-primary">OPEN question review</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Temporary manual rating for scoring-engine validation. This control is not shown to applicants.
          </p>
          <div className="mt-4 space-y-4">
            {openQuestions.map((question) => {
              const rating = draftRatings[question.id];
              const response = preview.answers[question.id];
              return (
                <div className="rounded-lg border border-border p-4" key={question.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-primary">{question.reference}</p>
                      <p className="mt-1 text-sm font-medium text-primary">
                        {typeof response === "string" && response.trim()
                          ? response
                          : "No preview response recorded."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className="text-[12px] font-medium text-muted-foreground"
                        htmlFor={`rubric-${question.id}`}
                      >
                        Rubric score
                      </label>
                      <select
                        className="h-9 rounded-md border border-input bg-white px-2 text-sm text-primary"
                        id={`rubric-${question.id}`}
                        onChange={(e) =>
                          setDraftRatings((current) => ({
                            ...current,
                            [question.id]:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        value={rating ?? ""}
                      >
                        <option value="">Not rated</option>
                        {[0, 1, 2, 3, 4, 5].map((score) => (
                          <option key={score} value={score}>
                            {score} / 5
                          </option>
                        ))}
                      </select>
                      <FoundationButton
                        disabled={typeof rating !== "number"}
                        onClick={() => {
                          if (typeof rating === "number") onSaveRating(question.id, rating);
                        }}
                        size="sm"
                      >
                        Save rating
                      </FoundationButton>
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12px] font-medium text-portal-blue">
                      View configured rubric anchors
                    </summary>
                    <div className="mt-2 space-y-2 text-[12px] leading-5 text-muted-foreground">
                      {question.config.openConfig?.rubric.map((anchor) => (
                        <p key={anchor.id}>
                          <span className="font-semibold text-primary">{anchor.points}/5:</span>{" "}
                          {anchor.anchor}
                        </p>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
