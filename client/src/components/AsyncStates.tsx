/**
 * Task 24C-1 — restrained async states for database-backed surfaces.
 *
 * Loading never shows a blank page, and errors never fall back to mock data:
 * failures stay visible with a Try again action.
 */
import { Loader2 } from "lucide-react";

export function DataLoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-busy="true" className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-6">
      <Loader2 className="size-5 animate-spin text-portal-blue" />
      <span className="text-sm font-medium text-muted-foreground">{label}…</span>
    </div>
  );
}

export function DataErrorState({ message = "Unable to load recruitment data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-white px-5 py-6" role="alert">
      <p className="text-sm font-semibold text-primary">{message}</p>
      {onRetry ? (
        <button className="mt-3 text-[13px] font-medium text-portal-blue transition-colors hover:text-primary hover:underline" onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}
