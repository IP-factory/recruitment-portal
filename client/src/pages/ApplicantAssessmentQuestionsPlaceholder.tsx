/**
 * Task 24D-1 — real assessment questions page with database persistence.
 *
 * Loads applicant-safe questions from TiDB, saves responses to the server
 * on each answer, supports one-at-a-time navigation, OPEN timers, and
 * refresh/resume.
 *
 * Task 24F: saving is fully backgrounded. Inputs are never disabled while a
 * save is in flight; OPEN answers are debounced with latest-value-wins
 * ordering via the autosave controller, and Next only flushes pending saves.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton, FoundationInput } from "@/components/foundation/ui";
import {
  fetchLiveAssessment,
  saveAssessmentResponse,
  startOpenTimer,
  completeAssessment,
  ApplicationApiError,
  type ApplicantSafeQuestion,
  type SaveAssessmentResponseInput,
} from "@/lib/applicationApi";
import { createAutosaveController, type AutosaveController, type AutosavePhase } from "@/lib/assessmentAutosave";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

// ── Response state ─────────────────────────────────────────────────────────

type ResponseState = Record<string, unknown>;

export default function ApplicantAssessmentQuestionsPlaceholder() {
  const [, setLocation] = useLocation();
  const [questions, setQuestions] = useState<ApplicantSafeQuestion[]>([]);
  const [responses, setResponses] = useState<ResponseState>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [savePhase, setSavePhase] = useState<AutosavePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Background autosave: never blocks inputs, debounces OPEN typing, and
  // always persists the latest value last (stale responses cannot win).
  const controllerRef = useRef<AutosaveController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createAutosaveController({
      debounceMs: 700,
      onPhaseChange: setSavePhase,
      save: async (questionId, payload) => {
        const result = await saveAssessmentResponse(questionId, payload as SaveAssessmentResponseInput);
        if (result.closed) setLocation("/apply/business-development-officer/eligibility");
      },
    });
  }
  const controller = controllerRef.current;

  useEffect(() => () => controller.cancel(), [controller]);

  // Load assessment from database
  useEffect(() => {
    fetchLiveAssessment()
      .then((data) => {
        if (data.completed) {
          setLocation("/apply/business-development-officer/review");
          return;
        }
        setQuestions(data.questions);
        // Initialize responses from existing progress if available
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApplicationApiError && (err.status === 401 || err.status === 403)) {
          setLocation("/apply/business-development-officer/information");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load your assessment.");
        setLoading(false);
      });
  }, [setLocation]);

  const question = questions[currentIndex];
  const totalQuestions = questions.length;

  // ── OPEN timer management ──────────────────────────────────────────────────

  const startTimerForQuestion = useCallback(async (q: ApplicantSafeQuestion) => {
    if (q.type !== "OPEN" || !q.timeLimitSec) { setTimerRemaining(null); return; }
    if (q.timerStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(q.timerStartedAt).getTime()) / 1000);
      const remaining = Math.max(0, q.timeLimitSec - elapsed);
      setTimerRemaining(remaining);
    } else {
      try {
        const result = await startOpenTimer(q.id);
        if (result.timerStartedAt) {
          setTimerRemaining(q.timeLimitSec);
        }
      } catch { /* ignore timer start failure */ }
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!question || question.type !== "OPEN" || !question.timeLimitSec) return;

    startTimerForQuestion(question);
    timerRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev === null || prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [question, startTimerForQuestion]);

  // ── Response handling ──────────────────────────────────────────────────────

  // Every handler updates local state immediately and persists in the
  // background; the UI is never disabled while a save is in flight.

  const selectOption = (optionId: string) => {
    if (!question) return;
    setValidationError("");
    setResponses({ ...responses, [question.id]: optionId });
    controller.saveNow(question.id, { responseType: question.type as "ORDINAL" | "SJT" | "EVIDENCE", responsePayload: optionId });
  };

  const selectMultiOptions = (optionId: string) => {
    if (!question) return;
    setValidationError("");
    const current = Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : [];
    const updated = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
    setResponses({ ...responses, [question.id]: updated });
    controller.saveNow(question.id, { responseType: "MULTI", responsePayload: updated });
  };

  const saveNumericResponse = (values: Record<string, string>) => {
    if (!question) return;
    setValidationError("");
    setResponses({ ...responses, [question.id]: values });
    controller.saveNow(question.id, { responseType: "NUMERIC", responsePayload: values });
  };

  // OPEN drafts are debounced by the controller; typing never triggers a
  // request per keystroke and the latest text always wins.
  const draftOpenResponse = (text: string) => {
    if (!question || question.type !== "OPEN") return;
    if (question.maximumWords) {
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > question.maximumWords) {
        setValidationError(`Response exceeds the ${question.maximumWords}-word limit.`);
        return;
      }
    }
    setValidationError("");
    setResponses({ ...responses, [question.id]: text });
    controller.schedule(question.id, { responseType: "OPEN", responsePayload: text });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const moveTo = (index: number) => { setCurrentIndex(index); setValidationError(""); };

  const nextQuestion = async () => {
    if (!question) return;
    const currentResponse = responses[question.id];
    const hasResponse = currentResponse !== undefined && currentResponse !== null && currentResponse !== "" && !(Array.isArray(currentResponse) && currentResponse.length === 0);
    if (!hasResponse) { setValidationError("Please provide an answer before continuing."); return; }

    // Next is never disabled by network latency; it only flushes outstanding
    // background saves. An actual save failure keeps the answer local and
    // reports it instead of silently moving on.
    await controller.flush();
    if (controller.failedQuestionIds().length > 0) {
      setValidationError("Your answer could not be saved yet. Please try again.");
      return;
    }

    if (currentIndex === totalQuestions - 1) {
      // Complete the assessment
      setCompleting(true);
      try {
        await completeAssessment();
        setLocation("/apply/business-development-officer/assessment/complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to complete your assessment.");
      } finally {
        setCompleting(false);
      }
      return;
    }
    moveTo(currentIndex + 1);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <ApplicationShell activeStep={2}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading your assessment...</div></section></ApplicationShell>;
  }

  if (error) {
    return <ApplicationShell activeStep={2}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="rounded-xl border border-border bg-white p-6 sm:p-8"><div className="flex items-center gap-2 text-status-error-strong"><AlertCircle className="size-5" /><p>{error}</p></div><FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-officer/assessment")} variant="secondary">Back to assessment</FoundationButton></div></section></ApplicationShell>;
  }

  if (!question) {
    return <ApplicationShell activeStep={2}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="rounded-xl border border-border bg-white p-6 sm:p-8"><p className="section-kicker">Assessment</p><h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-primary">Assessment questions are not available</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">There are no questions assigned to this assessment at present.</p><FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-officer/information")} variant="secondary">Return to application</FoundationButton></div></section></ApplicationShell>;
  }

  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const timerExpired = question.type === "OPEN" && question.timeLimitSec && timerRemaining !== null && timerRemaining <= 0;

  return <ApplicationShell activeStep={2}>
    <section className="mx-auto max-w-[800px] py-3 sm:py-6">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="text-sm font-semibold text-primary">Business Development Assessment</p>
        <p className="shrink-0 text-sm font-medium text-muted-foreground">Question {currentIndex + 1} of {totalQuestions}</p>
      </div>
      <div aria-label={`Question ${currentIndex + 1} of ${totalQuestions}`} aria-valuemax={totalQuestions} aria-valuemin={1} aria-valuenow={currentIndex + 1} className="mt-4 h-1 overflow-hidden rounded-full bg-border" role="progressbar">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progressPercent}%` }} />
      </div>

      <article className="mt-7 rounded-xl border border-border bg-white p-6 shadow-none sm:p-8">
        <p className="section-kicker">{question.type}</p>
        <h1 className="mt-4 text-xl font-semibold leading-8 tracking-[-0.025em] text-primary sm:text-2xl">{question.prompt}</h1>

        {/* Timer for OPEN questions */}
        {question.type === "OPEN" && question.timeLimitSec && timerRemaining !== null && (
          <div className={`mt-4 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${timerRemaining <= 30 ? "bg-status-error-soft text-status-error-strong" : "bg-portal-blue-soft text-primary"}`}>
            Time remaining: {Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, "0")}
          </div>
        )}

        {/* Question type renderers */}
        {(question.type === "ORDINAL" || question.type === "SJT" || question.type === "EVIDENCE") && (
          <QuestionOptionsRenderer
            question={question}
            selectedId={typeof responses[question.id] === "string" ? (responses[question.id] as string) : undefined}
            onSelect={selectOption}
            disabled={timerExpired === true}
          />
        )}

        {question.type === "MULTI" && (
          <QuestionMultiRenderer
            question={question}
            selectedIds={Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : []}
            onToggle={selectMultiOptions}
            disabled={timerExpired === true}
          />
        )}

        {question.type === "NUMERIC" && (
          <QuestionNumericRenderer
            question={question}
            values={(responses[question.id] as Record<string, string>) ?? {}}
            onSave={saveNumericResponse}
            disabled={timerExpired === true}
          />
        )}

        {question.type === "OPEN" && (
          <QuestionOpenRenderer
            question={question}
            value={typeof responses[question.id] === "string" ? (responses[question.id] as string) : ""}
            onDraft={draftOpenResponse}
            disabled={timerExpired === true}
            pasteAllowed={question.pasteAllowed}
          />
        )}

        {savePhase === "saving" || savePhase === "pending" ? <p className="mt-4 text-[13px] text-muted-foreground" role="status">Saving…</p> : null}
        {savePhase === "error" ? <p className="mt-4 text-[13px] text-status-error-strong" role="alert">Your last answer could not be saved. It will be saved again automatically — you can keep answering.</p> : null}
        {validationError ? <p className="mt-4 text-[13px] text-status-error-strong" role="alert">{validationError}</p> : null}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>{currentIndex > 0 ? <FoundationButton className="w-full sm:w-auto" onClick={() => moveTo(currentIndex - 1)} variant="secondary">Previous</FoundationButton> : null}</div>
          <FoundationButton className="w-full sm:w-auto" disabled={completing} onClick={nextQuestion} size="lg">
            {completing ? "Completing..." : currentIndex === totalQuestions - 1 ? "Complete assessment" : "Next"}
          </FoundationButton>
        </div>
      </article>

      {/* Question navigator */}
      <nav aria-label="Assessment question navigator" className="mt-6 flex items-center justify-center gap-2">
        {questions.map((q, index) => {
          const answered = responses[q.id] !== undefined && responses[q.id] !== null && responses[q.id] !== "" && !(Array.isArray(responses[q.id]) && (responses[q.id] as unknown[]).length === 0);
          const current = index === currentIndex;
          return (
            <button
              aria-current={current ? "step" : undefined}
              aria-label={`Question ${index + 1}${answered ? ", answered" : ""}`}
              className={`flex size-8 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${current ? "border-primary bg-primary text-white" : answered ? "border-portal-blue bg-portal-blue-soft text-primary" : "border-border bg-white text-muted-foreground"}`}
              key={q.id}
              onClick={() => moveTo(index)}
              type="button"
            >
              {answered && !current ? <Check className="size-3.5" /> : index + 1}
            </button>
          );
        })}
      </nav>
    </section>
  </ApplicationShell>;
}

// ── Question type renderers ──────────────────────────────────────────────────

function QuestionOptionsRenderer({ question, selectedId, onSelect, disabled }: {
  question: Extract<ApplicantSafeQuestion, { type: "ORDINAL" | "SJT" | "EVIDENCE" }>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const labels = "ABCDEFGHIJKLMNOP";
  return (
    <div aria-label="Answer options" className="mt-7 space-y-3" role="radiogroup">
      {question.options.map((option, i) => {
        const selected = selectedId === option.id;
        return (
          <button
            aria-checked={selected}
            className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue/30 ${selected ? "border-primary bg-portal-blue-soft" : "border-input bg-white hover:border-portal-blue"} ${disabled ? "opacity-60" : ""}`}
            disabled={disabled}
            key={option.id}
            onClick={() => onSelect(option.id)}
            role="radio"
            type="button"
          >
            <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${selected ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}>{selected ? <Check className="size-3.5" /> : labels[i] ?? i + 1}</span>
            <span className="min-w-0 text-sm leading-6 text-foreground">{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function QuestionMultiRenderer({ question, selectedIds, onToggle, disabled }: {
  question: Extract<ApplicantSafeQuestion, { type: "MULTI" }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const labels = "ABCDEFGHIJKLMNOP";
  return (
    <div aria-label="Select all that apply" className="mt-7 space-y-3">
      <p className="text-[13px] text-muted-foreground">Select all that apply</p>
      {question.options.map((option, i) => {
        const selected = selectedIds.includes(option.id);
        return (
          <button
            aria-pressed={selected}
            className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue/30 ${selected ? "border-primary bg-portal-blue-soft" : "border-input bg-white hover:border-portal-blue"} ${disabled ? "opacity-60" : ""}`}
            disabled={disabled}
            key={option.id}
            onClick={() => onToggle(option.id)}
            type="button"
          >
            <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${selected ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}>{selected ? <Check className="size-3.5" /> : labels[i] ?? i + 1}</span>
            <span className="min-w-0 text-sm leading-6 text-foreground">{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function QuestionNumericRenderer({ question, values, onSave, disabled }: {
  question: Extract<ApplicantSafeQuestion, { type: "NUMERIC" }>;
  values: Record<string, string>;
  onSave: (values: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(values);
  useEffect(() => { setLocalValues(values); }, [values]);

  return (
    <div className="mt-7 space-y-4">
      {question.inputLabels.map((label) => (
        <div key={label}>
          <label className="mb-1.5 block text-sm font-medium text-primary">{label}</label>
          <FoundationInput
            disabled={disabled}
            onChange={(e) => {
              const updated = { ...localValues, [label]: e.target.value };
              setLocalValues(updated);
            }}
            onBlur={() => onSave(localValues)}
            placeholder={`Enter ${label.toLowerCase()}`}
            type="number"
            value={localValues[label] ?? ""}
          />
        </div>
      ))}
    </div>
  );
}

function QuestionOpenRenderer({ question, value, onDraft, disabled, pasteAllowed }: {
  question: Extract<ApplicantSafeQuestion, { type: "OPEN" }>;
  value: string;
  onDraft: (text: string) => void;
  disabled: boolean;
  pasteAllowed: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);

  const wordCount = localValue.trim().split(/\s+/).filter(Boolean).length;
  const maxWords = question.maximumWords;

  // Typing stays local and immediate; persistence is debounced upstream by
  // the autosave controller, so the textarea is never disabled by saving.
  const handleChange = (text: string) => {
    setLocalValue(text);
    onDraft(text);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!pasteAllowed) e.preventDefault();
  };

  return (
    <div className="mt-7">
      <textarea
        className={`w-full rounded-lg border border-input bg-white px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue/30 ${disabled ? "opacity-60" : ""}`}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={handlePaste}
        placeholder="Type your response here..."
        rows={6}
        value={localValue}
      />
      {maxWords ? (
        <p className={`mt-2 text-[12px] ${wordCount > maxWords ? "text-status-error-strong" : "text-muted-foreground"}`}>
          {wordCount} / {maxWords} words {maxWords && wordCount > maxWords ? "(exceeded)" : ""}
        </p>
      ) : null}
    </div>
  );
}
