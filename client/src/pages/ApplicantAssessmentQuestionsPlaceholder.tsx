/**
 * Quiet Authority assessment questions: one focused question at a time, using the Admin-assigned score-free question list with locally retained responses.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { emptyAssessmentResponseState, getApplicantBusinessDevelopmentAssessmentQuestions, loadAssessmentResponseState, saveAssessmentResponseState, type AssessmentResponseState } from "@/lib/assessmentData";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function ApplicantAssessmentQuestionsPlaceholder() {
  const [, setLocation] = useLocation();
  const [assessment, setAssessment] = useState<AssessmentResponseState>(emptyAssessmentResponseState);
  const [questions, setQuestions] = useState(() => getApplicantBusinessDevelopmentAssessmentQuestions());
  const [hydrated, setHydrated] = useState(false);
  const [validationError, setValidationError] = useState("");
  useEffect(() => { setQuestions(getApplicantBusinessDevelopmentAssessmentQuestions()); setAssessment(loadAssessmentResponseState()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveAssessmentResponseState(assessment); }, [assessment, hydrated]);

  const questionIndex = assessment.currentQuestionIndex;
  const currentQuestion = questions[questionIndex];
  const answeredIndexes = useMemo(() => questions.map((question, index) => assessment.answers[question.id] ? index : null).filter((index): index is number => index !== null), [assessment.answers, questions]);
  if (!currentQuestion) return <ApplicationShell activeStep={2}><section className="mx-auto max-w-[800px] py-3 sm:py-6"><div className="rounded-xl border border-border bg-white p-6 sm:p-8"><p className="section-kicker">Assessment</p><h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-primary">Assessment questions are not available</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">There are no questions assigned to this assessment at present. Please return to your application and try again later.</p><FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-manager")} variant="secondary">Return to application</FoundationButton></div></section></ApplicationShell>;

  const selectedOptionId = assessment.answers[currentQuestion.id];
  const progressPercent = ((questionIndex + 1) / questions.length) * 100;
  const selectAnswer = (optionId: string) => { setAssessment((current) => ({ ...current, answers: { ...current.answers, [currentQuestion.id]: optionId } })); setValidationError(""); };
  const moveTo = (index: number) => { setAssessment((current) => ({ ...current, currentQuestionIndex: index })); setValidationError(""); };
  const nextQuestion = () => {
    if (!selectedOptionId) { setValidationError("Select an answer before continuing."); return; }
    if (questionIndex === questions.length - 1) { saveAssessmentResponseState(assessment); setLocation("/apply/business-development-manager/assessment/complete"); return; }
    moveTo(questionIndex + 1);
  };

  return <ApplicationShell activeStep={2}>
    <section className="mx-auto max-w-[800px] py-3 sm:py-6">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4"><p className="text-sm font-semibold text-primary">Business Development Assessment</p><p className="shrink-0 text-sm font-medium text-muted-foreground">Question {questionIndex + 1} of {questions.length}</p></div>
      <div aria-label={`Question ${questionIndex + 1} of ${questions.length}`} aria-valuemax={questions.length} aria-valuemin={1} aria-valuenow={questionIndex + 1} className="mt-4 h-1 overflow-hidden rounded-full bg-border" role="progressbar"><div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progressPercent}%` }} /></div>
      <article className="mt-7 rounded-xl border border-border bg-white p-6 shadow-none sm:p-8">
        <p className="section-kicker">{currentQuestion.category}</p><h1 className="mt-4 text-xl font-semibold leading-8 tracking-[-0.025em] text-primary sm:text-2xl">{currentQuestion.question}</h1>
        <div aria-label="Answer options" className="mt-7 space-y-3" role="radiogroup">{currentQuestion.options.map((option) => { const selected = selectedOptionId === option.id; return <button aria-checked={selected} className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue/30 ${selected ? "border-primary bg-portal-blue-soft" : "border-input bg-white hover:border-portal-blue"}`} key={option.id} onClick={() => selectAnswer(option.id)} role="radio" type="button"><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${selected ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}>{selected ? <Check className="size-3.5" /> : option.label}</span><span className="min-w-0 text-sm leading-6 text-foreground">{option.text}</span></button>; })}</div>
        {validationError ? <p className="mt-4 text-[13px] text-status-error-strong" role="alert">{validationError}</p> : null}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><div>{questionIndex > 0 ? <FoundationButton className="w-full sm:w-auto" onClick={() => moveTo(questionIndex - 1)} variant="secondary">Previous</FoundationButton> : null}</div><FoundationButton className="w-full sm:w-auto" disabled={!hydrated} onClick={nextQuestion} size="lg">{questionIndex === questions.length - 1 ? "Complete assessment" : "Next"}</FoundationButton></div>
      </article>
      <nav aria-label="Assessment question navigator" className="mt-6 flex items-center justify-center gap-2">{questions.map((question, index) => { const answered = Boolean(assessment.answers[question.id]); const current = index === questionIndex; const allowed = index <= questionIndex || answered || answeredIndexes.includes(index); return <button aria-current={current ? "step" : undefined} aria-label={`Question ${index + 1}${answered ? ", answered" : ""}${!allowed ? ", unavailable" : ""}`} className={`flex size-8 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${current ? "border-primary bg-primary text-white" : answered ? "border-portal-blue bg-portal-blue-soft text-primary" : "border-border bg-white text-muted-foreground"} disabled:cursor-not-allowed disabled:opacity-70`} disabled={!allowed} key={question.id} onClick={() => moveTo(index)} type="button">{answered && !current ? <Check className="size-3.5" /> : index + 1}</button>; })}</nav>
    </section>
  </ApplicationShell>;
}
