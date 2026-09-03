/**
 * CSV Assessment Question Import wizard.
 *
 * Flow:
 *   Upload → (Framework notice if needed) → Preview → choose scope → Confirm → Result
 *
 * Framework generation sub-flow:
 *   Framework notice → Framework preview → Create Framework & Continue
 *     → back to Preview (auto-revalidated)
 *   or
 *   Framework notice → Configure Evaluation Framework (navigate to role tab)
 *
 * Nothing is written until Confirm Import. The server re-validates the same
 * CSV and creates the framework / imports questions in separate atomic steps.
 * Imported questions reuse the existing scoring engine — there is never a
 * second scoring path.
 *
 * SCORING-ENGINE PROTECTION: this file has no imports from v2BaseScoring,
 * v2ModifierScoring, evaluationScoring or any dimension-weight calculation.
 */
import { AdminShell } from "@/components/admin/AdminShell";
import { FoundationButton } from "@/components/foundation/ui";
import {
  confirmCsvImport,
  createFrameworkFromCsv,
  downloadCsvTemplate,
  fetchCsvTemplate,
  previewCsvImport,
  readCsvFile,
  type CsvFrameworkDimensionDto,
  type CsvFrameworkPreviewDto,
  type CsvImportPreviewDto,
  type CsvImportResultDto,
  type CsvScope,
  type CsvTemplatePayload,
} from "@/lib/csvImportApi";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Settings,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "upload" | "framework" | "preview" | "result";

const SCOPE_COPY: Record<CsvScope, { title: string; description: string }> = {
  QUESTION_BANK: {
    title: "Save to Question Bank",
    description:
      "Reusable across roles. The questions appear in the shared Question Bank and can be added to any assessment later.",
  },
  ROLE_ONLY: {
    title: "Use for this role only",
    description:
      "Private to this role. Stored in the same tables with role-only metadata, never shown in the shared Question Bank, and scored identically once assigned.",
  },
};

// ── Main page component ───────────────────────────────────────────────────────

export default function AdminAssessmentCsvImport() {
  const [, params] = useRoute("/admin/roles/:roleSlug/assessment/import");
  const [, setLocation] = useLocation();
  const roleSlug = params?.roleSlug ?? "";

  const [step, setStep] = useState<Step>("upload");
  const [template, setTemplate] = useState<CsvTemplatePayload | null>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvImportPreviewDto | null>(null);
  const [scope, setScope] = useState<CsvScope | null>(null);
  const [result, setResult] = useState<CsvImportResultDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the template once so instructions render immediately.
  useEffect(() => {
    let active = true;
    if (!roleSlug) return;
    fetchCsvTemplate(roleSlug)
      .then((payload) => { if (active) setTemplate(payload); })
      .catch(() => { /* non-critical */ });
    return () => { active = false; };
  }, [roleSlug]);

  const backToRole = () => setLocation(`/admin/roles/${roleSlug}`);
  const goToFrameworkTab = () =>
    setLocation(`/admin/roles/${roleSlug}#evaluation-framework`);

  const handleDownloadTemplate = async () => {
    setError(null);
    try {
      const payload = template ?? (await fetchCsvTemplate(roleSlug));
      if (!template) setTemplate(payload);
      downloadCsvTemplate(payload.filename, payload.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download the CSV template.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await readCsvFile(file);
      const dto = await previewCsvImport(roleSlug, text);
      setCsvText(text);
      setFileName(file.name);
      setPreview(dto);
      setScope(null);
      setResult(null);
      // Route to the framework step whenever any dimensions are missing/conflicted.
      if (dto.frameworkState && dto.frameworkState !== "ok") {
        setStep("framework");
      } else {
        setStep("preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read or validate this CSV file.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFramework = async () => {
    setBusy(true);
    setError(null);
    try {
      const refreshed = await createFrameworkFromCsv(roleSlug, csvText);
      setPreview(refreshed);
      // After creation the framework state must be "ok" — go straight to preview.
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the Evaluation Framework.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!scope || !preview || preview.errorCount > 0 || preview.detected === 0) return;
    setBusy(true);
    setError(null);
    try {
      const dto = await confirmCsvImport(roleSlug, csvText, scope);
      setResult(dto);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import this CSV file.");
    } finally {
      setBusy(false);
    }
  };

  const resetToUpload = () => {
    setStep("upload");
    setPreview(null);
    setScope(null);
    setCsvText("");
    setFileName("");
    setError(null);
  };

  const canConfirm =
    Boolean(scope) &&
    Boolean(preview) &&
    preview!.errorCount === 0 &&
    preview!.detected > 0 &&
    !busy;

  return (
    <AdminShell title="Recruitment Roles">
      <button
        className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
        onClick={backToRole}
        type="button"
      >
        <ArrowLeft className="size-4" />
        Back to recruitment role
      </button>

      <section className="mt-5">
        <p className="text-[12px] font-medium text-muted-foreground">Assessment · CSV import</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-primary">
          Import questions from CSV
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">
          Upload a completed template to validate and preview the questions before anything is
          saved. Imported questions reuse the existing scoring engine.
        </p>
      </section>

      {error && (
        <div className="mt-4 flex gap-3 rounded-lg border border-status-error-strong/20 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-error-strong" />
          <p className="text-sm font-medium text-status-error-strong">{error}</p>
        </div>
      )}

      {step === "upload" && (
        <UploadStep
          busy={busy}
          fileInputRef={fileInputRef}
          onDownloadTemplate={handleDownloadTemplate}
          onFile={handleFile}
          template={template}
        />
      )}

      {step === "framework" && preview?.frameworkPreview && (
        <FrameworkStep
          busy={busy}
          detected={preview.detected}
          fileName={fileName}
          frameworkPreview={preview.frameworkPreview}
          frameworkState={(preview.frameworkState === "no_framework" || preview.frameworkState === "partial" || preview.frameworkState === "conflict" ? preview.frameworkState : "no_framework")}
          onCreateFramework={handleCreateFramework}
          onGoToFramework={goToFrameworkTab}
          onReset={resetToUpload}
          roleSlug={roleSlug}
          structurallyValidCount={preview.structurallyValidCount ?? 0}
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          canConfirm={canConfirm}
          fileName={fileName}
          onConfirm={handleConfirm}
          onReset={resetToUpload}
          preview={preview}
          scope={scope}
          setScope={setScope}
        />
      )}

      {step === "result" && result && (
        <ResultStep
          onBackToRole={backToRole}
          onViewAssessment={() => setLocation(`/admin/assessments/${result.assessmentSlug}`)}
          result={result}
        />
      )}
    </AdminShell>
  );
}

// ── Upload step ───────────────────────────────────────────────────────────────

function UploadStep({
  busy,
  fileInputRef,
  onDownloadTemplate,
  onFile,
  template,
}: {
  busy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDownloadTemplate: () => void;
  onFile: (file: File | undefined) => void;
  template: CsvTemplatePayload | null;
}) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
      <article className="rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">1 · Download the template</h3>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          The template contains every supported column — including the new{" "}
          <span className="font-medium text-primary">dimension_name</span>,{" "}
          <span className="font-medium text-primary">dimension_weight</span> and{" "}
          <span className="font-medium text-primary">dimension_floor</span> columns. Fill these
          in if the role does not yet have an Evaluation Framework and you want the importer to
          create it automatically.
        </p>
        <FoundationButton className="mt-4" onClick={onDownloadTemplate} variant="secondary">
          <Download className="size-4" />
          Download CSV Template
        </FoundationButton>

        <h3 className="mt-8 text-lg font-semibold tracking-[-0.02em] text-primary">2 · Upload the completed file</h3>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          CSV files only, up to 100 questions per file. The file is validated and previewed —
          nothing is saved until you confirm.
        </p>
        <input
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FoundationButton disabled={busy} onClick={() => fileInputRef.current?.click()} variant="tertiary">
            <Upload className="size-4" />
            {busy ? "Validating…" : "Upload CSV file"}
          </FoundationButton>
          <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <FileText className="size-4" />.csv only
          </span>
        </div>
      </article>

      <article className="h-fit rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-portal-blue" />
          <h3 className="text-base font-semibold tracking-[-0.02em] text-primary">How it works</h3>
        </div>
        <ol className="mt-4 space-y-3">
          {(template?.instructions ?? []).map((instruction) => (
            <li className="flex gap-2.5 text-[13px] leading-6 text-muted-foreground" key={instruction}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-portal-border-strong" />
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}

// ── Framework step ────────────────────────────────────────────────────────────

function FrameworkStep({
  busy,
  fileName,
  frameworkPreview,
  frameworkState,
  onCreateFramework,
  onGoToFramework,
  onReset,
  roleSlug,
  structurallyValidCount,
  detected,
}: {
  busy: boolean;
  detected: number;
  fileName: string;
  frameworkPreview: CsvFrameworkPreviewDto;
  frameworkState: "no_framework" | "partial" | "conflict";
  onCreateFramework: () => void;
  onGoToFramework: () => void;
  onReset: () => void;
  roleSlug: string;
  structurallyValidCount: number;
}) {
  const isConflict = frameworkState === "conflict";
  const isPartial = frameworkState === "partial";

  const missingDims = frameworkPreview.dimensions.filter((d) => d.isNew);
  const conflictDims = frameworkPreview.dimensions.filter((d) => d.conflictsWith !== null);

  const headingText = isConflict
    ? "Framework conflict"
    : isPartial
      ? "Additional dimensions required"
      : "Evaluation Framework required";

  const bodyText = isConflict
    ? `This CSV references ${conflictDims.length} dimension${conflictDims.length !== 1 ? "s" : ""} that already exist for this role but with different configuration.`
    : isPartial
      ? `This CSV references ${missingDims.length} dimension${missingDims.length !== 1 ? "s" : ""} that ${missingDims.length === 1 ? "is" : "are"} not currently configured for this role: ${missingDims.map((d) => d.code).join(", ")}.`
      : `This assessment references ${missingDims.length} scoring dimension${missingDims.length !== 1 ? "s" : ""} that ${missingDims.length === 1 ? "is" : "are"} not yet configured for this role: ${missingDims.map((d) => d.code).join(", ")}.`;

  return (
    <>
      <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Import preview</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {fileName ? `File: ${fileName} · ` : ""}
              {structurallyValidCount > 0 && structurallyValidCount === detected
                ? <span className="font-medium text-[#765d22]">{structurallyValidCount} of {detected} question configurations valid · Framework setup required</span>
                : <span className="font-medium text-[#765d22]">Framework configuration required before import can proceed.</span>
              }
            </p>
          </div>
          <FoundationButton onClick={onReset} variant="secondary">
            Choose a different file
          </FoundationButton>
        </div>
      </section>

      {/* Main framework notice */}
      <section className="mt-4 rounded-xl border border-[#eadfbd] bg-[#fffaf0] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#765d22]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-primary">{headingText}</h3>
            <p className="mt-1.5 text-[13px] leading-6 text-[#765d22]">{bodyText}</p>

            {/* Conflict details */}
            {isConflict && conflictDims.length > 0 && (
              <div className="mt-4 space-y-4">
                {conflictDims.map((dim) => (
                  <div className="rounded-lg border border-[#eadfbd] bg-white p-4" key={dim.code}>
                    <p className="text-[13px] font-semibold text-primary">Dimension {dim.code}</p>
                    <table className="mt-3 w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Field</th>
                          <th className="pb-2 pr-4 font-medium">Existing</th>
                          <th className="pb-2 font-medium">CSV</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border">
                          <td className="py-2 pr-4 text-muted-foreground">Name</td>
                          <td className="py-2 pr-4 text-primary">{dim.name}</td>
                          <td className="py-2 text-status-error-strong">{dim.conflictsWith!.name}</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="py-2 pr-4 text-muted-foreground">Weight</td>
                          <td className="py-2 pr-4 text-primary">{dim.weight}%</td>
                          <td className="py-2 text-status-error-strong">{dim.conflictsWith!.weight}%</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-muted-foreground">Floor</td>
                          <td className="py-2 pr-4 text-primary">
                            {dim.floor !== null ? `${dim.floor}%` : "None"}
                          </td>
                          <td className="py-2 text-status-error-strong">
                            {dim.conflictsWith!.floor !== null ? `${dim.conflictsWith!.floor}%` : "None"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
                <p className="text-[13px] text-[#765d22]">
                  Existing dimensions cannot be overwritten automatically. Resolve the conflict
                  in the Evaluation Framework editor, then re-upload this CSV.
                </p>
              </div>
            )}

            {/* Dimension table for missing dimensions */}
            {!isConflict && missingDims.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#eadfbd]">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <thead className="border-b border-[#eadfbd] bg-[#fdf6e3]">
                    <tr>
                      {["Code", "Dimension", "Weight", "Floor"].map((heading) => (
                        <th
                          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#765d22]"
                          key={heading}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eadfbd]">
                    {missingDims.map((dim) => (
                      <tr key={dim.code}>
                        <td className="px-3 py-3 font-semibold text-primary">{dim.code}</td>
                        <td className="px-3 py-3 text-primary">
                          {dim.name || (
                            <span className="text-status-error-strong">Missing in CSV</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-primary">
                          {dim.weight > 0 ? (
                            `${dim.weight}%`
                          ) : (
                            <span className="text-status-error-strong">Missing in CSV</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {dim.floor !== null ? `${dim.floor}%` : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {missingDims.length > 0 && frameworkPreview.canAutoCreate && (
                    <tfoot className="border-t border-[#eadfbd] bg-[#fdf6e3]">
                      <tr>
                        <td className="px-3 py-2 text-[12px] text-muted-foreground" colSpan={2}>
                          Total weight of new dimensions
                        </td>
                        <td
                          className={`px-3 py-2 text-[12px] font-semibold ${frameworkPreview.newDimensionWeightTotal === 100 || frameworkPreview.allDimensionWeightTotal === 100 ? "text-status-success-strong" : "text-status-error-strong"}`}
                          colSpan={2}
                        >
                          {frameworkPreview.newDimensionWeightTotal}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* cannotAutoCreate reason */}
            {!isConflict && !frameworkPreview.canAutoCreate && frameworkPreview.cannotAutoCreateReason && (
              <div className="mt-4 flex gap-2 rounded-lg border border-status-error-strong/20 bg-red-50 px-3 py-3">
                <XCircle className="mt-0.5 size-4 shrink-0 text-status-error-strong" />
                <p className="text-[13px] leading-5 text-status-error-strong">
                  {frameworkPreview.cannotAutoCreateReason}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#eadfbd] pt-5">
          {!isConflict && frameworkPreview.canAutoCreate && (
            <FoundationButton disabled={busy} onClick={onCreateFramework}>
              <Settings className="size-4" />
              {busy ? "Creating framework…" : "Create framework from uploaded CSV"}
            </FoundationButton>
          )}
          <FoundationButton onClick={onGoToFramework} variant={frameworkPreview.canAutoCreate && !isConflict ? "secondary" : "tertiary"}>
            <ArrowRight className="size-4" />
            {isConflict ? "Resolve in Evaluation Framework" : frameworkPreview.canAutoCreate ? "Create framework myself" : "Configure Evaluation Framework"}
          </FoundationButton>
          <FoundationButton onClick={onReset} variant="secondary">
            Choose a different file
          </FoundationButton>
        </div>
        {!isConflict && !frameworkPreview.canAutoCreate && (
          <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
            After configuring the Evaluation Framework, return here and upload the CSV again to proceed.
          </p>
        )}
      </section>
    </>
  );
}

// ── Preview step ──────────────────────────────────────────────────────────────

function PreviewStep({
  canConfirm,
  fileName,
  onConfirm,
  onReset,
  preview,
  scope,
  setScope,
}: {
  canConfirm: boolean;
  fileName: string;
  onConfirm: () => void;
  onReset: () => void;
  preview: CsvImportPreviewDto;
  scope: CsvScope | null;
  setScope: (scope: CsvScope) => void;
}) {
  const allValid = preview.errorCount === 0 && preview.detected > 0;
  // When only framework errors are blocking, questions are structurally valid.
  const onlyFrameworkBlocking =
    !allValid &&
    preview.structurallyValidCount === preview.detected &&
    preview.structurallyValidCount > 0;

  const summaryText = allValid
    ? `${preview.detected} questions detected · ${preview.valid} valid · 0 errors`
    : onlyFrameworkBlocking
      ? `${preview.detected} questions detected · ${preview.structurallyValidCount} question configurations valid · Framework setup required`
      : `${preview.detected} questions detected · ${preview.valid} valid · ${preview.errorCount} errors`;

  return (
    <>
      <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">Import preview</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {fileName ? `File: ${fileName} · ` : ""}
              <span className={allValid ? "font-medium text-status-success-strong" : onlyFrameworkBlocking ? "font-medium text-[#765d22]" : "font-medium text-status-error-strong"}>
                {summaryText}
              </span>
            </p>
          </div>
          <FoundationButton onClick={onReset} variant="secondary">
            Choose a different file
          </FoundationButton>
        </div>

        {preview.assessment && (
          <div className="mt-4 flex gap-3 rounded-lg border border-[#d9e5f0] bg-[#f3f8fc] px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-portal-blue" />
            <p className="text-[13px] leading-6 text-primary">
              {preview.assessment.willCreate
                ? `A new Draft assessment "${preview.assessment.name}" will be created for this role.`
                : `Questions will be added to "${preview.assessment.name}" (${preview.assessment.status}).`}
            </p>
          </div>
        )}

        {preview.errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-status-error-strong/20 bg-red-50 px-4 py-3">
            <ul className="space-y-1">
              {preview.errors.map((message) => (
                <li className="text-[13px] font-medium text-status-error-strong" key={message}>
                  {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.rows.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[860px] text-left">
              <thead className="border-b border-border bg-portal-surface">
                <tr>
                  {["Order", "Code", "Question", "Type", "Dimension", "qWeight", "Max", "Options", "Status"].map(
                    (heading) => (
                      <th
                        className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                        key={heading}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((row) => (
                  <tr className={row.valid ? "" : "bg-red-50/60"} key={`${row.rowNumber}-${row.code}`}>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.order ?? "—"}</td>
                    <td className="px-3 py-3 text-[13px] font-medium text-primary">{row.code}</td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate text-[13px] text-primary" title={row.question}>
                        {row.question}
                      </p>
                      {!row.valid && row.errors.length > 0 && (
                        <p className="mt-1 text-[12px] font-medium text-status-error-strong">
                          {row.errors.join("; ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.type}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.dimension || "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.qWeight ?? "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.maxScore ?? "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.optionCount}</td>
                    <td className="px-3 py-3">
                      {row.valid ? (
                        <span className="inline-flex rounded-md bg-[#e9f6ee] px-2 py-0.5 text-[11px] font-medium text-status-success-strong">
                          {row.status}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-[#fdeaea] px-2 py-0.5 text-[11px] font-medium text-status-error-strong">
                          Row {row.rowNumber} error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-none sm:p-6">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">
          Where should these questions be stored?
        </h3>
        <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
          Choose one. Both store questions in the same tables and are scored identically; they differ only in reuse.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(SCOPE_COPY) as CsvScope[]).map((value) => {
            const selected = scope === value;
            return (
              <label
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  selected
                    ? "border-portal-blue bg-portal-blue-soft/40"
                    : "border-border bg-white hover:border-portal-border-strong"
                }`}
                key={value}
              >
                <input
                  checked={selected}
                  className="mt-1 size-4 shrink-0 accent-portal-blue"
                  name="csv-import-scope"
                  onChange={() => setScope(value)}
                  type="radio"
                  value={value}
                />
                <span>
                  <span className="block text-sm font-semibold text-primary">{SCOPE_COPY[value].title}</span>
                  <span className="mt-1 block text-[13px] leading-6 text-muted-foreground">
                    {SCOPE_COPY[value].description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {!allValid && (
          <p className="mt-4 flex items-center gap-2 text-[13px] font-medium text-[#765d22]">
            <AlertTriangle className="size-4" />
            Resolve every row error before Confirm Import is enabled.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <FoundationButton disabled={!canConfirm} onClick={onConfirm}>
            <CheckCircle2 className="size-4" />
            Confirm Import
          </FoundationButton>
          <span className="text-[13px] text-muted-foreground">
            {scope ? `Storing: ${SCOPE_COPY[scope].title}` : "Select a storage option to continue."}
          </span>
        </div>
      </section>
    </>
  );
}

// ── Result step ───────────────────────────────────────────────────────────────

function ResultStep({
  onBackToRole,
  onViewAssessment,
  result,
}: {
  onBackToRole: () => void;
  onViewAssessment: () => void;
  result: CsvImportResultDto;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-white p-6 shadow-none sm:p-8">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#e9f6ee] text-status-success-strong">
        <CheckCircle2 className="size-5" />
      </div>
      <h3 className="mt-4 text-center text-xl font-semibold tracking-[-0.025em] text-primary">
        Import complete
      </h3>
      <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
        {result.importedCount} {result.importedCount === 1 ? "question" : "questions"} imported into{" "}
        <span className="font-medium text-primary">{result.assessmentName}</span>
        {result.createdAssessment ? " (a new assessment was created)." : "."}
      </p>
      <p className="mt-1 text-center text-[13px] text-muted-foreground">
        Stored as {result.scope === "ROLE_ONLY" ? "role-only questions" : "Question Bank questions"}.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <FoundationButton onClick={onViewAssessment}>View Assessment</FoundationButton>
        <FoundationButton onClick={onBackToRole} variant="secondary">
          Back to role
        </FoundationButton>
      </div>
    </section>
  );
}
