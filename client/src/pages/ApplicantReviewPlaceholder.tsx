/**
 * Quiet Authority review and submit: a frontend-only case-file review of applicant, CV, and assessment data prior to local prototype completion.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton, StatusBadge } from "@/components/foundation/ui";
import { getApplicantBusinessDevelopmentAssessmentQuestions, loadAssessmentResponseState, type AssessmentResponseState } from "@/lib/assessmentData";
import { emptyApplicantInformation, loadApplicantInformation, loadCvFileMetadata, type ApplicantInformation, type CvFileMetadata } from "@/lib/applicationData";
import { getApplicationReadiness, loadApplicationSubmissionState, saveApplicationSubmissionState, type ApplicationReadiness } from "@/lib/submissionData";
import { AlertTriangle, Check, CheckCircle2, FileText, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function valueOrNotProvided(value: string) { return value.trim() || "Not provided"; }

function ReviewCard({ title, actionLabel, onAction, children, incomplete = false, completed = false }: { title: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode; incomplete?: boolean; completed?: boolean }) {
  return <section className={`rounded-xl border bg-white p-6 shadow-none sm:p-7 ${incomplete ? "border-[#eadfbd]" : "border-border"}`}><div className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 className="text-lg font-semibold tracking-[-0.02em] text-primary">{title}</h2>{incomplete ? <p className="mt-1 text-[13px] text-[#765d22]">This section needs attention before submission.</p> : null}</div>{completed ? <StatusBadge status="Completed" /> : actionLabel && onAction ? <button className="text-sm font-medium text-portal-blue hover:text-primary hover:underline" onClick={onAction} type="button">{actionLabel}</button> : null}</div>{children}</section>;
}

function DefinitionItem({ label, value }: { label: string; value: string }) { return <div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{value}</dd></div>; }

export default function ApplicantReviewPlaceholder() {
  const [, setLocation] = useLocation();
  const [applicant, setApplicant] = useState<ApplicantInformation>(emptyApplicantInformation);
  const [cvFile, setCvFile] = useState<CvFileMetadata | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponseState>({ answers: {}, currentQuestionIndex: 0 });
  const [questions, setQuestions] = useState(() => getApplicantBusinessDevelopmentAssessmentQuestions());
  const [readiness, setReadiness] = useState<ApplicationReadiness>({ applicantInformationComplete: false, cvComplete: false, assessmentComplete: false, ready: false });
  const [submitted, setSubmitted] = useState(false);
  const [declarationOne, setDeclarationOne] = useState(false);
  const [declarationTwo, setDeclarationTwo] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const refreshData = () => { setApplicant(loadApplicantInformation()); setCvFile(loadCvFileMetadata()); setQuestions(getApplicantBusinessDevelopmentAssessmentQuestions()); setAssessment(loadAssessmentResponseState()); setReadiness(getApplicationReadiness()); setSubmitted(loadApplicationSubmissionState().submitted); };
  useEffect(() => { refreshData(); }, []);
  const submit = () => { setAttempted(true); const latestReadiness = getApplicationReadiness(); setReadiness(latestReadiness); if (!latestReadiness.ready || !declarationOne || !declarationTwo) return; saveApplicationSubmissionState({ submitted: true }); setSubmitted(true); setLocation("/apply/business-development-manager/submitted"); };
  const assessedCount = questions.filter((question) => assessment.answers[question.id]).length;

  return (
    <ApplicationShell activeStep={3} showSummary submitted={submitted}>
      <section>
        <p className="section-kicker">Step 4 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">{submitted ? "Completed application" : "Review your application"}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">{submitted ? "This application has been completed in the current frontend prototype." : "Check the information below before submitting your application for the Business Development Manager role."}</p>
        {submitted ? <div className="alert-success mt-6 flex gap-3 rounded-lg border px-4 py-3.5"><CheckCircle2 className="mt-0.5 size-[18px] shrink-0" /><div><p className="text-sm font-semibold">Application completed</p><p className="mt-0.5 text-[13px] leading-5 opacity-85">This application has been completed in the current frontend prototype.</p></div></div> : !readiness.ready ? <div className="alert-warning mt-6 flex gap-3 rounded-lg border px-4 py-3.5"><AlertTriangle className="mt-0.5 size-[18px] shrink-0" /><div><p className="text-sm font-semibold">Your application is not ready to submit.</p><p className="mt-0.5 text-[13px] leading-5 opacity-85">Review the sections highlighted below.</p></div></div> : <div className="alert-info mt-6 flex gap-3 rounded-lg border px-4 py-3.5"><Info className="mt-0.5 size-[18px] shrink-0" /><p className="text-[13px] leading-5 opacity-85">You can return to any section to make changes before submitting.</p></div>}

        <div className="mt-8 space-y-5">
          <ReviewCard actionLabel="Edit" completed={submitted} incomplete={!readiness.applicantInformationComplete} onAction={() => setLocation("/apply/business-development-manager")} title="Applicant information">
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2"><DefinitionItem label="Full name" value={valueOrNotProvided(applicant.fullName)} /><DefinitionItem label="Email address" value={valueOrNotProvided(applicant.email)} /><DefinitionItem label="Phone number" value={valueOrNotProvided(applicant.phoneNumber)} /><DefinitionItem label="Current city / location" value={valueOrNotProvided(applicant.location)} /><DefinitionItem label="Current or most recent job title" value={valueOrNotProvided(applicant.jobTitle)} /><DefinitionItem label="Current or most recent employer" value={valueOrNotProvided(applicant.employer)} /><DefinitionItem label="Total professional experience" value={valueOrNotProvided(applicant.totalExperience)} /><DefinitionItem label="Business Development experience" value={valueOrNotProvided(applicant.businessDevelopmentExperience)} /><DefinitionItem label="LinkedIn profile" value={valueOrNotProvided(applicant.linkedInProfile)} /></dl>
            {!submitted && !readiness.applicantInformationComplete ? <FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-manager")} size="sm" variant="secondary">Complete information</FoundationButton> : null}
          </ReviewCard>
          <ReviewCard actionLabel="Edit" completed={submitted} incomplete={!readiness.cvComplete} onAction={() => setLocation("/apply/business-development-manager/cv")} title="CV">
            {cvFile ? <div className="mt-5 flex items-start gap-3 rounded-lg bg-portal-surface px-4 py-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{cvFile.name}</p><p className="mt-1 text-[13px] text-muted-foreground">{cvFile.type} · {cvFile.size < 1024 * 1024 ? `${Math.max(1, Math.round(cvFile.size / 1024))} KB` : `${(cvFile.size / (1024 * 1024)).toFixed(1)} MB`}</p><p className="mt-2 text-[12px] font-medium text-portal-blue">Selected for this application</p></div></div> : <div className="mt-5 text-sm text-muted-foreground">No CV selected.</div>}
            {!submitted && !readiness.cvComplete ? <FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-manager/cv")} size="sm" variant="secondary">Select CV</FoundationButton> : null}
          </ReviewCard>
          <ReviewCard actionLabel="Review responses" completed={submitted} incomplete={!readiness.assessmentComplete} onAction={() => setLocation("/apply/business-development-manager/assessment/questions")} title="Assessment">
            <div className="mt-5"><p className="text-sm font-semibold text-primary">Business Development Assessment</p><p className="mt-1 text-[13px] text-muted-foreground">{assessedCount} of {questions.length} questions answered</p></div>
            <div className="mt-5 divide-y divide-border border-y border-border">{questions.map((question, index) => { const option = question.options.find((entry) => entry.id === assessment.answers[question.id]); return <div className="py-5" key={question.id}><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-portal-blue">{String(index + 1).padStart(2, "0")} · {question.category}</p><p className="mt-2 text-sm font-medium leading-6 text-primary">{question.question}</p><p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your response</p><p className="mt-1 text-sm leading-6 text-foreground">{option?.text ?? "Not provided"}</p></div>; })}</div>
            {!submitted && !readiness.assessmentComplete ? <FoundationButton className="mt-6" onClick={() => setLocation("/apply/business-development-manager/assessment/questions")} size="sm" variant="secondary">Complete assessment</FoundationButton> : null}
          </ReviewCard>
        </div>

        {!submitted ? <section className="mt-5 rounded-xl border border-border bg-white p-6 shadow-none sm:p-7"><h2 className="text-lg font-semibold tracking-[-0.02em] text-primary">Declaration</h2><p className="mt-2 text-[13px] leading-5 text-muted-foreground">Please confirm the following before submitting your application.</p><div className="mt-6 space-y-4"><label className="flex items-start gap-3 text-sm leading-6 text-foreground"><input checked={declarationOne} className="mt-1 size-4 rounded border-input accent-primary" onChange={(event) => setDeclarationOne(event.target.checked)} type="checkbox" />I confirm that the information provided in this application is accurate to the best of my knowledge.</label><label className="flex items-start gap-3 text-sm leading-6 text-foreground"><input checked={declarationTwo} className="mt-1 size-4 rounded border-input accent-primary" onChange={(event) => setDeclarationTwo(event.target.checked)} type="checkbox" />I understand that my application information, CV and assessment responses will be reviewed as part of the recruitment process.</label></div>{attempted && (!declarationOne || !declarationTwo) ? <p className="mt-4 text-[13px] text-status-error-strong">Confirm both declarations before submitting.</p> : null}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><FoundationButton className="w-full sm:w-auto" onClick={() => setLocation("/apply/business-development-manager/assessment/complete")} variant="secondary">Back to assessment</FoundationButton><FoundationButton className="w-full sm:w-auto" disabled={!readiness.ready || !declarationOne || !declarationTwo} onClick={submit} size="lg">Submit application</FoundationButton></div></section> : null}
      </section>
    </ApplicationShell>
  );
}
