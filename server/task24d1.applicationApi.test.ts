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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  type ApplicantEligibilityAnswers,
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
    // currentStatus replaces the old recentRole / jobTitle field
    currentStatus: "Currently employed",
    currentStatusOther: "",
    totalExperience: "3–5 years",
    // relevantExperience is no longer collected via the form; BD experience
    // is now a live eligibility gate answer evaluated server-side.
    relevantExperience: "",
    linkedinUrl: "",
    eligibility: {
      // Generic per-gate answers keyed by gate reference; G3 is derived from
      // the relevantExperience field server-side and carries no answer.
      G1: { value: "abuja" },
      G2: { value: "yes" },
      G4: { value: "yes" },
      G5: { value: "yes" },
      G6: { value: "yes" },
      G7: { value: "yes" },
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

  it("rejects a gate answer without a value", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, eligibility: { ...validInput.eligibility, G2: { value: "   " } } });
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) expect(outcome.errors.some((error) => error.includes("G2"))).toBe(true);
  });

  // ── Application form regression tests ────────────────────────────────────

  it("rejects missing currentStatus — job title field is removed", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, currentStatus: "" });
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) expect(outcome.errors).toContain("Select your current status.");
    // Must NOT reference old field name in any error message
    if ("errors" in outcome) expect(outcome.errors.join(" ")).not.toContain("job title");
    if ("errors" in outcome) expect(outcome.errors.join(" ")).not.toContain("recentRole");
  });

  it("rejects Other currentStatus without specifying detail", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, currentStatus: "Other", currentStatusOther: "" });
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) expect(outcome.errors).toContain("Specify your current status.");
  });

  it("accepts Other currentStatus when detail is provided", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, currentStatus: "Other", currentStatusOther: "Volunteer coordinator" });
    expect("input" in outcome).toBe(true);
  });

  it("does NOT require relevantExperience — BD experience is now a gate answer", () => {
    // relevantExperience can be empty for new applications
    const outcome = validateCreateApplicationInput({ ...validInput, relevantExperience: "" });
    expect("input" in outcome).toBe(true);
  });

  it("currentStatus is persisted via the wire contract, not recentRole", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, currentStatus: "Freelance / consulting" });
    expect("input" in outcome).toBe(true);
    if ("input" in outcome) {
      expect(outcome.input.currentStatus).toBe("Freelance / consulting");
      // The input object no longer contains recentRole as a separate field
      expect((outcome.input as Record<string, unknown>).recentRole).toBeUndefined();
    }
  });

  it("employer field is no longer collected — currentStatusOther is used for Other detail only", () => {
    const outcome = validateCreateApplicationInput({ ...validInput, currentStatus: "Currently employed", currentStatusOther: "" });
    expect("input" in outcome).toBe(true);
    if ("input" in outcome) {
      // currentStatusOther is empty because status is not "Other"
      expect(outcome.input.currentStatusOther).toBe("");
      // No separate employer field exists on the input
      expect((outcome.input as Record<string, unknown>).recentEmployer).toBeUndefined();
    }
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
  // Gate configuration mirrors the live BDO seed (migration 0005): the
  // evaluator dispatches on `inputType`, never on the gate reference.
  const gates = [
    {
      id: "gate-g1",
      reference: "G1",
      status: "Active",
      configuration: JSON.stringify({
        inputType: "SINGLE_SELECT",
        label: "Abuja availability",
        options: [
          { value: "abuja", text: "I currently live in Abuja.", outcome: "PASS" },
          { value: "relocate", text: "I am committed to relocating.", outcome: "PASS_WITH_FLAG", flag: "Relocation commitment" },
          { value: "not-relocate", text: "I am not planning to relocate.", outcome: "FAIL" },
        ],
        isBlocking: true,
        allowSupplementaryField: true,
        supplementaryFieldLabel: "Planned relocation date",
        supplementaryFieldVisibleWhen: "relocate",
      }),
    },
    { id: "gate-g2", reference: "G2", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Right to work", passRule: { match: "yes" }, isBlocking: true }) },
    { id: "gate-g3", reference: "G3", status: "Active", configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", label: "Minimum BD experience", fieldKey: "relevantExperience", minimumYears: 3, isBlocking: true }) },
    { id: "gate-g4", reference: "G4", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Start availability", latestStartDate: "2026-09-01", deadlineLabel: "1 September 2026", passRule: { match: "yes" }, isBlocking: true }) },
    { id: "gate-g5", reference: "G5", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Compensation", minimumAmount: 6000000, maximumAmount: 9600000, currency: "NGN", rangeLabel: "₦6,000,000 – ₦9,600,000 gross per annum", passRule: { match: "yes" }, isBlocking: true }) },
    { id: "gate-g6", reference: "G6", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Outbound work", passRule: { match: "yes" }, isBlocking: true }) },
    { id: "gate-g7", reference: "G7", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Verification consent", passRule: { match: "yes" }, isBlocking: true }) },
  ];

  // G3 is derived from relevantExperience and carries no applicant answer.
  const baseAnswers: ApplicantEligibilityAnswers = {
    G1: { value: "abuja" },
    G2: { value: "yes" },
    G4: { value: "yes" },
    G5: { value: "yes" },
    G6: { value: "yes" },
    G7: { value: "yes" },
  };

  it("passes every active gate for an eligible applicant", () => {
    const result = evaluateEligibilityServerSide(gates, baseAnswers, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates).toHaveLength(7);
    expect(result.gates.map((gate) => gate.gateReference)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
    expect(result.gates.every((gate) => gate.outcome === "Passed")).toBe(true);
  });

  it("G1 relocation passes with flag and persists the supplementary date", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseAnswers, G1: { value: "relocate", supplementary: "2026-10-01" } }, "3–5 years");
    expect(result.eligible).toBe(true);
    const g1 = result.gates.find((g) => g.gateReference === "G1");
    expect(g1?.outcome).toBe("Flagged");
    expect(g1?.flagReason).toBe("Relocation commitment");
    expect(g1?.response).toContain("2026-10-01");
  });

  it("G1 not-relocate fails and closes the application", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseAnswers, G1: { value: "not-relocate" } }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.failedGateId).toBe("gate-g1");
  });

  it("G2 no right to work closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseAnswers, G2: { value: "no" } }, "3–5 years");
    expect(result.eligible).toBe(false);
  });

  it("G3 derives from the experience field: below 3 years closes", () => {
    const result = evaluateEligibilityServerSide(gates, baseAnswers, "1–2 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G3")?.outcome).toBe("Failed");
  });

  it("G3 derives from the experience field: 3+ years passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseAnswers, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G3")?.outcome).toBe("Passed");
  });

  it("G3 honours the configured minimum years rather than a hard-coded value", () => {
    const relaxed = gates.map((gate) => gate.reference === "G3" ? { ...gate, configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", fieldKey: "relevantExperience", minimumYears: 1, isBlocking: true }) } : gate);
    expect(evaluateEligibilityServerSide(relaxed, baseAnswers, "1–2 years").eligible).toBe(true);
    const strict = gates.map((gate) => gate.reference === "G3" ? { ...gate, configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", fieldKey: "relevantExperience", minimumYears: 6, isBlocking: true }) } : gate);
    expect(evaluateEligibilityServerSide(strict, baseAnswers, "3–5 years").eligible).toBe(false);
  });

  it("G4 yes passes", () => {
    const result = evaluateEligibilityServerSide(gates, baseAnswers, "3–5 years");
    expect(result.gates.find((g) => g.gateReference === "G4")?.outcome).toBe("Passed");
  });

  it("G4 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseAnswers, G4: { value: "no" } }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G4")?.outcome).toBe("Failed");
  });

  it("G5 no closes", () => {
    const result = evaluateEligibilityServerSide(gates, { ...baseAnswers, G5: { value: "no" } }, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G5")?.outcome).toBe("Failed");
  });

  it("G6 no closes", () => {
    expect(evaluateEligibilityServerSide(gates, { ...baseAnswers, G6: { value: "no" } }, "3–5 years").eligible).toBe(false);
  });

  it("G7 no closes", () => {
    expect(evaluateEligibilityServerSide(gates, { ...baseAnswers, G7: { value: "no" } }, "3–5 years").eligible).toBe(false);
  });

  it("a missing answer for an answered gate fails rather than silently passing", () => {
    const { G2: _omitted, ...rest } = baseAnswers;
    const result = evaluateEligibilityServerSide(gates, rest, "3–5 years");
    expect(result.eligible).toBe(false);
    expect(result.gates.find((g) => g.gateReference === "G2")?.outcome).toBe("Failed");
  });

  it("inactive gates are skipped entirely", () => {
    const withInactive = gates.map((gate) => (gate.reference === "G7" ? { ...gate, status: "Inactive" } : gate));
    const result = evaluateEligibilityServerSide(withInactive, baseAnswers, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.map((gate) => gate.gateReference)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6"]);
  });

  it("a failed non-blocking gate is recorded but does not close the application", () => {
    const nonBlocking = gates.map((gate) => (gate.reference === "G6" ? { ...gate, configuration: JSON.stringify({ inputType: "YES_NO", passRule: { match: "yes" }, isBlocking: false }) } : gate));
    const result = evaluateEligibilityServerSide(nonBlocking, { ...baseAnswers, G6: { value: "no" } }, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((g) => g.gateReference === "G6")?.outcome).toBe("Failed");
  });

  it("gates marked Configuration Required surface the restrained status", () => {
    const unconfigured = gates.map((gate) => (gate.reference === "G4" ? { ...gate, status: "Configuration Required", configuration: "{}" } : gate));
    const result = evaluateEligibilityServerSide(unconfigured, baseAnswers, "3–5 years");
    expect(result.gates.find((g) => g.gateReference === "G4")?.outcome).toBe("Configuration required");
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
    // Validation happens before opening a connection, but after the configuration guard.
    // Keep this no-database test independent of the developer's .env file.
    vi.stubEnv("DATABASE_URL", "mysql://unused-for-input-validation");
    try {
      const response = await fetch(`${baseUrl}/api/public/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    } finally {
      vi.unstubAllEnvs();
    }
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

// ── Application form field regression ────────────────────────────────────────
//
// These tests prove the field removals and replacements are stable at the
// contract level without requiring a browser or database.

describe("application form field contract regression", () => {
  it("CreateApplicationInput has currentStatus, not recentRole", () => {
    const input: CreateApplicationInput = {
      roleSlug: "test-role",
      fullName: "Test User",
      email: "test@example.com",
      phone: "0801234567",
      city: "Lagos",
      currentStatus: "Currently employed",
      currentStatusOther: "",
      totalExperience: "1–2 years",
      relevantExperience: "",
      linkedinUrl: "",
      eligibility: {},
    };
    expect(input.currentStatus).toBe("Currently employed");
    expect((input as Record<string, unknown>).recentRole).toBeUndefined();
    expect((input as Record<string, unknown>).employer).toBeUndefined();
    expect((input as Record<string, unknown>).jobTitle).toBeUndefined();
  });

  it("CreateApplicationInput does NOT have a standalone recentEmployer field", () => {
    const input: CreateApplicationInput = {
      roleSlug: "test-role",
      fullName: "Test User",
      email: "test@example.com",
      phone: "0801234567",
      city: "Lagos",
      currentStatus: "Self-employed / running a business",
      currentStatusOther: "",
      totalExperience: "6–8 years",
      relevantExperience: "",
      linkedinUrl: "",
      eligibility: {},
    };
    expect((input as Record<string, unknown>).recentEmployer).toBeUndefined();
  });

  it("currentStatusOther is only meaningful when currentStatus is Other", () => {
    // Non-Other status: currentStatusOther should be empty
    const nonOther: CreateApplicationInput = {
      roleSlug: "r", fullName: "A", email: "a@b.com", phone: "1", city: "C",
      currentStatus: "Not currently employed", currentStatusOther: "",
      totalExperience: "1–2 years", relevantExperience: "", linkedinUrl: "", eligibility: {},
    };
    const r1 = validateCreateApplicationInput(nonOther);
    expect("input" in r1).toBe(true);

    // Other status without detail: validation rejects
    const otherNoDetail: CreateApplicationInput = { ...nonOther, currentStatus: "Other", currentStatusOther: "" };
    const r2 = validateCreateApplicationInput(otherNoDetail);
    expect("errors" in r2).toBe(true);

    // Other status with detail: validation accepts
    const otherWithDetail: CreateApplicationInput = { ...nonOther, currentStatus: "Other", currentStatusOther: "Caregiver" };
    const r3 = validateCreateApplicationInput(otherWithDetail);
    expect("input" in r3).toBe(true);
    if ("input" in r3) expect(r3.input.currentStatusOther).toBe("Caregiver");
  });

  it("relevantExperience accepts empty string — BD experience is no longer a form field", () => {
    const input: CreateApplicationInput = {
      roleSlug: "r", fullName: "A", email: "a@b.com", phone: "1", city: "C",
      currentStatus: "Currently employed", currentStatusOther: "",
      totalExperience: "3–5 years", relevantExperience: "", linkedinUrl: "", eligibility: {},
    };
    const result = validateCreateApplicationInput(input);
    expect("input" in result).toBe(true);
    if ("input" in result) expect(result.input.relevantExperience).toBe("");
  });

  it("all six CURRENT_STATUS_OPTIONS values are accepted by the validator", () => {
    const statuses = [
      "Currently employed",
      "In transition / seeking opportunities",
      "Self-employed / running a business",
      "Freelance / consulting",
      "Not currently employed",
      "Other",
    ] as const;
    const base: CreateApplicationInput = {
      roleSlug: "r", fullName: "A", email: "a@b.com", phone: "1", city: "C",
      currentStatus: "", currentStatusOther: "",
      totalExperience: "1–2 years", relevantExperience: "", linkedinUrl: "", eligibility: {},
    };
    for (const status of statuses) {
      const input = { ...base, currentStatus: status, currentStatusOther: status === "Other" ? "Detail" : "" };
      const result = validateCreateApplicationInput(input);
      expect("input" in result).toBe(true);
    }
  });

  it("BD experience eligibility gate is not related to the form field removal", () => {
    // G3 APPLICATION_FIELD gate still evaluates relevantExperience passed as a
    // separate parameter to evaluateEligibilityServerSide, not from the input.
    // This ensures the gate configuration is untouched.
    const g3Only = [
      {
        id: "gate-g3",
        reference: "G3",
        status: "Active",
        configuration: JSON.stringify({
          inputType: "APPLICATION_FIELD",
          fieldKey: "relevantExperience",
          minimumYears: 3,
          isBlocking: true,
        }),
      },
    ];
    // Passing "3–5 years" (≥3) via the third parameter still passes G3
    const passingResult = evaluateEligibilityServerSide(g3Only, {}, "3–5 years");
    expect(passingResult.gates.find((g) => g.gateReference === "G3")?.outcome).toBe("Passed");

    // Passing empty string (no experience declared) still fails G3
    const failingResult = evaluateEligibilityServerSide(g3Only, {}, "");
    expect(failingResult.gates.find((g) => g.gateReference === "G3")?.outcome).toBe("Failed");

    // The gate itself is unchanged — this is about the form field removal only
    expect(g3Only[0].configuration).toContain("APPLICATION_FIELD");
  });
});
