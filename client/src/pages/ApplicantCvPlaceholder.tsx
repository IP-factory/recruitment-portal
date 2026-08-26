/**
 * Quiet Authority CV upload: focused frontend-only document selection with local metadata, validation, and no server transfer.
 */
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { FoundationButton } from "@/components/foundation/ui";
import { clearCvFileMetadata, loadCvFileMetadata, saveCvFileMetadata, type CvFileMetadata } from "@/lib/applicationData";
import { Check, CheckCircle2, FileText, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx"];

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function ApplicantCvPlaceholder() {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<CvFileMetadata | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { setFile(loadCvFileMetadata()); }, []);
  const openPicker = () => inputRef.current?.click();
  const removeFile = () => { setFile(null); setError(""); clearCvFileMetadata(); if (inputRef.current) inputRef.current.value = ""; };
  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    const extension = fileExtension(selected.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) { setError("Upload your CV as a PDF, DOC or DOCX file."); return; }
    if (selected.size > MAX_FILE_SIZE) { setError("Your CV must be 10 MB or smaller."); return; }
    const metadata = { name: selected.name, type: extension.toUpperCase(), size: selected.size };
    setFile(metadata); saveCvFileMetadata(metadata); setError("");
  };
  const continueToAssessment = () => {
    if (!file) { setError("Upload your CV before continuing."); return; }
    setLocation("/apply/business-development-manager/assessment");
  };

  return (
    <ApplicationShell activeStep={1} showSummary>
      <section>
        <p className="section-kicker">Step 2 of 4</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-primary sm:text-[34px]">Upload your CV</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">Upload your current CV so we can review your professional background alongside your application.</p>
        <div className="mt-8 rounded-xl border border-border bg-white p-7 shadow-none sm:p-8">
          <input accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-describedby="cv-upload-help cv-upload-error" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} ref={inputRef} type="file" />
          {!file ? <div className={`rounded-xl border border-dashed px-6 py-12 text-center outline-none transition-colors sm:py-14 ${error ? "border-status-error-strong bg-status-error/5" : "border-portal-border-strong bg-white focus-within:border-portal-blue"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPicker(); } }} role="button" tabIndex={0}>
            <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-portal-surface text-primary"><Upload className="size-5" /></div>
            <h2 className="mt-4 text-base font-semibold text-primary">Upload your CV</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-muted-foreground">Drag and drop your file here, or browse to select a file.</p>
            <FoundationButton className="mt-5" onClick={openPicker} type="button" variant="secondary">Browse files</FoundationButton>
            <p className="mt-4 text-[12px] text-muted-foreground" id="cv-upload-help">PDF, DOC or DOCX · Maximum file size 10 MB</p>
          </div> : <div className="rounded-xl border border-border bg-portal-surface px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-primary" title={file.name}>{file.name}</p><p className="mt-1 text-[13px] text-muted-foreground">{file.type} · {formatFileSize(file.size)}</p></div><div className="flex shrink-0 items-center gap-3"><button className="text-[13px] font-medium text-portal-blue hover:text-primary hover:underline" onClick={openPicker} type="button">Replace</button><button className="text-[13px] font-medium text-muted-foreground hover:text-primary hover:underline" onClick={removeFile} type="button">Remove</button></div></div>
            <div className="alert-success mt-4 flex gap-2.5 rounded-lg border px-4 py-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />CV selected successfully.</div>
          </div>}
          {error ? <p className="mt-3 text-[13px] text-status-error-strong" id="cv-upload-error" role="alert">{error}</p> : <span id="cv-upload-error" />}
          <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-primary">Before you continue</h2><ul className="mt-4 space-y-3">{["Use your most recent CV", "Make sure your employment history is clear", "Include relevant responsibilities and achievements where applicable"].map((item) => <li className="flex gap-2.5 text-[13px] leading-5 text-muted-foreground" key={item}><Check className="mt-0.5 size-3.5 shrink-0 text-portal-blue" />{item}</li>)}</ul></div>
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><FoundationButton className="w-full sm:w-auto" onClick={() => setLocation("/apply/business-development-manager")} variant="secondary">Back</FoundationButton><FoundationButton className="w-full sm:w-auto" onClick={continueToAssessment} size="lg">Continue to assessment</FoundationButton></div>
        </div>
      </section>
    </ApplicationShell>
  );
}
