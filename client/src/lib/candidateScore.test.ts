/**
 * Task 24G — Overall Candidate Score helper tests.
 *
 * The Overall score lives entirely outside the assessment scoring engine: it
 * is a display-level average of Assessment Score and CV Score. Missing values
 * are never treated as zero, and a CV score of 0 is a valid reviewed score.
 */
import { describe, expect, it } from "vitest";
import {
  calculateOverallCandidateScore,
  describeCvScore,
  describeOverallCandidateScore,
  formatScore,
  validateCvScoreInput,
} from "@shared/candidateScore";

describe("calculateOverallCandidateScore", () => {
  it("averages both scores when both exist", () => {
    expect(calculateOverallCandidateScore(86, 74)).toBe(80);
    expect(calculateOverallCandidateScore(100, 80)).toBe(90);
    expect(calculateOverallCandidateScore(60, 100)).toBe(80);
  });

  it("treats a CV score of 0 as a valid reviewed score", () => {
    expect(calculateOverallCandidateScore(80, 0)).toBe(40);
  });

  it("returns null when either score is missing (never zero)", () => {
    expect(calculateOverallCandidateScore(86, null)).toBeNull();
    expect(calculateOverallCandidateScore(null, 74)).toBeNull();
    expect(calculateOverallCandidateScore(null, null)).toBeNull();
    expect(calculateOverallCandidateScore(undefined, 74)).toBeNull();
    expect(calculateOverallCandidateScore(86, undefined)).toBeNull();
  });
});

describe("describeOverallCandidateScore", () => {
  it("formats the average when both scores exist", () => {
    expect(describeOverallCandidateScore(86, 74)).toBe("80.0");
    expect(describeOverallCandidateScore(100, 80)).toBe("90.0");
    expect(describeOverallCandidateScore(60, 100)).toBe("80.0");
  });

  it("labels pending states in both directions", () => {
    expect(describeOverallCandidateScore(86, null)).toBe("Pending CV review");
    expect(describeOverallCandidateScore(null, 74)).toBe("Pending assessment");
    expect(describeOverallCandidateScore(null, null)).toBe("Pending");
  });

  it("never displays a missing score as zero", () => {
    expect(describeOverallCandidateScore(86, null)).not.toBe("43.0");
    expect(describeOverallCandidateScore(null, 74)).not.toBe("37.0");
  });
});

describe("describeCvScore", () => {
  it("formats a reviewed score, including a valid zero", () => {
    expect(describeCvScore(86, true)).toBe("86.0");
    expect(describeCvScore(0, true)).toBe("0.0");
  });

  it("distinguishes uploaded-but-unreviewed from not uploaded", () => {
    expect(describeCvScore(null, true)).toBe("Pending review");
    expect(describeCvScore(null, false)).toBe("Not uploaded");
  });
});

describe("formatScore", () => {
  it("formats to one decimal place", () => {
    expect(formatScore(80)).toBe("80.0");
    expect(formatScore(86.5)).toBe("86.5");
  });
});

describe("validateCvScoreInput", () => {
  it("accepts numeric scores between 0 and 100 with at most one decimal", () => {
    expect(validateCvScoreInput("86")).toEqual({ score: 86 });
    expect(validateCvScoreInput("74.5")).toEqual({ score: 74.5 });
    expect(validateCvScoreInput(100)).toEqual({ score: 100 });
    expect(validateCvScoreInput("0")).toEqual({ score: 0 });
    expect(validateCvScoreInput(" 90 ")).toEqual({ score: 90 });
  });

  it("treats 0 as valid rather than missing", () => {
    const result = validateCvScoreInput("0");
    expect("error" in result).toBe(false);
  });

  it("rejects scores below 0 or above 100", () => {
    expect(validateCvScoreInput("-1")).toHaveProperty("error");
    expect(validateCvScoreInput("100.1")).toHaveProperty("error");
    expect(validateCvScoreInput(101)).toHaveProperty("error");
  });

  it("rejects non-numeric and empty input", () => {
    expect(validateCvScoreInput("")).toHaveProperty("error");
    expect(validateCvScoreInput("abc")).toHaveProperty("error");
    expect(validateCvScoreInput(null)).toHaveProperty("error");
    expect(validateCvScoreInput(undefined)).toHaveProperty("error");
  });

  it("rejects more than one decimal place", () => {
    expect(validateCvScoreInput("74.25")).toHaveProperty("error");
  });
});
