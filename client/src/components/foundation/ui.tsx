/**
 * Quiet Authority foundation primitives: restrained enterprise controls, clear workflow states,
 * and reusable surfaces built around Primary Navy, precise spacing, and functional hierarchy.
 */
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Filter,
  Info,
  Loader2,
  Search,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

const fileAccent = "/manus-storage/recruitment-portal-file-accent_366729da.png";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(22,38,61,0.16)] hover:bg-portal-navy-strong focus-visible:ring-primary",
  secondary:
    "border border-border bg-white text-primary hover:border-portal-blue hover:bg-portal-surface focus-visible:ring-primary",
  tertiary:
    "bg-transparent text-portal-blue hover:bg-portal-blue-soft focus-visible:ring-primary",
  destructive:
    "bg-status-error-strong text-white hover:bg-status-error-deep focus-visible:ring-status-error-strong",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

export function FoundationButton({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        buttonStyles[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      type="button"
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function SpecimenCard({
  children,
  className,
  variant = "standard",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: "standard" | "clickable" | "highlighted";
  onClick?: () => void;
}) {
  const variants = {
    standard: "border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.025)]",
    clickable:
      "border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.025)] transition-all duration-150 hover:-translate-y-0.5 hover:border-portal-blue hover:shadow-[0_8px_20px_rgba(22,38,61,0.08)]",
    highlighted: "border-portal-blue bg-portal-blue-wash shadow-[0_1px_2px_rgba(16,24,40,0.025)]",
  };

  return (
    <div
      className={cn("rounded-xl border p-6", variants[variant], onClick && "cursor-pointer", className)}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) onClick();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function FieldFrame({
  label,
  helper,
  error,
  children,
  required = false,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-1 text-status-error-strong">*</span> : null}
      </span>
      {children}
      {error ? <span className="block text-[13px] text-status-error-strong">{error}</span> : null}
      {!error && helper ? <span className="block text-[13px] text-muted-foreground">{helper}</span> : null}
    </label>
  );
}

export function FoundationInput({ error = false, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-portal-blue focus:outline-none focus:ring-2 focus:ring-portal-blue/20 disabled:cursor-not-allowed disabled:bg-portal-surface disabled:text-muted-foreground",
        error ? "border-status-error-strong focus:border-status-error-strong focus:ring-status-error-strong/15" : "border-input",
        className,
      )}
      {...props}
    />
  );
}

export function FoundationTextarea({ error = false, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-lg border bg-white px-3.5 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-portal-blue focus:outline-none focus:ring-2 focus:ring-portal-blue/20 disabled:cursor-not-allowed disabled:bg-portal-surface",
        error ? "border-status-error-strong focus:border-status-error-strong focus:ring-status-error-strong/15" : "border-input",
        className,
      )}
      {...props}
    />
  );
}

export function FoundationSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-lg border border-input bg-white bg-[linear-gradient(45deg,transparent_50%,#667085_50%),linear-gradient(135deg,#667085_50%,transparent_50%)] bg-[position:calc(100%_-_17px)_19px,calc(100%_-_12px)_19px] bg-[size:5px_5px,5px_5px] bg-no-repeat px-3.5 pr-9 text-sm text-foreground transition-colors focus:border-portal-blue focus:outline-none focus:ring-2 focus:ring-portal-blue/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SearchField({ placeholder = "Search candidates" }: { placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <FoundationInput aria-label={placeholder} className="pl-10" placeholder={placeholder} />
    </div>
  );
}

export function FileUploadBox() {
  return (
    <div className="rounded-xl border border-dashed border-portal-border-strong bg-white px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg bg-portal-surface">
        <img alt="" className="size-7 object-contain" src={fileAccent} />
      </div>
      <p className="text-sm font-medium text-primary">Upload a file</p>
      <p className="mt-1 text-[13px] text-muted-foreground">Drag and drop or select a file from your device.</p>
      <FoundationButton className="mt-4" size="sm" variant="secondary">
        <Upload className="size-3.5" /> Browse files
      </FoundationButton>
    </div>
  );
}

const statusClass: Record<string, string> = {
  Open: "status-open",
  Completed: "status-completed",
  "Not Started": "status-not-started",
  "In Progress": "status-in-progress",
  Submitted: "status-submitted",
  "Under Review": "status-under-review",
  Shortlisted: "status-shortlisted",
  Interview: "status-interview",
  Rejected: "status-rejected",
  Hired: "status-hired",
  Available: "status-available",
  Draft: "status-draft",
  Closed: "status-closed",
  "Closed — Eligibility": "status-closed",
  "Eligibility Closed": "status-closed",
  "Not Eligible": "status-closed",
  Hold: "status-under-review",
  Archived: "status-archived",
  Eligible: "status-completed",
  Failed: "status-error",
  Flagged: "status-under-review",
  "Not answered": "status-not-started",
  "Not assessed": "status-not-started",
  Active: "status-active",
  Inactive: "status-inactive",
};

export function StatusBadge({ status }: { status: keyof typeof statusClass }) {
  return <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium", statusClass[status])}>{status}</span>;
}

const steps = ["Profile", "Experience", "CV", "Assessment", "Review"];

export function ProgressStepper({ current = 2, steps: customSteps = steps }: { current?: number; steps?: readonly string[] }) {
  return (
    <ol className="relative grid gap-1 sm:gap-3" style={{ gridTemplateColumns: `repeat(${customSteps.length}, minmax(0, 1fr))` }} aria-label="Application progress">
      <div className="absolute top-4 hidden h-px bg-border sm:block" style={{ left: `calc(50% / ${customSteps.length})`, right: `calc(50% / ${customSteps.length})` }} aria-hidden="true" />
      {customSteps.map((step, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "upcoming";
        return (
          <li className="relative z-10 flex min-w-0 flex-col items-center text-center" key={step}>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                state === "complete" && "border-primary bg-primary text-white",
                state === "current" && "border-primary bg-white text-primary ring-4 ring-portal-blue-soft",
                state === "upcoming" && "border-border bg-white text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className={cn("mt-2 max-w-full truncate text-[11px] font-medium sm:text-xs", state === "upcoming" ? "text-muted-foreground" : "text-primary")}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

const alertMeta = {
  success: { icon: CheckCircle2, title: "Application saved", body: "Your latest changes have been recorded successfully." },
  warning: { icon: AlertTriangle, title: "Review required", body: "One or more items still need your attention before submission." },
  error: { icon: XCircle, title: "Unable to continue", body: "Please correct the highlighted information and try again." },
  info: { icon: Info, title: "Before you begin", body: "Keep supporting documents ready for the next step." },
};

export function AlertPanel({ type }: { type: keyof typeof alertMeta }) {
  const { icon: Icon, title, body } = alertMeta[type];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3.5", `alert-${type}`)} role="status">
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] leading-5 opacity-85">{body}</p>
      </div>
    </div>
  );
}

export function LoadingStates() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SpecimenCard className="space-y-4">
        <div className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-primary" /><span className="text-sm font-medium text-foreground">Loading candidates</span></div>
        <p className="text-[13px] text-muted-foreground">A restrained spinner supports short waiting states.</p>
      </SpecimenCard>
      <SpecimenCard className="space-y-3">
        <div className="h-4 w-2/5 rounded bg-portal-skeleton" />
        <div className="h-3 w-full rounded bg-portal-skeleton" />
        <div className="h-3 w-4/5 rounded bg-portal-skeleton" />
      </SpecimenCard>
    </div>
  );
}

export function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-portal-border-strong bg-white px-6 py-10 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-portal-surface text-primary"><FileSearch className="size-5" /></div>
      <h4 className="mt-4 text-base font-semibold text-foreground">No applications yet</h4>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Applications submitted through the portal will appear here for review.</p>
      <FoundationButton className="mt-5" onClick={onAction} size="sm">Start an application</FoundationButton>
    </div>
  );
}

export function CandidateTable({ onPlaceholder }: { onPlaceholder: (name: string) => void }) {
  const rows = [
    ["Maya Patel", "Business Development Manager", "86", "Shortlisted"] as const,
    ["Jordan Smith", "Business Development Manager", "74", "Under Review"] as const,
    ["Amara Okafor", "Business Development Manager", "91", "Interview"] as const,
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField />
        <FoundationButton onClick={() => onPlaceholder("Filters")} size="sm" variant="secondary"><Filter className="size-3.5" /> Filter</FoundationButton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead className="bg-portal-surface">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {["Candidate", "Role", "Score", "Status", "Action"].map((heading) => <th className="px-5 py-3.5" key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([candidate, role, score, status]) => (
              <tr className="text-sm text-foreground" key={candidate}>
                <td className="px-5 py-4 font-medium">{candidate}</td>
                <td className="px-5 py-4 text-muted-foreground">{role}</td>
                <td className="px-5 py-4 font-medium">{score}</td>
                <td className="px-5 py-4"><StatusBadge status={status} /></td>
                <td className="px-5 py-4"><button className="text-[13px] font-medium text-portal-blue hover:text-primary hover:underline" onClick={() => onPlaceholder(`${candidate} details`)} type="button">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
        <span>Showing 1–3 of 24</span>
        <div className="flex items-center gap-1">
          <button aria-label="Previous page" className="rounded-md p-1.5 hover:bg-portal-surface" type="button"><ChevronLeft className="size-4" /></button>
          <span className="rounded-md bg-portal-blue-soft px-2.5 py-1 font-medium text-primary">1</span>
          <button aria-label="Next page" className="rounded-md p-1.5 hover:bg-portal-surface" type="button"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 px-4" role="dialog">
      <button aria-label="Close confirmation dialog" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative w-full max-w-[470px] rounded-xl bg-white p-6 shadow-[0_20px_55px_rgba(16,24,40,0.24)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <button aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-portal-surface hover:text-foreground" onClick={onClose} type="button"><X className="size-4" /></button>
        <div className="flex size-10 items-center justify-center rounded-lg bg-portal-blue-soft text-primary"><AlertTriangle className="size-5" /></div>
        <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-foreground">Remove this application?</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This confirmation pattern is ready for future destructive actions. No data is changed in this foundation preview.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <FoundationButton onClick={onClose} variant="secondary">Cancel</FoundationButton>
          <FoundationButton onClick={onClose} variant="destructive">Remove application</FoundationButton>
        </div>
      </div>
    </div>
  );
}
