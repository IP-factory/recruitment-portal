import { describe, expect, it } from "vitest";
import { ASSESSMENT_V2_PREVIEW_STORAGE_KEY, EMPTY_PREVIEW_STATE, countPreviewWords, formatPreviewRemaining, trimPreviewWords } from "@/lib/assessmentPreviewData";

describe("assessment preview helpers", () => {
  it("counts words without treating punctuation as separate words", () => {
    expect(countPreviewWords("  A clear, concise proposal.  ")).toBe(4);
    expect(countPreviewWords("\n\t")).toBe(0);
  });

  it("trims an OPEN response at the configured word limit while preserving shorter responses", () => {
    expect(trimPreviewWords("one two three four", 3)).toBe("one two three");
    expect(trimPreviewWords("one two", 3)).toBe("one two");
  });

  it("formats a restrained countdown and clamps expired values", () => {
    expect(formatPreviewRemaining(84)).toBe("01:24");
    expect(formatPreviewRemaining(0)).toBe("00:00");
    expect(formatPreviewRemaining(-12)).toBe("00:00");
  });

  it("keeps preview persistence separate from the live assessment state", () => {
    expect(ASSESSMENT_V2_PREVIEW_STORAGE_KEY).not.toContain("bdm:assessment-responses");
    expect(EMPTY_PREVIEW_STATE).toEqual({ answers: {}, currentQuestionIndex: 0 });
  });
});
