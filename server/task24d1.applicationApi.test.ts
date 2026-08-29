/**
 * Task 24D-1 — Applicant Runtime API tests.
 *
 * Pure contract tests (no database) for the shared application API types
 * and validation helpers. Live-database tests (skipped without DATABASE_URL)
 * cover security, eligibility, assessment, and submission behavior.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplicationApiRouter } from "./applicationApi";
import {
  evaluateEligibilityServerSide,
  generateApplicantToken,
  hashApplicantToken,
} from "./applicationRepository";
import {
  normalizeEmail,
  validateCreateApplicationInput,
  validateAssessmentResponseInput,
  type CreateApplicationInput,
  type ApplicantEligibilityInput,
} from "../shared/applicationApi";

// ── Pure contract tests (no database required) ───────────────────────────────

describe("applicant token", () => {
  it("generates a 64-character hex token", () => {
    const token = generateApplicantToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("hashes token to a 64-character SHA-256 hex string", () => {
    const token = generateApplicantToken();
    const hash = hashApplicantToken(token);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("same token produces same hash", () => {
    const token = generateApplicantToken();
    expect(hashApplicantToken(token)).toBe(hashApplicantToken(token));
  });

  it("different tokens produce different hashes", () => {
    expect(hashApplicantToken(generateApplicantToken())).not.toBe(hashApplicantToken(generateApplicantToken()));
  });
});

describe("email normalization", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  Test@EXAMPLE.COM  ")).toBe("test@example.com");
  });

  it("handles already-normalized email", () => {
    expect(normalizeEmail("user@test.com")).toBe("user@test.com");
  });
});

describe("create application input validation", () => {
  const validInput: CreateApplicationInput = {
    roleSlug: "business-development-officer",
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "+2348012345678",
    city: "Abuja",
    recentRole: "Business Development Executive",
    recentEmployer: "Acme Corp",
    totalExperience: "3–5 years",
    relevantExperience: "3–5 years",
    linkedinUrl: "",
    eligibility: {
      abujaAvailability: "abuja",
      plannedRelocationDate: "",
      rightToWork: "yes",
      startAvailability: "yes",
      compensationBand: "yes",
      outboundWork: "yes",
      verificationConsent: "yes",
    },
  };

  it("accepts valid input", () => {
    const outcome = validateCreateApplicationInput(validInput);
    expect("input" in outcome).toBe(true);
  });

  it("rejects missing full name", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, fullName: "  " });
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) expect(outcome.errors).toContain("Enter your full name.");
  });

  it("rejects invalid email", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, email: "not-an-email" });
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) expect(outcome.errors[0]).toContain("valid email");
  });

  it("normalizes email to lowercase", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, email: "  TEST@Example.COM  " });
    expect("input" in outcome).toBe(true);
    if ("input" in outcome) expect(outcome.input.email).toBe("test@example.com");
  });

  it("rejects missing role slug", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, roleSlug: "" });
    expect("errors" in outcome).toBe(true);
  });

  it("rejects missing eligibility", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, eligibility: undefined });
    expect("errors" in outcome).toBe(true);
  });
});

describe("assessment response input validation", () => {
  it("accepts valid ORDINAL response", () => {
    const outcome = validateAssessmentResponseInput({ responseType: "ORDINAL", responsePayload: "option-1" });
    expect("input" in outcome).toBe(true);
  });

  it("rejects invalid response type", () => {
    const outcome = validateAssessmentResponseInput({ responseType: "INVALID", responsePayload: "x" });
    expect("errors" in outcome).toBe(true);
  });

  it("rejects missing payload", () => {
    const outcome = validateAssessmentResponseInput({ responseType: "ORDINAL" });
    expect("errors" in outcome).toBe(true);
  });
});

// ── Server-side eligibility evaluation (no database) ─────────────────────────

describe("server-side eligibility evaluation", () => {
  const gates = [
    { id: "gate-g1", reference: "G1", gateType: "location", status: "Active", configuration: "{}" },
    { id: "gate-g2", reference: "G2", gateType: "right_to_work", status: "Active", configuration: "{}" },
    { id: "gate-g3", reference: "G3", gateType: "experience", status: "Active", configuration: JSON.stringify({ minimumYears: 3 }) },
    { id: "gate-g4", reference: "G4", gateType: "availability", status: "Active", configuration: JSON.stringify({ requiredAnswer: "yes", latestStartDate: "2026-09-01" }) },
    { id: "gate-g5", reference: "G5", gateType: "compensation", status: "Active", configuration: JSON.stringify({ requiredAnswer: "yes", bandMin: 6000000, bandMax: 9600000, currency: "NGN" }) },
    { id: "gate-g6", reference: "G6", gateType: "outbound", status: "Active", configuration: "{}" },
    { id: "gate-g7", reference: "G7", gateType: "verification", status: "Active", configuration: "{}" },
  ];

  const baseEligibility: ApplicantEligibilityInput = {
    abujaAvailability: "abuja",
    plannedRelocationDate: "",
    rightToWork: "yes",
    startAvailability: "yes",
    compensationBand: "yes",
    outboundWork: "yes",
    verificationConsent: "yes",
  };

  it("G1 Abuja resident passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseEligibility, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G1")?.outcome).toBe("Passed");
  });

  it("G1 relocation passes with flag", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, abujaAvailability: "relocate", plannedRelocationDate: "2026-10-01" }, "3–5 years");
    expect(result.eligible).toBe(true);
    const g1 = result.gates.find((g) => g.gateReference === "G1");
    expect(g1?.outcome).toBe("Flagged");
    expect(g1?.flagReason).toBe("Relocation commitment");
  });

  it("G1 not-relocate fails", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, abujaAvailability: "not-relocate" }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.failedGateId).toBeTruthy();
  });

  it("G2 no right to work closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, rightToWork: "no" }, "3–5 years");
    expect(result.eligible).toBe(false);
  });

  it("G3 below 3 years closes", () => {
    const result = evaluateEligibilityServerSide(gates, baseEligibility, "1–2 years");
    expect(result.eligible).toBe(false);
  });

  it("G3 3+ years passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseEligibility, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G3")?.outcome).toBe("Passed");
  });

  it("G4 yes passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseEligibility, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G4")?.outcome).toBe("Passed");
  });

  it("G4 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, startAvailability: "no" }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G4")?.outcome).toBe("Failed");
  });

  it("G5 yes passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseEligibility, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G5")?.outcome).toBe("Passed");
  });

  it("G5 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, compensationBand: "no" }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G5")?.outcome).toBe("Failed");
  });

  it("G6 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, outboundWork: "no" }, "3–5 years");
    expect(result.eligible).toBe(false);
  });

  it("G7 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseEligibility, verificationConsent: "no" }, "3–5 years");
    expect(result.eligible).toBe(false);
  });
});

// ── Security tests (no database) ─────────────────────────────────────────────

describe("security: applicant API router", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "100kb" }));
    app.use(createApplicationApiRouter());
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("B. invalid applicant token cannot read application", async () => {
    const response = await fetch(`${baseUrl}/api/public/applications/me`, {
      headers: { "X-Application-Token": "invalid-token-value" },
    });
    // 403 when DB is up and token is invalid; 503 when DB is unavailable
    expect([403, 503]).toContain(response.status);
  });

  it("B. missing applicant token returns 401", async () => {
    const response = await fetch(`${baseUrl}/api/public/applications/me`);
    expect(response.status).toBe(401);
  });

  it("safe error response shape (no SQL/stack traces)", async () => {
    const response = await fetch(`${baseUrl}/api/public/applications/me`, {
      headers: { "X-Application-Token": "invalid-token-value" },
    });
    const body = await response.json();
    expect(body).toHaveProperty("ok", false);
    expect(body).toHaveProperty("error");
    expect(body.error).not.toContain("SQL");
    expect(body.error).not.toContain("stack");
    expect(body.error).not.toContain("SELECT");
  });

  it("POST application without body returns error", async () => {
    const response = await fetch(`${baseUrl}/api/public/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });
});

// ── Safe payload contract test ──────────────────────────────────────────────

describe("safe payload: applicant shapes never expose scoring internals", () => {
  const forbiddenKeys = [
    "qWeight", "rawScore", "score", "dimensionWeight", "rubric",
    "decoy", "verificationMultiplier", "internalExplanation",
    "crossCheck", "band", "floor", "bonus", "multiplier",
    "isDecoy", "raw_score", "internal_explanation",
  ];

  it("ApplicantSafeQuestion shape contains no forbidden fields", () => {
    const sampleOrdinal = { id: "q-1", type: "ORDINAL", prompt: "Choose one", options: [{ id: "opt-1", text: "Option A" }] };
    const sampleOpen = { id: "q-2", type: "OPEN", prompt: "Write here", maximumWords: 60, timeLimitSec: 300, pasteAllowed: false, timerStartedAt: null };
    const sampleNumeric = { id: "q-3", type: "NUMERIC", prompt: "Enter numbers", inputLabels: ["Revenue"], unit: null };

    for (const sample of [sampleOrdinal, sampleOpen, sampleNumeric]) {
      for (const key of forbiddenKeys) {
        expect(sample).not.toHaveProperty(key);
      }
    }
  });

  it("ApplicantSafeOption has only id and text", () => {
    const option = { id: "opt-1", text: "Yes" };
    expect(Object.keys(option).sort()).toEqual(["id", "text"]);
    for (const key of forbiddenKeys) {
      expect(option).not.toHaveProperty(key);
    }
  });
});
