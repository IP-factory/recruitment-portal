/**
 * Task 24G — Curriculum Vitae step.
 *
 * Server-backed CV upload between Information and Assessment. The file bytes
 * go straight to object storage through the authenticated API (never TiDB);
 * this page only ever sees applicant-safe metadata. Validation happens both
 * here (extension + size, instant feedback) and on the server (content magic
 * bytes — the browser MIME type is never trusted).
 *
 * The upload is optional: an applicant can continue without a CV, and the
 * application simply shows "Not uploaded" to Admin until one is provided.
 * A failed upload never discards the applicant's progress.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { ApplicationApiError, fetchApplicantCv, loadApplicantSession, removeApplicantCv, uploadApplicantCv, type ApplicantCvFileMetadata } from "@/lib/applicationApi";
import { CV_ACCEPTED_EXTENSIONS, CV_MAX_FILE_SIZE, cvExtensionOf, formatFileSize } from "@shared/cvApi";
import { Check, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

function useRoleSlug() {
  return useMemo(() => {
    if (typeof window === "undefined") return "business-development-officer";
    const match = window.location.pathname.match(/^\/apply\/([^/]+)/);
    return match?.[1] || "business-development-officer";
  }, []);
}

export default function ApplicantCvPlaceholder() {
  const [, setLocation] = useLocation();
  const roleSlug = useRoleSlug();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cv, setCv] = useState<ApplicantCvFileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // No application session → nothing to attach a CV to: back to Information.
  useEffect(() => {
    if (!loadApplicantSession()) {
      setLocation(`/apply/${roleSlug}/information`);
      return;
    }
    fetchApplicantCv()
      .then((payload) => setCv(payload.cv))
      .catch((err) => {
        if (err instanceof ApplicationApiError && (err.status === 401 || err.status === 403)) {
          setLocation(`/apply/${roleSlug}/information`);
          return;
        }
        setError(err instanceof ApplicationApiError ? err.message : "Unable to load your CV.");
      })
      .finally(() => setLoading(false));
  }, [roleSlug, setLocation]);

  const openPicker = () => inputRef.current?.click();

  const selectFile = async (selected: File | undefined) => {
    if (!selected || uploading) return;
    if (inputRef.current) inputRef.current.value = "";
    setSuccess("");
    // Client-side validation gives instant feedback; the server re-validates
    // the actual file content regardless.
    if (!CV_ACCEPTED_EXTENSIONS.includes(cvExtensionOf(selected.name) as (typeof CV_ACCEPTED_EXTENSIONS)[number])) {
      setError("Upload your CV as a PDF, DOC or DOCX file.");
      return;
    }
    if (selected.size > CV_MAX_FILE_SIZE) {
      setError("Your CV must be 10 MB or smaller.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const payload = await uploadApplicantCv(selected);
      setCv(payload.cv);
      setSuccess("CV uploaded successfully.");
    } catch (err) {
      // The previous CV (if any) stays in place — nothing is lost on failure.
      setError(err instanceof ApplicationApiError ? err.message : "Unable to upload your CV. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async () => {
    if (removing) return;
    setRemoving(true);
    setError("");
    setSuccess("");
    try {
      await removeApplicantCv();
      setCv(null);
    } catch (err) {
      setError(err instanceof ApplicationApiError ? err.message : "Unable to remove your CV.");
    } finally {
      setRemoving(false);
    }
  };

  const uploadStateLabel = uploading ? "Uploading your CV…" : removing ? "Removing your CV…" : "";

  return (
    <ApplicationShell activeStep={1} showSummary>
      <section>
        <p className="section-kicker">Step 2 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Curriculum Vitae</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">Upload your current CV so we can review your professional background alongside your application. This step is optional — you can continue without a CV and upload it later before submitting.</p>
        <div className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
          <input accept=".pdf,.doc,.docx" aria-describedby="cv-upload-help cv-upload-error" className="sr-only" onChange={(event) => { void selectFile(event.target.files?.[0]); }} ref={inputRef} type="file" />
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading your CV…</div>
          ) : !cv ? (
            <div className={`rounded-xl border border-dashed px-6 py-12 text-center outline-none transition-colors sm:py-14 ${error ? "border-status-error-strong bg-status-error/5" : "border-portal-border-strong bg-white focus-within:border-portal-blue"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPicker(); } }} role="button" tabIndex={0}>
              <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-portal-surface text-primary"><Upload className="size-5" /></div>
              <h2 className="mt-4 text-base font-semibold text-primary">Upload your CV</h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-muted-foreground">Select your CV file to attach it to this application. You can replace or remove it at any time before submitting.</p>
              <FoundationButton className="mt-5" disabled={uploading} onClick={openPicker} type="button" variant="secondary">{uploading ? <><Loader2 className="size-4 animate-spin" />Uploading…</> : "Browse files"}</FoundationButton>
              <p className="mt-4 text-[12px] text-muted-foreground" id="cv-upload-help">PDF, DOC or DOCX · Maximum 10 MB</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-portal-surface px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary" title={cv.originalFilename}>{cv.originalFilename}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{formatFileSize(cv.fileSize)} · Uploaded {new Date(cv.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button className="text-[13px] font-medium text-portal-blue hover:text-primary hover:underline" disabled={uploading || removing} onClick={openPicker} type="button">Replace</button>
                  <button className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-status-error-strong hover:underline" disabled={uploading || removing} onClick={() => { void removeFile(); }} type="button"><Trash2 className="size-3.5" />Remove</button>
                </div>
              </div>
              {success ? <div className="alert-success mt-4 flex gap-2.5 rounded-lg border px-4 py-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{success}</div> : null}
            </div>
          )}
          {uploading || removing ? <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin" />{uploadStateLabel}</p> : null}
          {error ? <p className="mt-3 text-[13px] text-status-error-strong" id="cv-upload-error" role="alert">{error}</p> : <span id="cv-upload-error" />}
          <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-primary">Before you continue</h2><ul className="mt-4 space-y-3">{["Use your most recent CV", "Make sure your employment history is clear", "Include relevant responsibilities and achievements where applicable"].map((item) => <li className="flex gap-2.5 text-[13px] leading-5 text-muted-foreground" key={item}><Check className="mt-0.5 size-3.5 shrink-0 text-portal-blue" />{item}</li>)}</ul></div>
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <FoundationButton className="w-full sm:w-auto" onClick={() => setLocation(`/apply/${roleSlug}/information`)} variant="secondary">Back to information</FoundationButton>
            <FoundationButton className="w-full sm:w-auto" disabled={uploading || removing} onClick={() => setLocation(`/apply/${roleSlug}/assessment`)} size="lg">{cv ? "Continue to assessment" : "Continue without CV"}</FoundationButton>
          </div>
        </div>
      </section>
    </ApplicationShell>
  );
}
