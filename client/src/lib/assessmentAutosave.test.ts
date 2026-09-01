/**
 * Task 24F — autosave controller tests.
 *
 * Covers the UX guarantees from the spec: debounced OPEN saves, non-blocking
 * objective saves, typing during an in-flight save (latest value always wins),
 * failed saves retaining the answer for retry, and flush semantics used by
 * the Next button.
 */
import { describe, expect, it } from "vitest";
import { createAutosaveController, type AutosavePhase, type AutosaveTimers } from "./assessmentAutosave";

function createFakeTimers() {
  let nextId = 1;
  let now = 0;
  const timers = new Map<number, { handler: () => void; at: number }>();
  const fake: AutosaveTimers = {
    setTimeout: (handler, ms) => {
      const id = nextId++;
      timers.set(id, { handler, at: now + ms });
      return id;
    },
    clearTimeout: (handle) => { timers.delete(handle as number); },
  };
  return {
    fake,
    advance: (ms: number) => {
      now += ms;
      const due = Array.from(timers.entries()).filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.handler();
      }
    },
  };
}

/** Let queued microtasks (async pump) settle. */
const settle = () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

describe("assessment autosave controller", () => {
  it("debounces OPEN typing into a single save with the latest value", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    const controller = createAutosaveController({
      save: async (id, payload) => { calls.push({ id, payload }); },
      debounceMs: 700,
      timers: clock.fake,
    });

    controller.schedule("q-open", "Hel");
    controller.schedule("q-open", "Hello");
    controller.schedule("q-open", "Hello world");
    expect(calls).toHaveLength(0);

    clock.advance(700);
    await settle();
    expect(calls).toEqual([{ id: "q-open", payload: "Hello world" }]);
    expect(controller.phase()).toBe("idle");
  });

  it("saves objective answers immediately without blocking the caller", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    const controller = createAutosaveController({
      save: async (id, payload) => { calls.push({ id, payload }); },
      timers: clock.fake,
    });

    controller.saveNow("q-ordinal", "option-a");
    // saveNow returns synchronously — the UI never waits on the network.
    await settle();
    expect(calls).toEqual([{ id: "q-ordinal", payload: "option-a" }]);
    expect(controller.phase()).toBe("idle");
  });

  it("persists the latest value last when typing continues during an in-flight save", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    const gates: Array<() => void> = [];
    const controller = createAutosaveController({
      save: (id, payload) => {
        calls.push({ id, payload });
        return new Promise<void>((resolve) => { gates.push(resolve); });
      },
      debounceMs: 700,
      timers: clock.fake,
    });

    controller.schedule("q-open", "first draft");
    clock.advance(700);
    await settle();
    expect(calls).toHaveLength(1);

    // Keep typing while the first save is still in flight.
    controller.schedule("q-open", "first draft with more");
    gates[0]();
    await settle(); // the newer value is queued and its save starts
    gates[1]();
    await controller.flush();

    // The stale in-flight response never wins: the newer text is saved last.
    expect(calls).toEqual([
      { id: "q-open", payload: "first draft" },
      { id: "q-open", payload: "first draft with more" },
    ]);
    expect(controller.phase()).toBe("idle");
  });

  it("keeps a failed answer pending and retries it instead of losing it", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    let failNext = true;
    const phases: AutosavePhase[] = [];
    const controller = createAutosaveController({
      save: async (id, payload) => {
        calls.push({ id, payload });
        if (failNext) { failNext = false; throw new Error("network"); }
      },
      timers: clock.fake,
      onPhaseChange: (phase) => phases.push(phase),
    });

    controller.saveNow("q-open", "kept answer");
    await controller.flush();
    expect(controller.failedQuestionIds()).toEqual(["q-open"]);
    expect(controller.phase()).toBe("error");
    expect(phases).toContain("error");

    // Retrying (e.g. pressing Next again) persists the retained answer.
    await controller.flush();
    expect(controller.failedQuestionIds()).toEqual([]);
    expect(controller.phase()).toBe("idle");
    expect(calls.every((call) => call.payload === "kept answer")).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("flush resolves immediately when nothing is pending", async () => {
    const clock = createFakeTimers();
    const controller = createAutosaveController({ save: async () => undefined, timers: clock.fake });
    await expect(controller.flush()).resolves.toBeUndefined();
    expect(controller.phase()).toBe("idle");
  });

  it("flush promotes debounced values so Next never waits on the debounce window", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    const controller = createAutosaveController({
      save: async (id, payload) => { calls.push({ id, payload }); },
      debounceMs: 700,
      timers: clock.fake,
    });

    controller.schedule("q-open", "final text");
    expect(calls).toHaveLength(0);
    await controller.flush();
    expect(calls).toEqual([{ id: "q-open", payload: "final text" }]);
  });

  it("serializes saves across questions in latest-wins order", async () => {
    const clock = createFakeTimers();
    const calls: Array<{ id: string; payload: unknown }> = [];
    const controller = createAutosaveController({
      save: async (id, payload) => { calls.push({ id, payload }); },
      timers: clock.fake,
    });

    controller.saveNow("q1", "a");
    controller.saveNow("q2", "b");
    controller.saveNow("q1", "a2");
    await controller.flush();

    expect(calls).toHaveLength(3);
    // q1's first value is superseded before it can run; the latest value is persisted.
    expect(calls.filter((call) => call.id === "q1").at(-1)?.payload).toBe("a2");
    expect(controller.phase()).toBe("idle");
  });
});
