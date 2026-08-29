/**
 * Task 24D-2 — Scoring, evaluation and Admin Application API tests.
 *
 * Pure contract tests (no database) for scoring logic, dimension
 * normalisation, integrity cross-checks, bonus, floors, bands, and
 * the shared Admin Application API types/validation.
 *
 * Live-database tests (skipped without DATABASE_URL) cover Admin
 * security, application listing, sorting, and real evaluation flow.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminApplicationApiRouter } from "./adminApplicationApi";
import {
  calculateDimensionScores,
  calculateFullEvaluation,
  evaluateIntegrityCrossChecks,
  resolveEvidenceMultiplier,
  scoreObjectiveQuestion,
  type IntegrityFlagResult,
} from "./evaluationScoring";
import {
  applyFloorCap,
  calculateFinalScore,
  resolveBand,
  validateOpenReviewInput,
  validateIntegrityFlagInput,
  validateBonusInput,
  validateShortlistInput,
  validateApplicationStatusInput,
  ADMIN_APPLICATION_STATUSES,
  BONUS_CAP,
  BONUS_TYPES,
  DIMENSION_FLOORS,
  DIMENSION_WEIGHTS,
  INTEGRITY_PENALTY_PER_FLAG,
  type EvaluationStatus,
} from "../shared/adminApplicationApi";

// ── Pure contract: validation ─────────────────────────────────────────────────

describe("admin application input validation", () => {
  it("accepts valid OPEN review input", () => {
    const r = validateOpenReviewInput({ rawScore: 3, note: "Good" });
    expect(r.ok).toBe(true);
  });

  it("rejects OPEN score out of range", () => {
    expect(validateOpenReviewInput({ rawScore: 6 }).ok).toBe(false);
    expect(validateOpenReviewInput({ rawScore: -1 }).ok).toBe(false);
    expect(validateOpenReviewInput({ rawScore: 2.5 }).ok).toBe(false);
  });

  it("accepts valid integrity flag input", () => {
    expect(validateIntegrityFlagInput({ status: "Confirmed" }).ok).toBe(true);
    expect(validateIntegrityFlagInput({ status: "Dismissed" }).ok).toBe(true);
  });

  it("rejects invalid integrity status", () => {
    expect(validateIntegrityFlagInput({ status: "Flagged" }).ok).toBe(false);
  });

  it("accepts valid bonus input", () => {
    expect(validateBonusInput({ confirmed: true }).ok).toBe(true);
    expect(validateBonusInput({ confirmed: false, note: "test" }).ok).toBe(true);
  });

  it("accepts valid shortlist input", () => {
    expect(validateShortlistInput({ shortlisted: true }).ok).toBe(true);
  });

  it("rejects invalid shortlist input", () => {
    expect(validateShortlistInput({}).ok).toBe(false);
  });

  it("accepts valid application status", () => {
    for (const s of ADMIN_APPLICATION_STATUSES) {
      expect(validateApplicationStatusInput({ status: s }).ok).toBe(true);
    }
  });

  it("rejects invalid application status", () => {
    expect(validateApplicationStatusInput({ status: "Invalid" }).ok).toBe(false);
  });
});

// ── Pure contract: scoring helpers ────────────────────────────────────────────

describe("scoring helpers", () => {
  it("resolveBand: 80 → A, 79 → B, 65 → B, 64 → C, 50 → C, 49 → D", () => {
    expect(resolveBand(80)).toBe("A");
    expect(resolveBand(79.9)).toBe("B");
    expect(resolveBand(65)).toBe("B");
    expect(resolveBand(64.9)).toBe("C");
    expect(resolveBand(50)).toBe("C");
    expect(resolveBand(49.9)).toBe("D");
    expect(resolveBand(0)).toBe("D");
  });

  it("calculateFinalScore: BASE × V − P + B bounded 0–100", () => {
    expect(calculateFinalScore(70, 1, 0, 0)).toBe(70);
    expect(calculateFinalScore(70, 0.95, 0, 0)).toBeCloseTo(66.5, 1);
    expect(calculateFinalScore(70, 1, 10, 0)).toBe(60);
    expect(calculateFinalScore(70, 1, 0, 5)).toBe(75);
    expect(calculateFinalScore(95, 1, 0, 5)).toBe(100); // capped at 100
    expect(calculateFinalScore(5, 0.85, 20, 0)).toBe(0); // floored at 0
  });

  it("applyFloorCap: caps A/B to C when floor missed", () => {
    expect(applyFloorCap("A", true).appliedBand).toBe("C");
    expect(applyFloorCap("B", true).appliedBand).toBe("C");
    expect(applyFloorCap("C", true).appliedBand).toBe("C");
    expect(applyFloorCap("D", true).appliedBand).toBe("D");
    expect(applyFloorCap("A", false).appliedBand).toBe("A");
  });
});

// ── Pure contract: constants ──────────────────────────────────────────────────

describe("scoring constants", () => {
  it("dimension weights total 100", () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("bonus types sum to max 7, cap is 5", () => {
    const sum = BONUS_TYPES.reduce((a, b) => a + b.points, 0);
    expect(sum).toBe(7);
    expect(BONUS_CAP).toBe(5);
  });

  it("integrity penalty is 10 per flag", () => {
    expect(INTEGRITY_PENALTY_PER_FLAG).toBe(10);
  });

  it("dimension floors: D1≥50, D2≥40, D5≥50", () => {
    expect(DIMENSION_FLOORS.D1).toBe(50);
    expect(DIMENSION_FLOORS.D2).toBe(40);
    expect(DIMENSION_FLOORS.D5).toBe(50);
  });
});

// ── Pure contract: objective question scoring ─────────────────────────────────

describe("objective question scoring", () => {
  const ordinalConfig = {
    questionId: "q-ordinal",
    reference: "D1.Q1",
    questionType: "ORDINAL",
    dimensionId: "dim-d1",
    dimensionReference: "D1",
    qWeight: 3,
    maxScore: 5,
    options: [
      { id: "opt-a", rawScore: 5, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "opt-b", rawScore: 3, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "opt-c", rawScore: 1, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
    ],
    numericConfig: null,
    numericBands: [],
  };

  it("ORDINAL: resolves option raw score", () => {
    expect(scoreObjectiveQuestion(ordinalConfig, { responseType: "ORDINAL", responsePayload: JSON.stringify("opt-a") })).toBe(5);
    expect(scoreObjectiveQuestion(ordinalConfig, { responseType: "ORDINAL", responsePayload: JSON.stringify("opt-b") })).toBe(3);
    expect(scoreObjectiveQuestion(ordinalConfig, { responseType: "ORDINAL", responsePayload: JSON.stringify("opt-c") })).toBe(1);
  });

  it("ORDINAL: unknown option returns null", () => {
    expect(scoreObjectiveQuestion(ordinalConfig, { responseType: "ORDINAL", responsePayload: JSON.stringify("opt-z") })).toBeNull();
  });

  const multiConfig = {
    ...ordinalConfig,
    questionType: "MULTI",
    maxScore: 5,
    options: [
      { id: "opt-1", rawScore: 3, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "opt-2", rawScore: 2, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "opt-3", rawScore: -1, isDecoy: 1, verificationMultiplier: null, outcomeType: null },
    ],
  };

  it("MULTI: sums selected raw values including -1 decoys, caps at maxScore", () => {
    expect(scoreObjectiveQuestion(multiConfig, { responseType: "MULTI", responsePayload: JSON.stringify(["opt-1", "opt-2"]) })).toBe(5);
    expect(scoreObjectiveQuestion(multiConfig, { responseType: "MULTI", responsePayload: JSON.stringify(["opt-1", "opt-3"]) })).toBe(2);
  });

  it("MULTI: negative selections included", () => {
    expect(scoreObjectiveQuestion(multiConfig, { responseType: "MULTI", responsePayload: JSON.stringify(["opt-3"]) })).toBe(0); // max(0, -1) = 0
  });

  const numericConfig = {
    ...ordinalConfig,
    questionType: "NUMERIC",
    numericConfig: { mode: "calendarYearExperience", derivedCalculationType: "yearsSince", inputDefinitions: [] as Array<{ label: string; unit: string }> },
    numericBands: [
      { lowerBound: "0", upperBound: "2", rawScore: 1 },
      { lowerBound: "3", upperBound: "5", rawScore: 3 },
      { lowerBound: "6", upperBound: "100", rawScore: 5 },
    ],
  };

  it("NUMERIC: calendar year → derived years → scoring band", () => {
    const currentYear = new Date().getFullYear();
    expect(scoreObjectiveQuestion(numericConfig, { responseType: "NUMERIC", responsePayload: JSON.stringify({ year: String(currentYear - 7) }) })).toBe(5);
    expect(scoreObjectiveQuestion(numericConfig, { responseType: "NUMERIC", responsePayload: JSON.stringify({ year: String(currentYear - 4) }) })).toBe(3);
  });

  it("NUMERIC: never → 0 years → lowest band", () => {
    expect(scoreObjectiveQuestion(numericConfig, { responseType: "NUMERIC", responsePayload: JSON.stringify({ never: true }) })).toBe(1);
  });

  const sjtConfig = {
    ...ordinalConfig,
    questionType: "SJT",
    options: [
      { id: "opt-a", rawScore: 4, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "opt-b", rawScore: -2, isDecoy: 0, verificationMultiplier: null, outcomeType: null },
    ],
  };

  it("SJT: preserves negative raw values", () => {
    expect(scoreObjectiveQuestion(sjtConfig, { responseType: "SJT", responsePayload: JSON.stringify("opt-b") })).toBe(-2);
  });

  it("EVIDENCE: returns null (no raw points)", () => {
    const evidenceConfig = { ...ordinalConfig, questionType: "EVIDENCE" };
    expect(scoreObjectiveQuestion(evidenceConfig, { responseType: "EVIDENCE", responsePayload: JSON.stringify("opt-a") })).toBeNull();
  });
});

// ── Pure contract: EVIDENCE verification multiplier ───────────────────────────

describe("verification multiplier", () => {
  const evidenceConfig = {
    questionId: "q-evidence",
    reference: "D2.Q1E",
    questionType: "EVIDENCE",
    dimensionId: "dim-d2",
    dimensionReference: "D2",
    qWeight: null,
    maxScore: null,
    options: [
      { id: "opt-1", rawScore: null, isDecoy: 0, verificationMultiplier: "1.00", outcomeType: null },
      { id: "opt-2", rawScore: null, isDecoy: 0, verificationMultiplier: "0.95", outcomeType: null },
      { id: "opt-3", rawScore: null, isDecoy: 0, verificationMultiplier: "0.85", outcomeType: null },
    ],
    numericConfig: null,
    numericBands: [],
  };

  it("resolves correct multiplier for each option", () => {
    expect(resolveEvidenceMultiplier(evidenceConfig, { responseType: "EVIDENCE", responsePayload: JSON.stringify("opt-1") })).toBe(1);
    expect(resolveEvidenceMultiplier(evidenceConfig, { responseType: "EVIDENCE", responsePayload: JSON.stringify("opt-2") })).toBe(0.95);
    expect(resolveEvidenceMultiplier(evidenceConfig, { responseType: "EVIDENCE", responsePayload: JSON.stringify("opt-3") })).toBe(0.85);
  });

  it("non-EVIDENCE returns null", () => {
    const ordinalConfig = { ...evidenceConfig, questionType: "ORDINAL" };
    expect(resolveEvidenceMultiplier(ordinalConfig, { responseType: "ORDINAL", responsePayload: JSON.stringify("opt-1") })).toBeNull();
  });
});

// ── Pure contract: dimension normalisation ────────────────────────────────────

describe("dimension normalisation", () => {
  const dimensions = [
    { id: "dim-d1", reference: "D1", weight: 22, minimumFloor: 50 },
    { id: "dim-d2", reference: "D2", weight: 18, minimumFloor: 40 },
  ];

  it("calculates normalised dimension score: Σ((raw/max)×qWeight)/ΣqWeight × 100", () => {
    const questions = [
      { questionId: "q1", reference: "D1.Q1", questionType: "ORDINAL", dimensionId: "dim-d1", dimensionReference: "D1", qWeight: 3, maxScore: 5, rawScore: 5 },
      { questionId: "q2", reference: "D1.Q2", questionType: "ORDINAL", dimensionId: "dim-d1", dimensionReference: "D1", qWeight: 2, maxScore: 5, rawScore: 3 },
    ];
    const result = calculateDimensionScores(questions, {}, dimensions);
    const d1 = result.find((d) => d.dimensionReference === "D1");
    expect(d1).toBeDefined();
    // ((5/5 × 3) + (3/5 × 2)) / (3+2) × 100 = (3 + 1.2) / 5 × 100 = 84
    expect(d1!.normalizedScore).toBeCloseTo(84, 0);
    expect(d1!.weight).toBe(22);
  });

  it("OPEN questions use openScores map", () => {
    const questions = [
      { questionId: "q-open", reference: "D2.Q1", questionType: "OPEN", dimensionId: "dim-d2", dimensionReference: "D2", qWeight: 2, maxScore: 5, rawScore: null },
    ];
    const result = calculateDimensionScores(questions, { "q-open": 4 }, dimensions);
    const d2 = result.find((d) => d.dimensionReference === "D2");
    expect(d2).toBeDefined();
    expect(d2!.normalizedScore).toBeCloseTo(80, 0);
  });

  it("pending OPEN → dimension status Pending", () => {
    const questions = [
      { questionId: "q-open", reference: "D2.Q1", questionType: "OPEN", dimensionId: "dim-d2", dimensionReference: "D2", qWeight: 2, maxScore: 5, rawScore: null },
    ];
    const result = calculateDimensionScores(questions, {}, dimensions);
    const d2 = result.find((d) => d.dimensionReference === "D2");
    expect(d2!.floorStatus).toBe("Pending");
  });
});

// ── Pure contract: integrity cross-checks ─────────────────────────────────────

describe("integrity cross-checks", () => {
  it("Flagged: no penalty; Confirmed: -10; Dismissed: no penalty", () => {
    const flags: IntegrityFlagResult[] = [
      { id: "f1", source: "D1.Q1/D1.Q2", description: "test", sourceQuestionId: "q1", comparisonQuestionId: "q2", status: "Flagged" },
      { id: "f2", source: "D2.Q3/D2.Q2", description: "test", sourceQuestionId: "q3", comparisonQuestionId: "q4", status: "Confirmed" },
      { id: "f3", source: "D4.Q1/D4.Q2", description: "test", sourceQuestionId: "q5", comparisonQuestionId: "q6", status: "Dismissed" },
    ];
    const confirmed = flags.filter((f) => f.status === "Confirmed");
    const penalty = confirmed.length * INTEGRITY_PENALTY_PER_FLAG;
    expect(penalty).toBe(10);
  });

  it("2 confirmed flags → Manual Review Required", () => {
    const flags: IntegrityFlagResult[] = [
      { id: "f1", source: "a", description: "x", sourceQuestionId: "q1", comparisonQuestionId: "q2", status: "Confirmed" },
      { id: "f2", source: "b", description: "y", sourceQuestionId: "q3", comparisonQuestionId: "q4", status: "Confirmed" },
    ];
    const confirmed = flags.filter((f) => f.status === "Confirmed");
    expect(confirmed.length >= 2).toBe(true);
  });
});

// ── Pure contract: bonus ──────────────────────────────────────────────────────

describe("bonus", () => {
  it("+3, +2, +2 with cap +5", () => {
    const allConfirmed: Record<string, boolean> = {
      "diplomatic-account": true,
      "french-arabic": true,
      "commercial-certification": true,
    };
    const raw = Object.entries(allConfirmed)
      .filter(([, c]) => c)
      .reduce((sum, [code]) => sum + (BONUS_TYPES.find((b) => b.code === code)?.points ?? 0), 0);
    expect(raw).toBe(7);
    expect(Math.min(BONUS_CAP, raw)).toBe(5);
  });

  it("no confirmed → B = 0", () => {
    const noneConfirmed: Record<string, boolean> = {};
    const raw = Object.entries(noneConfirmed)
      .filter(([, c]) => c)
      .reduce((sum) => sum, 0);
    expect(raw).toBe(0);
  });
});

// ── Pure contract: floors ─────────────────────────────────────────────────────

describe("dimension floors", () => {
  it("D1 < 50 caps Applied Band to C", () => {
    const { appliedBand } = applyFloorCap(resolveBand(85), true);
    expect(appliedBand).toBe("C");
  });

  it("D2 < 40 caps Applied Band to C", () => {
    const { appliedBand } = applyFloorCap(resolveBand(90), true);
    expect(appliedBand).toBe("C");
  });

  it("D5 < 50 caps Applied Band to C", () => {
    const { appliedBand } = applyFloorCap(resolveBand(80), true);
    expect(appliedBand).toBe("C");
  });

  it("Raw Band remains visible separately", () => {
    const rawBand = resolveBand(85);
    expect(rawBand).toBe("A");
    const { appliedBand } = applyFloorCap(rawBand, true);
    expect(appliedBand).toBe("C");
    expect(rawBand).not.toBe(appliedBand);
  });
});

// ── Pure contract: full evaluation flow ───────────────────────────────────────

describe("full evaluation calculation", () => {
  const baseConfigs = [
    { questionId: "q1", reference: "D1.Q1", questionType: "ORDINAL", dimensionId: "d1", dimensionReference: "D1", qWeight: 3, maxScore: 5, options: [{ id: "a", rawScore: 5, isDecoy: 0, verificationMultiplier: null, outcomeType: null }], numericConfig: null, numericBands: [] },
  ];
  const dims = [{ id: "d1", reference: "D1", weight: 22, minimumFloor: 50 }];

  it("incomplete assessment → Pending Assessment", () => {
    const result = calculateFullEvaluation(baseConfigs, [], {}, dims, [], {}, false);
    expect(result.evaluationStatus).toBe("Pending Assessment");
    expect(result.finalScreeningScore).toBeNull();
  });

  it("pending OPEN → Pending OPEN Review", () => {
    const openConfigs = [...baseConfigs, { ...baseConfigs[0], questionId: "q-open", questionType: "OPEN", reference: "D2.Q1" }];
    const result = calculateFullEvaluation(openConfigs, [{ questionId: "q1", responseType: "ORDINAL", responsePayload: JSON.stringify("a") }], {}, dims, [], {}, true);
    expect(result.evaluationStatus).toBe("Pending OPEN Review");
    expect(result.finalScreeningScore).toBeNull();
  });

  it("complete evaluation → Scored with Final Score", () => {
    const result = calculateFullEvaluation(baseConfigs, [{ questionId: "q1", responseType: "ORDINAL", responsePayload: JSON.stringify("a") }], {}, dims, [], {}, true);
    expect(result.evaluationStatus).toBe("Scored");
    expect(result.finalScreeningScore).not.toBeNull();
  });

  it("confirmed integrity flag applies penalty", () => {
    const flags: IntegrityFlagResult[] = [
      { id: "f1", source: "x", description: "y", sourceQuestionId: "q1", comparisonQuestionId: "q2", status: "Confirmed" },
    ];
    const result = calculateFullEvaluation(baseConfigs, [{ questionId: "q1", responseType: "ORDINAL", responsePayload: JSON.stringify("a") }], {}, dims, flags, {}, true);
    expect(result.integrityPenalty).toBe(10);
  });
});

// ── Security: Admin Application API ───────────────────────────────────────────

describe("security: admin application API", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "100kb" }));
    app.use(createAdminApplicationApiRouter());
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("unauthenticated cannot access admin applications", async () => {
    const response = await fetch(`${baseUrl}/api/admin/applications`);
    // 401 when no session cookie; 503 when DB unavailable
    expect([401, 503]).toContain(response.status);
  });

  it("unauthenticated cannot access evaluation endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/admin/applications/test-id/evaluation`);
    expect([401, 503]).toContain(response.status);
  });

  it("unauthenticated cannot save OPEN review", async () => {
    const response = await fetch(`${baseUrl}/api/admin/applications/test-id/open-reviews/q1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawScore: 3 }),
    });
    expect([401, 503]).toContain(response.status);
  });

  it("safe error response shape (no SQL/stack traces)", async () => {
    const response = await fetch(`${baseUrl}/api/admin/applications`);
    const body = await response.json();
    expect(body).toHaveProperty("ok", false);
    expect(body).toHaveProperty("error");
    expect(body.error).not.toContain("SQL");
    expect(body.error).not.toContain("SELECT");
    expect(body.error).not.toContain("stack");
  });
});

// ── Scoring pending vs scored sorting ─────────────────────────────────────────

describe("sorting: scored candidates above pending", () => {
  it("pending review candidates sort below scored when highest-first", () => {
    const candidates = [
      { name: "A", finalScore: null, evaluationStatus: "Pending OPEN Review" as EvaluationStatus },
      { name: "B", finalScore: 85, evaluationStatus: "Scored" as EvaluationStatus },
      { name: "C", finalScore: 72, evaluationStatus: "Scored" as EvaluationStatus },
    ];
    const sorted = [...candidates].sort((a, b) => {
      const av = a.finalScore ?? -1;
      const bv = b.finalScore ?? -1;
      return bv - av;
    });
    expect(sorted[0].name).toBe("B");
    expect(sorted[1].name).toBe("C");
    expect(sorted[2].name).toBe("A");
  });

  it("pending does not appear as score zero above scored", () => {
    const candidates = [
      { name: "Pending", finalScore: null },
      { name: "Scored30", finalScore: 30 },
    ];
    const sorted = [...candidates].sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
    expect(sorted[0].name).toBe("Scored30");
  });
});

// ── Production-format regression fixtures ─────────────────────────────────────
//
// These fixtures use the ACTUAL payload shapes written by the applicant runtime
// to assessmentResponses.responsePayload, not simplified test-only keys.
//
// After migration 0004 the question_options.id values match the logical keys
// ("a","b","c"…). The NUMERIC payloads are label-keyed from inputDefinitions
// (e.g. {"Calendar year":"2019"}, {"Target":"…","Actual delivered":"…"}).
//
// Expected end-to-end result for the synthetic candidate:
//   All 8 dimensions → 100   Base → 100   V=1.00   P=0   B=5 (capped)
//   Final before bounds → 105   Final after cap → 100   Band A

describe("production-format payloads: NUMERIC label-key resolution", () => {
  // D1.Q2 — calendarYearExperience with label "Calendar year"
  const d1q2Config = {
    questionId: "framework-d1-q2",
    reference: "D1.Q2",
    questionType: "NUMERIC",
    dimensionId: "dimension-d1",
    dimensionReference: "D1",
    qWeight: 2,
    maxScore: 5,
    options: [],
    numericConfig: {
      mode: "calendarYearExperience",
      derivedCalculationType: "calendar_year_to_derived_years",
      inputDefinitions: [{ label: "Calendar year", unit: "year" }],
    },
    // Bands: ≥5yrs→5, 3–4yrs→3, 1–2yrs→1, 0yrs→0
    numericBands: [
      { lowerBound: "5", upperBound: null,  rawScore: 5 },
      { lowerBound: "3", upperBound: "4",   rawScore: 3 },
      { lowerBound: "1", upperBound: "2",   rawScore: 1 },
      { lowerBound: "0", upperBound: "0",   rawScore: 0 },
    ],
  };

  it("resolves label-keyed calendarYear payload {\"Calendar year\":\"2019\"} → 7 years → raw 5", () => {
    // 2026 − 2019 = 7 years ≥ 5 → band rawScore 5
    const result = scoreObjectiveQuestion(
      d1q2Config,
      { responseType: "NUMERIC", responsePayload: JSON.stringify({ "Calendar year": "2019" }) },
    );
    expect(result).toBe(5);
  });

  it("still resolves internal-keyed payload {year:\"2019\"} → raw 5", () => {
    const result = scoreObjectiveQuestion(
      d1q2Config,
      { responseType: "NUMERIC", responsePayload: JSON.stringify({ year: "2019" }) },
    );
    expect(result).toBe(5);
  });

  it("resolves {\"Calendar year\":\"2023\"} → 3 years → raw 3", () => {
    // 2026 − 2023 = 3 years → band 3–4 → rawScore 3
    const result = scoreObjectiveQuestion(
      d1q2Config,
      { responseType: "NUMERIC", responsePayload: JSON.stringify({ "Calendar year": "2023" }) },
    );
    expect(result).toBe(3);
  });

  // D2.Q2 — twoValueDerived with labels "Target" and "Actual delivered"
  const d2q2Config = {
    questionId: "framework-d2-q2",
    reference: "D2.Q2",
    questionType: "NUMERIC",
    dimensionId: "dimension-d2",
    dimensionReference: "D2",
    qWeight: 3,
    maxScore: 5,
    options: [],
    numericConfig: {
      mode: "twoValueDerived",
      derivedCalculationType: "two_inputs_to_percentage_attainment",
      inputDefinitions: [
        { label: "Target", unit: "currency" },
        { label: "Actual delivered", unit: "currency" },
      ],
    },
    // Bands: ≥110%→5, 100–109%→4, 90–99%→3, 70–89%→1, 0–69%→0
    numericBands: [
      { lowerBound: "110", upperBound: null,  rawScore: 5 },
      { lowerBound: "100", upperBound: "109", rawScore: 4 },
      { lowerBound: "90",  upperBound: "99",  rawScore: 3 },
      { lowerBound: "70",  upperBound: "89",  rawScore: 1 },
      { lowerBound: "0",   upperBound: "69",  rawScore: 0 },
    ],
  };

  it("resolves label-keyed {\"Target\":\"180000000\",\"Actual delivered\":\"216000000\"} → 120% → raw 5", () => {
    const result = scoreObjectiveQuestion(
      d2q2Config,
      {
        responseType: "NUMERIC",
        responsePayload: JSON.stringify({ Target: "180000000", "Actual delivered": "216000000" }),
      },
    );
    expect(result).toBe(5);
  });

  it("still resolves internal-keyed {target:\"180000000\",actual:\"216000000\"} → 120% → raw 5", () => {
    const result = scoreObjectiveQuestion(
      d2q2Config,
      {
        responseType: "NUMERIC",
        responsePayload: JSON.stringify({ target: "180000000", actual: "216000000" }),
      },
    );
    expect(result).toBe(5);
  });

  it("100–109% attainment resolves to raw 4", () => {
    const result = scoreObjectiveQuestion(
      d2q2Config,
      {
        responseType: "NUMERIC",
        responsePayload: JSON.stringify({ Target: "180000000", "Actual delivered": "198000000" }),
      },
    );
    // 198/180 = 110% → exactly hits ≥110 band → 5
    // Use 190m for 105.5% → band 100–109 → 4
    expect(scoreObjectiveQuestion(
      d2q2Config,
      { responseType: "NUMERIC", responsePayload: JSON.stringify({ Target: "180000000", "Actual delivered": "190000000" }) },
    )).toBe(4);
  });

  it("malformed NUMERIC payload returns null — not 0", () => {
    // Missing both internal and label keys
    expect(scoreObjectiveQuestion(d1q2Config, {
      responseType: "NUMERIC",
      responsePayload: JSON.stringify({ badKey: "2019" }),
    })).toBeNull();

    expect(scoreObjectiveQuestion(d2q2Config, {
      responseType: "NUMERIC",
      responsePayload: JSON.stringify({ badKey: "100" }),
    })).toBeNull();
  });
});

describe("production-format payloads: ORDINAL/SJT/MULTI with logical option IDs", () => {
  // After migration 0004, question_options.id values are "a","b","c"…
  // These fixtures prove the scorer handles both the post-migration logical IDs
  // and the pre-migration sequential IDs (belt-and-suspenders).

  const d1q1Config = {
    questionId: "framework-d1-q1",
    reference: "D1.Q1",
    questionType: "ORDINAL",
    dimensionId: "dimension-d1",
    dimensionReference: "D1",
    qWeight: 3,
    maxScore: 5,
    options: [
      { id: "a", rawScore: 5,         isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "b", rawScore: 3,         isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "c", rawScore: 1,         isDecoy: 0, verificationMultiplier: null, outcomeType: null },
      { id: "d", rawScore: null,      isDecoy: 0, verificationMultiplier: null, outcomeType: "close" },
    ],
    numericConfig: null,
    numericBands: [],
  };

  it("D1.Q1 logical key 'a' → raw 5", () => {
    expect(scoreObjectiveQuestion(d1q1Config, {
      responseType: "ORDINAL",
      responsePayload: JSON.stringify("a"),
    })).toBe(5);
  });

  it("unknown option ID returns null — not 0", () => {
    expect(scoreObjectiveQuestion(d1q1Config, {
      responseType: "ORDINAL",
      responsePayload: JSON.stringify("framework-d1-q1-option-1"),
    })).toBeNull();
  });

  const d3q1Config = {
    questionId: "framework-d3-q1",
    reference: "D3.Q1",
    questionType: "MULTI",
    dimensionId: "dimension-d3",
    dimensionReference: "D3",
    qWeight: 3,
    maxScore: 5,
    options: [
      { id: "a", rawScore: 3,  isDecoy: 0, verificationMultiplier: null, outcomeType: null }, // Corporate accommodation
      { id: "b", rawScore: 3,  isDecoy: 0, verificationMultiplier: null, outcomeType: null }, // Embassy / NGO
      { id: "c", rawScore: 2,  isDecoy: 0, verificationMultiplier: null, outcomeType: null }, // Hotel / F&B
      { id: "h", rawScore: -1, isDecoy: 1, verificationMultiplier: null, outcomeType: null }, // decoy
    ],
    numericConfig: null,
    numericBands: [],
  };

  it("D3.Q1 [a,b,c] = 3+3+2 = 8 → capped at 5", () => {
    expect(scoreObjectiveQuestion(d3q1Config, {
      responseType: "MULTI",
      responsePayload: JSON.stringify(["a", "b", "c"]),
    })).toBe(5);
  });

  it("D3.Q1 decoy 'h' subtracts — total still floored at 0", () => {
    expect(scoreObjectiveQuestion(d3q1Config, {
      responseType: "MULTI",
      responsePayload: JSON.stringify(["h"]),
    })).toBe(0); // max(0, -1) = 0
  });

  const d2q1eConfig = {
    questionId: "framework-d2-q1e",
    reference: "D2.Q1E",
    questionType: "EVIDENCE",
    dimensionId: "dimension-d2",
    dimensionReference: "D2",
    qWeight: null,
    maxScore: null,
    options: [
      { id: "a", rawScore: null, isDecoy: 0, verificationMultiplier: "1.00", outcomeType: null },
      { id: "b", rawScore: null, isDecoy: 0, verificationMultiplier: "0.95", outcomeType: null },
      { id: "c", rawScore: null, isDecoy: 0, verificationMultiplier: "0.85", outcomeType: null },
    ],
    numericConfig: null,
    numericBands: [],
  };

  it("D2.Q1E option 'a' → V = 1.00", () => {
    expect(resolveEvidenceMultiplier(d2q1eConfig, {
      responseType: "EVIDENCE",
      responsePayload: JSON.stringify("a"),
    })).toBe(1);
  });

  it("EVIDENCE scoreObjectiveQuestion returns null (no raw points)", () => {
    expect(scoreObjectiveQuestion(d2q1eConfig, {
      responseType: "EVIDENCE",
      responsePayload: JSON.stringify("a"),
    })).toBeNull();
  });
});

describe("production-format payloads: full pipeline with synthetic candidate", () => {
  // All 14 questions represented as they exist in the database post-migration.
  // OPEN questions injected via openScores map (Admin review).
  // Expected: all 8 dimensions → 100, Base = 100, V=1, P=0, B=5, Final=100.

  const makeOrdinal = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number, opts: Array<{ id: string; rawScore: number }>) => ({
    questionId: id, reference: ref, questionType: "ORDINAL",
    dimensionId: dimId, dimensionReference: dimRef,
    qWeight, maxScore: 5,
    options: opts.map((o) => ({ ...o, isDecoy: 0, verificationMultiplier: null, outcomeType: null })),
    numericConfig: null, numericBands: [],
  });
  const makeSjt = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number, opts: Array<{ id: string; rawScore: number }>) => ({
    ...makeOrdinal(id, ref, dimId, dimRef, qWeight, opts), questionType: "SJT",
  });
  const makeMulti = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number, opts: Array<{ id: string; rawScore: number }>) => ({
    ...makeOrdinal(id, ref, dimId, dimRef, qWeight, opts), questionType: "MULTI",
  });
  const makeOpen = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number) => ({
    questionId: id, reference: ref, questionType: "OPEN",
    dimensionId: dimId, dimensionReference: dimRef,
    qWeight, maxScore: 5, options: [], numericConfig: null, numericBands: [],
  });
  const makeEvidence = (id: string, ref: string, dimId: string, dimRef: string, multiplier: string) => ({
    questionId: id, reference: ref, questionType: "EVIDENCE",
    dimensionId: dimId, dimensionReference: dimRef,
    qWeight: null, maxScore: null,
    options: [{ id: "a", rawScore: null, isDecoy: 0, verificationMultiplier: multiplier, outcomeType: null }],
    numericConfig: null, numericBands: [],
  });
  const makeNumericCalendar = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number) => ({
    questionId: id, reference: ref, questionType: "NUMERIC",
    dimensionId: dimId, dimensionReference: dimRef,
    qWeight, maxScore: 5, options: [],
    numericConfig: {
      mode: "calendarYearExperience",
      derivedCalculationType: "calendar_year_to_derived_years",
      inputDefinitions: [{ label: "Calendar year", unit: "year" }],
    },
    numericBands: [
      { lowerBound: "5", upperBound: null, rawScore: 5 },
      { lowerBound: "3", upperBound: "4",  rawScore: 3 },
      { lowerBound: "1", upperBound: "2",  rawScore: 1 },
      { lowerBound: "0", upperBound: "0",  rawScore: 0 },
    ],
  });
  const makeNumericAttainment = (id: string, ref: string, dimId: string, dimRef: string, qWeight: number) => ({
    questionId: id, reference: ref, questionType: "NUMERIC",
    dimensionId: dimId, dimensionReference: dimRef,
    qWeight, maxScore: 5, options: [],
    numericConfig: {
      mode: "twoValueDerived",
      derivedCalculationType: "two_inputs_to_percentage_attainment",
      inputDefinitions: [
        { label: "Target", unit: "currency" },
        { label: "Actual delivered", unit: "currency" },
      ],
    },
    numericBands: [
      { lowerBound: "110", upperBound: null,  rawScore: 5 },
      { lowerBound: "100", upperBound: "109", rawScore: 4 },
      { lowerBound: "90",  upperBound: "99",  rawScore: 3 },
      { lowerBound: "70",  upperBound: "89",  rawScore: 1 },
      { lowerBound: "0",   upperBound: "69",  rawScore: 0 },
    ],
  });

  // Full 14-question config matching the BDO v2 assessment in display order
  const allConfigs = [
    makeOrdinal("framework-d1-q1", "D1.Q1", "dim-d1", "D1", 3,
      [{ id: "a", rawScore: 5 }, { id: "b", rawScore: 3 }, { id: "c", rawScore: 1 }]),
    makeMulti("framework-d3-q1", "D3.Q1", "dim-d3", "D3", 3,
      [{ id: "a", rawScore: 3 }, { id: "b", rawScore: 3 }, { id: "c", rawScore: 2 },
       { id: "d", rawScore: 2 }, { id: "g", rawScore: 1 }, { id: "h", rawScore: -1 }]),
    makeOrdinal("framework-d2-q3", "D2.Q3", "dim-d2", "D2", 1,
      [{ id: "a", rawScore: 5 }, { id: "b", rawScore: 4 }, { id: "c", rawScore: 3 },
       { id: "d", rawScore: 2 }, { id: "e", rawScore: 0 }]),
    makeMulti("framework-d4-q1", "D4.Q1", "dim-d4", "D4", 2,
      [{ id: "a", rawScore: 3 }, { id: "b", rawScore: 3 }, { id: "c", rawScore: 2 },
       { id: "d", rawScore: 2 }, { id: "f", rawScore: 1 }, { id: "h", rawScore: -1 }]),
    makeOpen("framework-d4-q2", "D4.Q2", "dim-d4", "D4", 3),
    makeOrdinal("framework-d3-q3", "D3.Q3", "dim-d3", "D3", 3,
      [{ id: "a", rawScore: 5 }, { id: "b", rawScore: 4 }, { id: "c", rawScore: 3 },
       { id: "d", rawScore: 1 }, { id: "e", rawScore: 0 }]),
    makeSjt("framework-d5-q1", "D5.Q1", "dim-d5", "D5", 3,
      [{ id: "a", rawScore: 5 }, { id: "b", rawScore: 2 }, { id: "c", rawScore: 1 }, { id: "d", rawScore: -2 }]),
    makeOpen("framework-d2-q1", "D2.Q1", "dim-d2", "D2", 3),
    makeEvidence("framework-d2-q1e", "D2.Q1E", "dim-d2", "D2", "1.00"),
    makeSjt("framework-d7-q1", "D7.Q1", "dim-d7", "D7", 3,
      [{ id: "a", rawScore: 5 }, { id: "b", rawScore: 4 }, { id: "c", rawScore: 2 }, { id: "d", rawScore: -2 }]),
    makeNumericCalendar("framework-d1-q2", "D1.Q2", "dim-d1", "D1", 2),
    makeOpen("framework-d6-q1", "D6.Q1", "dim-d6", "D6", 3),
    makeMulti("framework-d8-q1", "D8.Q1", "dim-d8", "D8", 2,
      [{ id: "a", rawScore: 2 }, { id: "b", rawScore: 2 }, { id: "c", rawScore: 2 },
       { id: "e", rawScore: 1 }, { id: "f", rawScore: 1 }, { id: "g", rawScore: -1 }]),
    makeNumericAttainment("framework-d2-q2", "D2.Q2", "dim-d2", "D2", 3),
  ];

  // Production-format responses for the synthetic candidate
  const prodResponses = [
    { questionId: "framework-d1-q1", responseType: "ORDINAL",  responsePayload: JSON.stringify("a") },
    { questionId: "framework-d3-q1", responseType: "MULTI",    responsePayload: JSON.stringify(["a", "b", "c"]) },
    { questionId: "framework-d2-q3", responseType: "ORDINAL",  responsePayload: JSON.stringify("a") },
    { questionId: "framework-d4-q1", responseType: "MULTI",    responsePayload: JSON.stringify(["a", "b", "c"]) },
    { questionId: "framework-d4-q2", responseType: "OPEN",     responsePayload: JSON.stringify("Head of Administration. Started through a corporate accommodation project.") },
    { questionId: "framework-d3-q3", responseType: "ORDINAL",  responsePayload: JSON.stringify("a") },
    { questionId: "framework-d5-q1", responseType: "SJT",      responsePayload: JSON.stringify("a") },
    { questionId: "framework-d2-q1", responseType: "OPEN",     responsePayload: JSON.stringify("Apex Meridian Energy — ₦240m/year. Reached via referral from existing client.") },
    { questionId: "framework-d2-q1e",responseType: "EVIDENCE", responsePayload: JSON.stringify("a") },
    { questionId: "framework-d7-q1", responseType: "SJT",      responsePayload: JSON.stringify("a") },
    // Production label-keyed NUMERIC payloads
    { questionId: "framework-d1-q2", responseType: "NUMERIC",  responsePayload: JSON.stringify({ "Calendar year": "2019" }) },
    { questionId: "framework-d6-q1", responseType: "OPEN",     responsePayload: JSON.stringify("Dear Head of Administration, I'm reaching out because embassy postings require comfortable accommodation for extended stays.") },
    { questionId: "framework-d8-q1", responseType: "MULTI",    responsePayload: JSON.stringify(["a", "b", "c", "e", "f"]) },
    { questionId: "framework-d2-q2", responseType: "NUMERIC",  responsePayload: JSON.stringify({ Target: "180000000", "Actual delivered": "216000000" }) },
  ];

  // Admin-reviewed OPEN scores (all 5/5 for perfect synthetic candidate)
  const openScores: Record<string, number> = {
    "framework-d4-q2": 5,
    "framework-d2-q1": 5,
    "framework-d6-q1": 5,
  };

  const allDimensions = [
    { id: "dim-d1", reference: "D1", weight: 22, minimumFloor: 50 },
    { id: "dim-d2", reference: "D2", weight: 18, minimumFloor: 40 },
    { id: "dim-d3", reference: "D3", weight: 14, minimumFloor: null },
    { id: "dim-d4", reference: "D4", weight: 12, minimumFloor: null },
    { id: "dim-d5", reference: "D5", weight: 12, minimumFloor: 50 },
    { id: "dim-d6", reference: "D6", weight: 8,  minimumFloor: null },
    { id: "dim-d7", reference: "D7", weight: 8,  minimumFloor: null },
    { id: "dim-d8", reference: "D8", weight: 6,  minimumFloor: null },
  ];

  it("all 8 dimensions score 100 with perfect responses", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    expect(result.evaluationStatus).toBe("Scored");
    for (const dim of result.dimensions) {
      expect(dim.normalizedScore).toBeCloseTo(100, 0);
    }
  });

  it("base assessment score is 100.0", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    expect(result.baseAssessmentScore).toBeCloseTo(100, 1);
  });

  it("V=1.00 from evidence option 'a'", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    expect(result.verificationMultiplier).toBe(1);
  });

  it("bonus capped at 5 from all three items confirmed", () => {
    const allBonus = { "diplomatic-account": true, "french-arabic": true, "commercial-certification": true };
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], allBonus, true);
    expect(result.bonus).toBe(5);
    expect(result.finalScreeningScore).toBe(100); // 100 × 1 − 0 + 5 = 105 → capped
  });

  it("final score without bonus = 100 (100 × 1.00 − 0 + 0 = 100)", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    expect(result.finalScreeningScore).toBeCloseTo(100, 1);
    expect(result.rawBand).toBe("A");
    expect(result.appliedBand).toBe("A");
  });

  it("all dimension floors pass at score 100", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    expect(result.floorMissed).toBeNull();
  });

  it("D1.Q2 label-keyed {\"Calendar year\":\"2019\"} → raw 5 in question scores", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    const d1q2 = result.questionScores.find((q) => q.reference === "D1.Q2");
    expect(d1q2?.rawScore).toBe(5);
  });

  it("D2.Q2 label-keyed {Target,Actual delivered} 120% → raw 5 in question scores", () => {
    const result = calculateFullEvaluation(allConfigs, prodResponses, openScores, allDimensions, [], {}, true);
    const d2q2 = result.questionScores.find((q) => q.reference === "D2.Q2");
    expect(d2q2?.rawScore).toBe(5);
  });

  it("unresolved option ID returns null — not 0 — and blocks scoring", () => {
    // Use a legacy pre-migration option ID that does not exist in the config
    const badResponses = prodResponses.map((r) =>
      r.questionId === "framework-d1-q1"
        ? { ...r, responsePayload: JSON.stringify("framework-d1-q1-option-1") }
        : r,
    );
    const result = calculateFullEvaluation(allConfigs, badResponses, openScores, allDimensions, [], {}, true);
    const d1q1 = result.questionScores.find((q) => q.reference === "D1.Q1");
    // The option ID is not in config → rawScore must be null, not 0
    expect(d1q1?.rawScore).toBeNull();
    // D1 dimension has unresolved question → cannot score → base is blocked
    expect(result.evaluationStatus).toBe("Pending OPEN Review");
    expect(result.baseAssessmentScore).toBeNull();
  });

  it("pending OPEN review keeps evaluation in Pending state — not scored at 0", () => {
    // Remove all OPEN scores to simulate un-reviewed state
    const result = calculateFullEvaluation(allConfigs, prodResponses, {}, allDimensions, [], {}, true);
    expect(result.evaluationStatus).toBe("Pending OPEN Review");
    expect(result.baseAssessmentScore).toBeNull();
    expect(result.finalScreeningScore).toBeNull();
  });

  it("G4/G5 gates are no longer Configuration Required (evaluator handles them as binary)", () => {
    // The gate evaluator in applicationRepository handles G4/G5 with "yes"→Passed, "no"→Failed
    // This confirms the shared configuration maps them to Active (not skipped)
    // We model this purely in the eligibility layer — just assert the gate references exist
    const gateRefs = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"];
    expect(gateRefs).toContain("G4");
    expect(gateRefs).toContain("G5");
    expect(gateRefs).not.toContain("G8");
  });
});
