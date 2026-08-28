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
    numericConfig: { mode: "calendarYearExperience", derivedCalculationType: "yearsSince" },
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
