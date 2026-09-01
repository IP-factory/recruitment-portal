/**
 * Task 24F — background autosave controller for the applicant assessment.
 *
 * Saving must never block answering: inputs stay enabled while saves run in
 * the background. This controller provides:
 * - Debounced scheduling (OPEN questions) so typing does not fire a request
 *   per keystroke.
 * - Immediate queuing (objective questions) with serialized execution.
 * - Latest-value-wins ordering: if a newer value arrives while an older save
 *   is in flight, the stale in-flight result can never overwrite the newer
 *   value — the newest value is always saved last.
 * - Failure retention: failed saves keep their value pending and are retried
 *   on the next save/flush, so answers are never silently lost.
 * - `flush()` for navigation points (Next) that awaits outstanding saves
 *   without disabling any input.
 *
 * Timers are injectable so the behavior is fully testable without a DOM.
 */

export type AutosavePhase = "idle" | "pending" | "saving" | "error";

export type AutosaveSaveFn = (questionId: string, payload: unknown) => Promise<unknown>;

export type TimerHandle = unknown;

export interface AutosaveTimers {
  setTimeout: (handler: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}

export interface CreateAutosaveOptions {
  save: AutosaveSaveFn;
  /** Debounce window for `schedule()` calls. Defaults to 700ms. */
  debounceMs?: number;
  timers?: AutosaveTimers;
  onPhaseChange?: (phase: AutosavePhase) => void;
}

export interface AutosaveController {
  /** Debounced save — used for OPEN free-text answers while typing. */
  schedule(questionId: string, payload: unknown): void;
  /** Immediate queued save — used for objective answers on selection. */
  saveNow(questionId: string, payload: unknown): void;
  /** Wait until every outstanding value has been persisted (or failed). */
  flush(): Promise<void>;
  /** Drop pending timers/values (e.g. on unmount). */
  cancel(): void;
  phase(): AutosavePhase;
  failedQuestionIds(): string[];
}

const defaultTimers: AutosaveTimers = {
  setTimeout: (handler, ms) => setTimeout(handler, ms) as TimerHandle,
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface PendingEntry {
  payload: unknown;
  seq: number;
}

export function createAutosaveController(options: CreateAutosaveOptions): AutosaveController {
  const { save, onPhaseChange } = options;
  const debounceMs = options.debounceMs ?? 700;
  const timers = options.timers ?? defaultTimers;

  const pending = new Map<string, PendingEntry>();
  const debouncing = new Map<string, TimerHandle>();
  const failed = new Set<string>();
  const queue: string[] = [];
  const waiters: Array<() => void> = [];
  let running = false;
  let seqCounter = 0;
  let lastPhase: AutosavePhase = "idle";

  function currentPhase(): AutosavePhase {
    if (running || queue.length > 0) return "saving";
    if (failed.size > 0) return "error";
    if (pending.size > 0) return "pending";
    return "idle";
  }

  function emit() {
    const next = currentPhase();
    if (next !== lastPhase) {
      lastPhase = next;
      onPhaseChange?.(next);
    }
  }

  function settleWaiters() {
    if (!running && queue.length === 0 && debouncing.size === 0) {
      const resolved = waiters.splice(0);
      for (const resolve of resolved) resolve();
    }
  }

  function enqueue(questionId: string) {
    if (!queue.includes(questionId)) queue.push(questionId);
    void pump();
    emit();
  }

  async function pump() {
    if (running) return;
    running = true;
    emit();
    while (queue.length > 0) {
      const questionId = queue.shift()!;
      const entry = pending.get(questionId);
      if (!entry) continue;
      try {
        await save(questionId, entry.payload);
        const latest = pending.get(questionId);
        if (latest && latest.seq === entry.seq) {
          pending.delete(questionId);
        } else if (latest) {
          // A newer value arrived while the older save was in flight: the
          // stale response must never win, so persist the newer value next.
          enqueue(questionId);
        }
        failed.delete(questionId);
      } catch {
        // Keep the pending value so the answer is never lost; it will be
        // retried by the next schedule/saveNow/flush call.
        failed.add(questionId);
      }
      emit();
    }
    running = false;
    emit();
    settleWaiters();
  }

  function record(questionId: string, payload: unknown): PendingEntry {
    const entry: PendingEntry = { payload, seq: ++seqCounter };
    pending.set(questionId, entry);
    failed.delete(questionId);
    const existingTimer = debouncing.get(questionId);
    if (existingTimer !== undefined) timers.clearTimeout(existingTimer);
    return entry;
  }

  function schedule(questionId: string, payload: unknown) {
    record(questionId, payload);
    debouncing.set(
      questionId,
      timers.setTimeout(() => {
        debouncing.delete(questionId);
        if (pending.has(questionId)) enqueue(questionId);
        else settleWaiters();
      }, debounceMs),
    );
    emit();
  }

  function saveNow(questionId: string, payload: unknown) {
    record(questionId, payload);
    debouncing.delete(questionId);
    enqueue(questionId);
  }

  function flush(): Promise<void> {
    // Promote every debounced value and every failed value into the queue.
    for (const [questionId, handle] of Array.from(debouncing.entries())) {
      timers.clearTimeout(handle);
      debouncing.delete(questionId);
      if (pending.has(questionId) && !queue.includes(questionId)) queue.push(questionId);
    }
    for (const questionId of Array.from(failed)) {
      if (pending.has(questionId) && !queue.includes(questionId)) queue.push(questionId);
    }
    void pump();
    if (!running && queue.length === 0 && debouncing.size === 0) return Promise.resolve();
    return new Promise<void>((resolve) => { waiters.push(resolve); });
  }

  function cancel() {
    for (const handle of Array.from(debouncing.values())) timers.clearTimeout(handle);
    debouncing.clear();
    pending.clear();
    failed.clear();
    queue.length = 0;
    emit();
    settleWaiters();
  }

  return {
    schedule,
    saveNow,
    flush,
    cancel,
    phase: currentPhase,
    failedQuestionIds: () => Array.from(failed),
  };
}
