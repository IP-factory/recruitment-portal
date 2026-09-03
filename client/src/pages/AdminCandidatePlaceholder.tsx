/**
 * Task 24D-2 — Candidate Detail page.
 *
 * Real TiDB-backed candidate review with three tabs:
 * 1. Overview — candidate info, eligibility, screening evaluation
 * 2. Assessment — persisted responses with OPEN review UI
 * 3. Integrity & Bonus — integrity flags, bonus confirmation
 *
 * Everything renders from the application's real database records; nothing
 * assumes a fixed gate set, dimension set, or question count.
  * The CV Review tab records a manual 0–100 CV score; the CV Score and
  * Overall Candidate Score shown here are derived outside the scoring engine,
  * so saving a CV review never affects the assessment evaluation.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationButton, FoundationInput, FoundationSelect, StatusBadge } from "@/components/foundation/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAdminApplicationDetail,
  saveOpenReview,
  updateIntegrityFlag,
  updateBonus,
  updateShortlist,
  updateApplicationStatus,
  fetchAdminCvFileAccess,
  saveCvReview,
  resetCvReview,
  ADMIN_APPLICATION_STATUSES,
  BONUS_TYPES,
  DIMENSION_FLOORS,
  type AdminApplicationDetailResponse,
  type AdminEvaluationDetail,
} from "@/lib/adminApplicationApi";
import { applicationStatusDisplayLabel, eligibilityDisplayLabel } from "@/lib/adminDisplay";
import { calculateOverallCandidateScore, describeCvScore, describeOverallCandidateScore, formatScore, validateCvScoreInput } from "@shared/candidateScore";
import { formatFileSize } from "@shared/cvApi";
import { AlertTriangle, ArrowLeft, Check, Download, Eye, FileText, MapPin, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const statusOptions = ADMIN_APPLICATION_STATUSES;
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const notProvided = (v: string | null | undefined) => v ?? "Not provided";

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailRows({ title, rows }: { title: string; rows: { label: string; value: string | null }[] }) {
  return <section className="py-5 first:pt-0 last:pb-0"><h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</h4><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{rows.map((r) => <div className="min-w-0" key={r.label}><dt className="text-[12px] text-muted-foreground">{r.label}</dt><dd className="mt-1 text-sm font-medium leading-5 text-primary break-words">{notProvided(r.value)}</dd></div>)}</dl></section>;
}

function ScreeningEvaluationCard({ evaluation }: { evaluation: AdminEvaluationDetail }) {
  const { evaluationStatus, baseAssessmentScore, verificationMultiplier, integrityPenalty, bonus, finalScreeningScore, rawBand, appliedBand, floorMissed, manualReviewRequired, dimensions } = evaluation;
  const scoreLabel = evaluationStatus === "Pending Assessment" ? "Pending assessment" : evaluationStatus === "Pending OPEN Review" ? "Pending OPEN review" : evaluationStatus === "Manual Review Required" ? "Manual review required" : finalScreeningScore !== null ? finalScreeningScore.toFixed(1) : "—";
  return <article className="rounded-xl border border-[#eadfbd] bg-white p-5 shadow-none sm:p-6">
    <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Screening Evaluation</p>
    <div className="mt-3 flex items-end justify-between gap-4">
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">Final Screening Score</p>
        <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-primary">{scoreLabel}</p>
        {rawBand && <p className="mt-1 text-[13px] font-semibold text-primary">Raw Band: {rawBand}{appliedBand !== rawBand ? ` → Applied Band: ${appliedBand}` : ""}</p>}
        {floorMissed && <p className="mt-1 text-[12px] text-status-error-strong">Floor missed: {floorMissed}</p>}
        {manualReviewRequired && <p className="mt-1 text-[12px] font-semibold text-[#765d22]">Manual review required</p>}
      </div>
      <p className="mb-1 text-right text-[12px] leading-5 text-muted-foreground">v2 evaluation<br />{evaluationStatus}</p>
    </div>
    <div className="mt-5 divide-y divide-border border-y border-border">
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Base Assessment Score</p><p className="text-[13px] font-semibold text-primary">{baseAssessmentScore !== null ? baseAssessmentScore.toFixed(1) : "Pending"}</p></div>
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Verification</p><p className="text-[13px] font-semibold text-primary">{verificationMultiplier !== null ? `${verificationMultiplier.toFixed(2)} · current evidence set` : "Pending"}</p></div>
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Integrity</p><p className="text-[13px] font-semibold text-primary">{integrityPenalty !== null && integrityPenalty > 0 ? `−${integrityPenalty}` : "Clear"}</p></div>
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Bonus</p><p className="text-[13px] font-semibold text-primary">{bonus !== null && bonus > 0 ? `+${bonus}` : "0"}</p></div>
    </div>
    {dimensions.length > 0 && <div className="mt-6 border-t border-border pt-5"><h4 className="text-sm font-semibold text-primary">Dimension profile</h4><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[470px] text-left text-[12px]"><thead className="border-b border-border text-muted-foreground"><tr><th className="pb-2 pr-3 font-medium">Dimension</th><th className="pb-2 pr-3 text-right font-medium">Score</th><th className="pb-2 pr-3 text-right font-medium">Weight</th><th className="pb-2 pr-3 text-right font-medium">Floor</th><th className="pb-2 text-right font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{dimensions.map((d) => <tr key={d.dimensionId}><td className="py-2 pr-3 font-medium text-primary">{d.dimensionReference}</td><td className="py-2 pr-3 text-right text-muted-foreground">{d.normalizedScore.toFixed(1)}</td><td className="py-2 pr-3 text-right text-muted-foreground">{d.weight}%</td><td className="py-2 pr-3 text-right text-muted-foreground">{d.floor !== null ? `${d.floor}` : "—"}</td><td className="py-2 text-right text-muted-foreground">{d.floorStatus ?? "—"}</td></tr>)}</tbody></table></div></div>}
  </article>;
}

function OpenReviewCard({ question, applicationId, onSaved }: { question: AdminEvaluationDetail["pendingOpenQuestions"][number]; applicationId: string; onSaved: () => void }) {
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (score === "") { toast.error("Enter a score between 0 and 5."); return; }
    const rawScore = Number(score);
    if (!Number.isInteger(rawScore) || rawScore < 0 || rawScore > 5) { toast.error("Score must be 0–5."); return; }
    setSaving(true);
    try { await saveOpenReview(applicationId, question.questionId, { rawScore, note: note || undefined }); toast.success("OPEN review saved."); onSaved(); } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to save review."); } finally { setSaving(false); }
  };
  return <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
    <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-portal-blue">{question.questionReference} · OPEN</p>
    <h4 className="mt-2 text-base font-semibold text-primary">{question.prompt}</h4>
    <div className="mt-4 rounded-lg border border-portal-blue/15 bg-portal-blue-soft px-4 py-3"><p className="text-[12px] font-semibold text-primary">Candidate response</p><p className="mt-1.5 text-sm leading-6 text-primary whitespace-pre-wrap">{question.candidateResponse}</p></div>
    {question.rubricAnchors.length > 0 && <div className="mt-4"><p className="text-[12px] font-semibold text-muted-foreground">Rubric anchors</p><div className="mt-2 space-y-1">{question.rubricAnchors.map((a, i) => <p key={i} className="text-[12px] text-muted-foreground"><span className="font-semibold text-primary">{a.scoreMin}–{a.scoreMax}:</span> {a.anchorText}</p>)}</div></div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr]">
      <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor={`open-score-${question.questionId}`}>Rating (0–5)</label><FoundationInput id={`open-score-${question.questionId}`} max="5" min="0" onChange={(e) => setScore(e.target.value)} placeholder="0–5" step="1" type="number" value={score} /></div>
      <div><label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor={`open-note-${question.questionId}`}>Note (optional)</label><FoundationInput id={`open-note-${question.questionId}`} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" value={note} /></div>
    </div>
    <FoundationButton className="mt-4" disabled={saving} onClick={handleSave} size="sm">{saving ? "Saving…" : "Save review"}</FoundationButton>
  </article>;
}

function ReviewedOpenCard({ review }: { review: AdminEvaluationDetail["openReviews"][number] }) {
  return <article className="rounded-xl border border-status-success/30 bg-white p-5 shadow-none sm:p-6">
    <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-portal-blue">{review.questionReference} · OPEN · Reviewed</p>
    <h4 className="mt-2 text-base font-semibold text-primary">{review.prompt}</h4>
    <div className="mt-4 rounded-lg border border-portal-blue/15 bg-portal-blue-soft px-4 py-3"><p className="text-[12px] font-semibold text-primary">Candidate response</p><p className="mt-1.5 text-sm leading-6 text-primary whitespace-pre-wrap">{review.candidateResponse}</p></div>
    <div className="mt-4 flex items-center gap-4"><p className="text-sm font-semibold text-primary">Score: {review.rawScore}</p>{review.reviewNote && <p className="text-[12px] text-muted-foreground">{review.reviewNote}</p>}</div>
  </article>;
}

/**
 * Task 24G (Part D) — Candidate Evaluation: the three candidate scores shown
 * separately. The Assessment Score stays the engine's Final Screening Score;
 * the CV Score and Overall Score are derived outside the scoring engine.
 */
function CandidateEvaluationCard({ data }: { data: AdminApplicationDetailResponse }) {
  const { application, evaluation } = data;
  const assessmentScore = evaluation.finalScreeningScore;
  const cvScore = application.cvReview?.score ?? null;
  const overall = calculateOverallCandidateScore(assessmentScore, cvScore);
  const assessmentLabel = evaluation.evaluationStatus === "Pending Assessment" ? "Pending assessment" : evaluation.evaluationStatus === "Pending OPEN Review" ? "Pending OPEN review" : assessmentScore !== null ? formatScore(assessmentScore) : "—";
  return <article className="rounded-xl border border-border bg-white p-5">
    <h3 className="text-lg font-semibold text-primary">Candidate Evaluation</h3>
    <div className="mt-4 divide-y divide-border">
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Assessment Score</p><p className="text-[13px] font-semibold text-primary">{assessmentLabel}</p></div>
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">CV Score</p><p className="text-[13px] font-semibold text-primary">{describeCvScore(cvScore, Boolean(application.cv))}</p></div>
      <div className="flex items-baseline justify-between gap-4 py-3"><p className="text-[13px] font-semibold text-primary">Overall Score</p><p className="text-[13px] font-semibold text-primary">{overall !== null ? formatScore(overall) : describeOverallCandidateScore(assessmentScore, cvScore)}</p></div>
    </div>
    <p className="mt-3 border-t border-border pt-3 text-[12px] leading-5 text-muted-foreground">Overall = (Assessment + CV) ÷ 2 once both scores exist. The CV score never feeds into the assessment engine.</p>
  </article>;
}

/**
 * Task 24G (Part B) — CV Review tab. Secure view/download (short-lived
 * signed private URL in deployments, authenticated stream locally) and the
 * manual 0–100 CV score. Saving a score only writes the CV review record —
 * it never triggers assessment recalculation.
 */
function CvReviewTab({ data, onRefresh }: { data: AdminApplicationDetailResponse; onRefresh: () => void }) {
  const { application } = data;
  const cv = application.cv;
  const review = application.cvReview;
  const [scoreInput, setScoreInput] = useState(review ? String(review.score) : "");
  const [noteInput, setNoteInput] = useState(review?.reviewNote ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [fileBusy, setFileBusy] = useState<"view" | "download" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openCvFile = async (download: boolean) => {
    setFileBusy(download ? "download" : "view");
    try {
      const access = await fetchAdminCvFileAccess(application.id, download);
      if (access.kind === "url") {
        if (download) {
          // Signed GET URLs cannot force attachment, so save through the
          // browser to get a proper download with the original filename.
          const fileResponse = await fetch(access.url);
          if (!fileResponse.ok) throw new Error("Unable to fetch the CV file.");
          const blob = await fileResponse.blob();
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.download = access.filename ?? cv?.originalFilename ?? "cv";
          anchor.href = objectUrl;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(objectUrl);
        } else {
          window.open(access.url, "_blank", "noopener,noreferrer");
        }
      } else {
        // Local development: same-origin authenticated streaming route.
        window.open(access.url, "_blank", "noopener");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to open the CV file.");
    } finally {
      setFileBusy(null);
    }
  };

  const handleSave = async () => {
    // Server is authoritative; this mirror validation gives instant feedback.
    const validated = validateCvScoreInput(scoreInput);
    if ("error" in validated) { setFormError(validated.error); return; }
    setFormError(null);
    setSaving(true);
    try {
      await saveCvReview(application.id, { score: validated.score, note: noteInput.trim() || undefined });
      toast.success("CV score saved.");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save the CV score.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetCvReview(application.id);
      setScoreInput("");
      setNoteInput("");
      toast.success("CV score removed.");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to remove the CV score.");
    } finally {
      setResetting(false);
    }
  };

  if (!cv) {
    return <article className="rounded-xl border border-border bg-white p-6">
      <h3 className="text-lg font-semibold text-primary">CV Review</h3>
      <p className="mt-2 text-sm text-muted-foreground">No CV has been uploaded for this application. The CV score shows <span className="font-medium text-primary">Not uploaded</span> and the Overall Score shows <span className="font-medium text-primary">Pending CV review</span> until a CV is provided and reviewed.</p>
    </article>;
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,68fr)_minmax(260px,32fr)]">
    <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
      <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">CV file</h3>
      <div className="mt-5 rounded-xl border border-border bg-portal-surface px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText className="size-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary" title={cv.originalFilename}>{cv.originalFilename}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{formatFileSize(cv.fileSize)} · Uploaded {new Date(cv.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {application.fullName}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-portal-surface disabled:opacity-60" disabled={fileBusy !== null} onClick={() => { void openCvFile(false); }} type="button"><Eye className="size-3.5" />{fileBusy === "view" ? "Opening…" : "View CV"}</button>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-portal-surface disabled:opacity-60" disabled={fileBusy !== null} onClick={() => { void openCvFile(true); }} type="button"><Download className="size-3.5" />{fileBusy === "download" ? "Preparing…" : "Download CV"}</button>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-muted-foreground">CV files open only after Admin authentication, through a short-lived private URL — never through a public or permanent link.</p>
      </div>
      {review ? <div className="mt-5 border-t border-border pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Current review</p>
        <p className="mt-2 text-sm text-primary">CV Score: <span className="font-semibold">{formatScore(review.score)}</span></p>
        {review.reviewNote ? <p className="mt-1 text-[13px] text-muted-foreground">{review.reviewNote}</p> : null}
        <p className="mt-1 text-[12px] text-muted-foreground">Reviewed {new Date(review.reviewedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      </div> : null}
    </article>

    <article className="h-fit rounded-xl border border-border bg-white p-5 shadow-none">
      <h3 className="text-lg font-semibold text-primary">CV Score</h3>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Manual score from 0 to 100 based on your review of the CV. This never changes the assessment score.</p>
      <div className="mt-4">
        <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="cv-score-input">Score (0–100)</label>
        <FoundationInput id="cv-score-input" inputMode="decimal" onChange={(e) => { setScoreInput(e.target.value); setFormError(null); }} placeholder="e.g. 82.5" value={scoreInput} />
      </div>
      <div className="mt-3">
        <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground" htmlFor="cv-note-input">Note (optional)</label>
        <FoundationInput id="cv-note-input" onChange={(e) => setNoteInput(e.target.value)} placeholder="Internal review note" value={noteInput} />
      </div>
      {formError ? <p className="mt-3 text-[13px] text-status-error-strong">{formError}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FoundationButton disabled={saving || scoreInput.trim() === ""} onClick={() => { void handleSave(); }} size="sm">{saving ? "Saving…" : review ? "Update CV score" : "Save CV score"}</FoundationButton>
        {review ? <FoundationButton disabled={resetting} onClick={() => { void handleReset(); }} size="sm" variant="secondary">{resetting ? "Removing…" : "Remove score"}</FoundationButton> : null}
      </div>
    </article>
  </div>;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AdminApplicationDetailResponse }) {
  const { application, evaluation } = data;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,68fr)_minmax(260px,32fr)]">
    <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
      <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Applicant information</h3>
      <div className="mt-6 divide-y divide-border">
        <DetailRows title="Contact" rows={[{ label: "Full name", value: application.fullName }, { label: "Email address", value: application.email }, { label: "Phone number", value: application.phone }, { label: "Current city", value: application.city }]} />
        <DetailRows title="Professional" rows={[
          // For new applications currentStatus holds the career status (e.g.
          // "Currently employed"). For historical records recentRole held the
          // old freetext job title — both are the same column; display label
          // depends on whether the value looks like a status option or a title.
          { label: "Current status", value: application.currentStatus || application.recentRole },
          // currentStatusOther is only set when the applicant selected "Other".
          // For historical records recentEmployer holds the old employer name;
          // suppress it here to avoid double-rendering — the legacy employer
          // showed in the old label and won't match any status-option text.
          ...(application.currentStatusOther ? [{ label: "Status detail", value: application.currentStatusOther }] : []),
          { label: "Total experience", value: application.totalExperience },
          ...(application.linkedinUrl ? [{ label: "LinkedIn", value: application.linkedinUrl }] : []),
        ]} />
      </div>
      {application.eligibilityResponses.length > 0 && <section className="border-t border-border pt-5 mt-5"><h4 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Eligibility</h4><span className={`mt-2 inline-flex w-fit rounded-full border px-3 py-1 text-[12px] font-semibold ${application.eligibilityStatus === "Eligible" ? "border-status-success/30 bg-status-success/5 text-status-success-strong" : application.eligibilityStatus === "Closed" ? "border-status-error/30 bg-status-error/5 text-status-error-strong" : "border-[#eadfbd] bg-[#fbf8ef] text-[#765d22]"}`}>{eligibilityDisplayLabel(application.eligibilityStatus)}</span><div className="mt-4 divide-y divide-border">{application.eligibilityResponses.map((g) => <div className="flex items-center justify-between gap-4 py-2" key={g.gateReference}><p className="text-[13px] text-primary"><span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{g.gateReference}</span>{g.outcome}{g.internalFlag ? ` · ${g.internalFlag}` : ""}</p></div>)}</div></section>}
    </article>
    <div className="space-y-5">
      <article className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-lg font-semibold text-primary">Application summary</h3>
        <dl className="mt-5 space-y-4">
          <div><dt className="text-[12px] text-muted-foreground">Role</dt><dd className="mt-1 text-sm font-medium text-primary">{application.roleTitle}</dd></div>
          <div><dt className="text-[12px] text-muted-foreground">Application status</dt><dd className="mt-1.5"><StatusBadge status={applicationStatusDisplayLabel(application.applicationStatus)} /></dd></div>
          <div><dt className="text-[12px] text-muted-foreground">Assessment</dt><dd className="mt-1.5"><StatusBadge status={application.assessmentStatus} /></dd></div>
          <div><dt className="text-[12px] text-muted-foreground">Applied</dt><dd className="mt-1 text-sm font-medium text-primary">{new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
        </dl>
      </article>
      <ScreeningEvaluationCard evaluation={evaluation} />
      <CandidateEvaluationCard data={data} />
    </div>
  </div>;
}

function AssessmentTab({ data, onRefresh }: { data: AdminApplicationDetailResponse; onRefresh: () => void }) {
  const { application, evaluation } = data;
  if (application.assessmentStatus === "In Progress" || application.assessmentStatus === "Pending") return <article className="rounded-xl border border-border bg-white p-6"><h3 className="text-lg font-semibold text-primary">Assessment {application.assessmentStatus.toLowerCase()}</h3><p className="mt-2 text-sm text-muted-foreground">This candidate has not completed the assessment yet.</p></article>;

  return <div className="space-y-5">
    <section><h3 className="text-xl font-semibold tracking-[-0.025em] text-primary">Assessment responses</h3><p className="mt-1 text-sm text-muted-foreground">{application.assessmentResponses.length} responses recorded.</p></section>

    {evaluation.pendingOpenQuestions.length > 0 && <section><h4 className="text-base font-semibold text-primary">OPEN questions requiring review</h4><div className="mt-3 space-y-4">{evaluation.pendingOpenQuestions.map((q) => <OpenReviewCard applicationId={application.id} key={q.questionId} onSaved={onRefresh} question={q} />)}</div></section>}

    {evaluation.openReviews.length > 0 && <section><h4 className="text-base font-semibold text-primary">Reviewed OPEN questions</h4><div className="mt-3 space-y-4">{evaluation.openReviews.map((r) => <ReviewedOpenCard key={r.questionId} review={r} />)}</div></section>}

    <article className="divide-y divide-border rounded-xl border border-border bg-white shadow-none">
      {application.assessmentResponses.map((resp, i) => {
        const qs = evaluation.questionScores.find((q) => q.questionId === resp.questionId);
        return <section className="p-5 sm:p-6" key={resp.questionId}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-portal-blue">{resp.questionReference} · {resp.questionType}</p>
          <h4 className="mt-2 text-base font-semibold leading-6 text-primary">{resp.prompt}</h4>
          <div className="mt-4 rounded-lg border border-portal-blue/15 bg-portal-blue-soft px-4 py-3">
            <p className="text-[12px] font-semibold text-primary">Candidate response</p>
            <p className="mt-1.5 text-sm leading-6 text-primary whitespace-pre-wrap">{typeof resp.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp.responsePayload)}</p>
          </div>
          {qs && <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted-foreground">
            <span>Raw: <strong className="text-primary">{qs.rawScore ?? "—"}</strong></span>
            <span>Max: {qs.maxScore ?? "—"}</span>
            <span>qWeight: {qs.qWeight ?? "—"}</span>
            {qs.dimensionReference && <span>{qs.dimensionReference}</span>}
          </div>}
        </section>;
      })}
    </article>
  </div>;
}

function IntegrityBonusTab({ data, onRefresh }: { data: AdminApplicationDetailResponse; onRefresh: () => void }) {
  const { application, evaluation } = data;
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [savingBonus, setSavingBonus] = useState<string | null>(null);
  const handleFlagUpdate = async (flagId: string, status: "Confirmed" | "Dismissed") => {
    setSavingFlag(flagId);
    try { await updateIntegrityFlag(application.id, flagId, { status }); toast.success(`Integrity flag ${status.toLowerCase()}.`); onRefresh(); } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to update flag."); } finally { setSavingFlag(null); }
  };
  const handleBonusUpdate = async (bonusType: string, confirmed: boolean) => {
    setSavingBonus(bonusType);
    try { await updateBonus(application.id, bonusType, { confirmed }); toast.success(confirmed ? "Bonus confirmed." : "Bonus removed."); onRefresh(); } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to update bonus."); } finally { setSavingBonus(null); }
  };

  return <div className="space-y-6">
    <section>
      <h3 className="text-lg font-semibold text-primary">Integrity flags</h3>
      {evaluation.integrityFlags.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No integrity flags detected.</p> : <div className="mt-3 space-y-3">{evaluation.integrityFlags.map((flag) => <article className="rounded-lg border border-border bg-white p-4" key={flag.id}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-primary">{flag.source}</p><p className="mt-1 text-[13px] text-muted-foreground">{flag.description}</p></div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${flag.status === "Clear" ? "bg-status-success/10 text-status-success-strong" : flag.status === "Flagged" ? "bg-[#fbf8ef] text-[#765d22]" : flag.status === "Confirmed" ? "bg-status-error/10 text-status-error-strong" : "bg-muted text-muted-foreground"}`}>{flag.status}</span>
        </div>
        {flag.status === "Flagged" && <div className="mt-3 flex gap-2"><FoundationButton disabled={savingFlag === flag.id} onClick={() => handleFlagUpdate(flag.id, "Confirmed")} size="sm" variant="secondary">Confirm (−10)</FoundationButton><FoundationButton disabled={savingFlag === flag.id} onClick={() => handleFlagUpdate(flag.id, "Dismissed")} size="sm" variant="secondary">Dismiss</FoundationButton></div>}
      </article>)}</div>}
    </section>

    <section>
      <h3 className="text-lg font-semibold text-primary">Bonus review</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">Confirm applicable bonuses. Maximum total: +5.</p>
      <div className="mt-3 space-y-3">{evaluation.bonusReviews.map((b) => <article className="rounded-lg border border-border bg-white p-4" key={b.bonusType}>
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-sm font-semibold text-primary">{b.label}</p><p className="mt-0.5 text-[12px] text-muted-foreground">+{b.points} points</p></div>
          <div className="flex items-center gap-3">
            {b.confirmed && <Check className="size-4 text-status-success-strong" />}
            <FoundationButton disabled={savingBonus === b.bonusType} onClick={() => handleBonusUpdate(b.bonusType, !b.confirmed)} size="sm" variant="secondary">{b.confirmed ? "Remove" : "Confirm"}</FoundationButton>
          </div>
        </div>
      </article>)}</div>
    </section>
  </div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminCandidatePlaceholder() {
  const [, params] = useRoute("/admin/applications/:candidateId");
  const [, setLocation] = useLocation();
  const [data, setData] = useState<AdminApplicationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Controlled tab state — persists across silent refreshes so sub-tab
  // operations (save OPEN review, confirm bonus, etc.) never jump back to Overview.
  const [activeTab, setActiveTab] = useState<"overview" | "assessment" | "cv" | "integrity">("overview");

  const load = useCallback(() => {
    if (!params?.candidateId) return;
    // Show full-page loader only on the initial load (data === null).
    // Subsequent refreshes triggered by sub-tab operations run silently;
    // the Tabs component stays mounted and the active tab is preserved.
    if (!data) setLoading(true);
    fetchAdminApplicationDetail(params.candidateId)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load application."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.candidateId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!data) return;
    try { await updateApplicationStatus(data.application.id, { status: status as typeof ADMIN_APPLICATION_STATUSES[number] }); toast.success("Status updated."); load(); } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to update status."); }
  };

  const handleShortlistToggle = async () => {
    if (!data) return;
    try { await updateShortlist(data.application.id, { shortlisted: !data.application.shortlisted }); toast.success(data.application.shortlisted ? "Removed from shortlist." : "Added to shortlist."); load(); } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to update shortlist."); }
  };

  if (loading) return <AdminShell title="Application Review"><section className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading application…</p></section></AdminShell>;
  if (error || !data) return <AdminShell title="Application Review"><section className="py-8"><h2 className="text-2xl font-semibold text-primary">Application not found</h2><p className="mt-2 text-sm text-muted-foreground">{error ?? "The requested application could not be found."}</p><FoundationButton className="mt-6" onClick={() => setLocation("/admin/applications")} variant="secondary">Back to applications</FoundationButton></section></AdminShell>;

  const { application, evaluation } = data;

  return <AdminShell title="Application Review">
    <button className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary" onClick={() => setLocation("/admin/applications")} type="button"><ArrowLeft className="size-4" />Back to applications</button>

    <article className="mt-5 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{initials(application.fullName)}</span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-primary">{application.fullName}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{application.email}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              <span className="font-medium text-primary">{application.roleTitle}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />Applied {new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <StatusBadge status={applicationStatusDisplayLabel(application.applicationStatus)} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:w-[280px] lg:border-l lg:border-t-0 lg:pl-6">
          <div><label className="text-[12px] font-medium text-muted-foreground" htmlFor="application-status">Application status</label><FoundationSelect className="mt-2" id="application-status" onChange={(e) => handleStatusChange(e.target.value)} value={application.applicationStatus}>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</FoundationSelect></div>
          <FoundationButton onClick={handleShortlistToggle} size="sm" variant={application.shortlisted ? "secondary" : "primary"}>
            <Star className="size-4" />{application.shortlisted ? "Remove from shortlist" : "Add to shortlist"}
          </FoundationButton>
          {evaluation.manualReviewRequired && <p className="flex items-center gap-2 text-[12px] font-semibold text-[#765d22]"><AlertTriangle className="size-3.5" />Manual review required</p>}
        </div>
      </div>
    </article>

    <Tabs className="mt-6" value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <div className="overflow-x-auto pb-1"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="assessment">Assessment</TabsTrigger><TabsTrigger value="cv">CV Review</TabsTrigger><TabsTrigger value="integrity">Integrity & Bonus</TabsTrigger></TabsList></div>
      <TabsContent value="overview"><OverviewTab data={data} /></TabsContent>
      <TabsContent value="assessment"><AssessmentTab data={data} onRefresh={load} /></TabsContent>
      <TabsContent value="cv"><CvReviewTab data={data} onRefresh={load} /></TabsContent>
      <TabsContent value="integrity"><IntegrityBonusTab data={data} onRefresh={load} /></TabsContent>
    </Tabs>
  </AdminShell>;
}
