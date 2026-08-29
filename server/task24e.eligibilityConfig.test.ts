/**
 * Task 24E — role-independent eligibility configuration tests.
 *
 * Proves the eligibility architecture assumes nothing about a shared G1–G7
 * structure: the Business Development Officer role uses its seven configured
 * gates, a synthetic second role uses only its own four gates, applicant
 * answers are keyed per role, and changing one role's configuration never
 * affects another role.
 *
 * Pure evaluator/contract tests run without a database; the live-database
 * suite (skipped without DATABASE_URL) proves the same independence through
 * the repository CRUD layer against TiDB.
 */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { evaluateEligibilityServerSide } from "./applicationRepository";
import {
  createEligibilityGate,
  createRecruitmentRole,
  deleteEligibilityGate,
  getRoleEligibilityGates,
  updateEligibilityGate,
} from "./recruitmentRepository";
import {
  describeEligibilityGateSummary,
  deriveEligibilityGateSummary,
  validateEligibilityGateInput,
  type EligibilityGateInput,
} from "../shared/recruitmentApi";
import type { ApplicantEligibilityAnswers } from "../shared/applicationApi";

// ── Gate configuration fixtures ──────────────────────────────────────────────
//
// BDO mirrors the live seed (migration 0005); the synthetic role declares a
// deliberately different structure: four gates, different references, a
// different pass rule and a non-blocking gate.

const bdoGates = [
  {
    id: "gate-bdo-g1",
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
    }),
  },
  { id: "gate-bdo-g2", reference: "G2", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Right to work", passRule: { match: "yes" }, isBlocking: true }) },
  { id: "gate-bdo-g3", reference: "G3", status: "Active", configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", label: "Minimum BD experience", fieldKey: "relevantExperience", minimumYears: 3, isBlocking: true }) },
  { id: "gate-bdo-g4", reference: "G4", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Start availability", latestStartDate: "2026-09-01", deadlineLabel: "1 September 2026", passRule: { match: "yes" }, isBlocking: true }) },
  { id: "gate-bdo-g5", reference: "G5", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Compensation", minimumAmount: 6000000, maximumAmount: 9600000, currency: "NGN", passRule: { match: "yes" }, isBlocking: true }) },
  { id: "gate-bdo-g6", reference: "G6", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Outbound work", passRule: { match: "yes" }, isBlocking: true }) },
  { id: "gate-bdo-g7", reference: "G7", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Verification consent", passRule: { match: "yes" }, isBlocking: true }) },
];

const syntheticGates = [
  { id: "gate-syn-c1", reference: "C1", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Community moderation", passRule: { match: "yes" }, isBlocking: true }) },
  {
    id: "gate-syn-c2",
    reference: "C2",
    status: "Active",
    configuration: JSON.stringify({
      inputType: "SINGLE_SELECT",
      label: "Primary timezone",
      options: [
        { value: "watk", text: "West Africa Time (WAT)", outcome: "PASS" },
        { value: "other", text: "Another timezone", outcome: "FAIL" },
      ],
      isBlocking: true,
    }),
  },
  { id: "gate-syn-c3", reference: "C3", status: "Active", configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", label: "Minimum community experience", fieldKey: "relevantExperience", minimumYears: 1, isBlocking: true }) },
  { id: "gate-syn-c4", reference: "C4", status: "Active", configuration: JSON.stringify({ inputType: "YES_NO", label: "Weekend availability", passRule: { match: "yes" }, isBlocking: false }) },
];

const bdoAnswers: ApplicantEligibilityAnswers = {
  G1: { value: "abuja" },
  G2: { value: "yes" },
  G4: { value: "yes" },
  G5: { value: "yes" },
  G6: { value: "yes" },
  G7: { value: "yes" },
};

const syntheticAnswers: ApplicantEligibilityAnswers = {
  C1: { value: "yes" },
  C2: { value: "watk" },
  C4: { value: "yes" },
};

// The applicant form renders one input per gate except derived
// APPLICATION_FIELD gates — the same filter used by RoleEligibilitySection.
const renderedGates = (gates: typeof bdoGates) => gates.filter((gate) => {
  if (gate.status !== "Active") return false;
  const config = JSON.parse(gate.configuration) as { inputType?: string };
  return config.inputType !== "APPLICATION_FIELD";
});

describe("role independence: evaluator (no database)", () => {
  it("BDO evaluates exactly its seven configured gates", () => {
    const result = evaluateEligibilityServerSide(bdoGates, bdoAnswers, "3–5 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.map((gate) => gate.gateReference)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
  });

  it("the synthetic role evaluates exactly its own four gates", () => {
    const result = evaluateEligibilityServerSide(syntheticGates, syntheticAnswers, "1–2 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.map((gate) => gate.gateReference)).toEqual(["C1", "C2", "C3", "C4"]);
  });

  it("applicant forms differ by role: 6 BDO inputs vs 3 synthetic inputs", () => {
    expect(renderedGates(bdoGates).map((gate) => gate.reference)).toEqual(["G1", "G2", "G4", "G5", "G6", "G7"]);
    expect(renderedGates(syntheticGates).map((gate) => gate.reference)).toEqual(["C1", "C2", "C4"]);
  });

  it("answers are keyed per role: foreign answers never leak into another role", () => {
    // One combined answer map — each role's evaluation reads only its own keys.
    const combined: ApplicantEligibilityAnswers = { ...bdoAnswers, ...syntheticAnswers, C1: { value: "no" } };
    const bdoResult = evaluateEligibilityServerSide(bdoGates, combined, "3–5 years");
    expect(bdoResult.eligible).toBe(true); // C1 failing is irrelevant to BDO.
    const syntheticResult = evaluateEligibilityServerSide(syntheticGates, combined, "1–2 years");
    expect(syntheticResult.eligible).toBe(false);
    expect(syntheticResult.failedGateId).toBe("gate-syn-c1");
  });

  it("changing one role's configuration does not affect another role", () => {
    const before = evaluateEligibilityServerSide(bdoGates, bdoAnswers, "3–5 years");

    // Flip the synthetic role's C1 pass rule — synthetic outcome changes…
    const mutatedSynthetic = syntheticGates.map((gate) =>
      gate.reference === "C1" ? { ...gate, configuration: JSON.stringify({ inputType: "YES_NO", passRule: { match: "no" }, isBlocking: true }) } : gate,
    );
    expect(evaluateEligibilityServerSide(mutatedSynthetic, syntheticAnswers, "1–2 years").eligible).toBe(false);

    // …while the BDO evaluation is byte-identical.
    expect(evaluateEligibilityServerSide(bdoGates, bdoAnswers, "3–5 years")).toEqual(before);

    // And tightening BDO's G3 minimum years never touches the synthetic role.
    const tightenedBdo = bdoGates.map((gate) =>
      gate.reference === "G3" ? { ...gate, configuration: JSON.stringify({ inputType: "APPLICATION_FIELD", fieldKey: "relevantExperience", minimumYears: 6, isBlocking: true }) } : gate,
    );
    expect(evaluateEligibilityServerSide(tightenedBdo, bdoAnswers, "3–5 years").eligible).toBe(false);
    expect(evaluateEligibilityServerSide(syntheticGates, syntheticAnswers, "1–2 years").eligible).toBe(true);
  });

  it("the synthetic role's non-blocking gate records failure without closing", () => {
    const result = evaluateEligibilityServerSide(syntheticGates, { ...syntheticAnswers, C4: { value: "no" } }, "1–2 years");
    expect(result.eligible).toBe(true);
    expect(result.gates.find((gate) => gate.gateReference === "C4")?.outcome).toBe("Failed");
  });
});

describe("role independence: gate input validation accepts arbitrary structures", () => {
  const baseGate = (reference: string, configuration: unknown): unknown => ({
    reference,
    name: `${reference} gate`,
    description: `${reference} question text`,
    status: "Active",
    displayOrder: 1,
    configuration,
  });

  it("accepts gate codes other than G1–G7", () => {
    for (const reference of ["C1", "X9", "REGION-4"]) {
      const outcome = validateEligibilityGateInput(baseGate(reference, { inputType: "YES_NO", isBlocking: true }));
      expect("input" in outcome).toBe(true);
    }
  });

  it("rejects single-select gates without options", () => {
    const outcome = validateEligibilityGateInput(baseGate("C2", { inputType: "SINGLE_SELECT", options: [], isBlocking: true }));
    expect("errors" in outcome).toBe(true);
  });

  it("rejects derived gates without a source field", () => {
    const outcome = validateEligibilityGateInput(baseGate("C3", { inputType: "APPLICATION_FIELD", isBlocking: true }));
    expect("errors" in outcome).toBe(true);
  });

  it("derives the live readiness label from gate state", () => {
    expect(describeEligibilityGateSummary({ totalCount: 7, activeCount: 7, configurationRequiredCount: 0 })).toBe("7 active gates · Fully configured");
    expect(describeEligibilityGateSummary({ totalCount: 4, activeCount: 4, configurationRequiredCount: 0 })).toBe("4 active gates · Fully configured");
    expect(describeEligibilityGateSummary({ totalCount: 0, activeCount: 0, configurationRequiredCount: 0 })).toBe("No gates configured");
    expect(describeEligibilityGateSummary({ totalCount: 3, activeCount: 2, configurationRequiredCount: 1 })).toBe("2 active gates · 1 configuration required");
    expect(deriveEligibilityGateSummary([{ status: "Active" }, { status: "Active" }, { status: "Inactive" }])).toEqual({ totalCount: 3, activeCount: 2, configurationRequiredCount: 0 });
  });
});

// ── Live database independence (skipped without DATABASE_URL) ────────────────

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("Task 24E role independence against TiDB", () => {
  const marker = randomBytes(6).toString("hex");
  let syntheticRoleId = "";
  const createdGateIds: string[] = [];

  afterAll(async () => {
    const { getDatabase } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();
    for (const gateId of createdGateIds) {
      await deleteEligibilityGate(gateId).catch(() => undefined);
    }
    if (syntheticRoleId) {
      await db.execute(sql.raw(`DELETE FROM eligibility_gates WHERE role_id = '${syntheticRoleId}'`)).catch(() => undefined);
      await db.execute(sql.raw(`DELETE FROM recruitment_roles WHERE id = '${syntheticRoleId}'`)).catch(() => undefined);
    }
  });

  const syntheticGateInputs: EligibilityGateInput[] = [
    { reference: "C1", name: "Community moderation", description: "Have you moderated an online community?", status: "Active", displayOrder: 1, configuration: { inputType: "YES_NO", label: "Community moderation", passRule: { match: "yes" }, isBlocking: true } },
    { reference: "C2", name: "Primary timezone", description: "Which timezone do you work from?", status: "Active", displayOrder: 2, configuration: { inputType: "SINGLE_SELECT", label: "Primary timezone", options: [{ value: "watk", text: "West Africa Time (WAT)", outcome: "PASS" }, { value: "other", text: "Another timezone", outcome: "FAIL" }], isBlocking: true } },
    { reference: "C3", name: "Minimum community experience", description: "At least 1 year of community experience.", status: "Active", displayOrder: 3, configuration: { inputType: "APPLICATION_FIELD", label: "Minimum community experience", fieldKey: "relevantExperience", minimumYears: 1, isBlocking: true } },
    { reference: "C4", name: "Weekend availability", description: "Are you available for weekend events?", status: "Active", displayOrder: 4, configuration: { inputType: "YES_NO", label: "Weekend availability", passRule: { match: "yes" }, isBlocking: false } },
  ];

  it("creates a synthetic role with exactly four gates while BDO keeps its seven", async () => {
    const bdoBefore = await getRoleEligibilityGates("role-business-development-officer");
    expect(bdoBefore).toHaveLength(7);
    expect(bdoBefore.map((gate) => gate.reference)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
    const bdoSnapshot = bdoBefore.map((gate) => gate.configuration);

    const role = await createRecruitmentRole({
      title: `Task 24E Synthetic Role ${marker}`,
      department: "People",
      location: "Remote",
      employmentType: "Contract",
      shortDescription: "Synthetic role proving gate independence.",
      fullDescription: "",
      status: "Draft",
      openingDate: null,
      closingDate: null,
    });
    syntheticRoleId = role.id;

    for (const input of syntheticGateInputs) {
      const created = await createEligibilityGate(role.id, input);
      createdGateIds.push(created.id);
    }

    const syntheticGatesFromDb = await getRoleEligibilityGates(role.id);
    expect(syntheticGatesFromDb).toHaveLength(4);
    expect(syntheticGatesFromDb.map((gate) => gate.reference)).toEqual(["C1", "C2", "C3", "C4"]);

    // BDO configuration is untouched by the synthetic role's creation.
    const bdoAfter = await getRoleEligibilityGates("role-business-development-officer");
    expect(bdoAfter.map((gate) => gate.configuration)).toEqual(bdoSnapshot);
  });

  it("server evaluation differs by role using only each role's persisted gates", async () => {
    const bdoRows = await getRoleEligibilityGates("role-business-development-officer");
    const syntheticRows = await getRoleEligibilityGates(syntheticRoleId);

    const bdoResult = evaluateEligibilityServerSide(bdoRows, bdoAnswers, "3–5 years");
    expect(bdoResult.gates.map((gate) => gate.gateReference)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
    expect(bdoResult.eligible).toBe(true);

    const syntheticResult = evaluateEligibilityServerSide(syntheticRows, syntheticAnswers, "1–2 years");
    expect(syntheticResult.gates.map((gate) => gate.gateReference)).toEqual(["C1", "C2", "C3", "C4"]);
    expect(syntheticResult.eligible).toBe(true);
  });

  it("updating the synthetic role's gates never touches BDO configuration", async () => {
    const bdoSnapshot = (await getRoleEligibilityGates("role-business-development-officer")).map((gate) => gate.configuration);

    const target = createdGateIds[0];
    const updated = await updateEligibilityGate(target, {
      ...syntheticGateInputs[0],
      name: "Community moderation (revised)",
      configuration: { inputType: "YES_NO", label: "Community moderation", passRule: { match: "no" }, isBlocking: true },
    });
    expect(updated?.name).toBe("Community moderation (revised)");

    const syntheticRows = await getRoleEligibilityGates(syntheticRoleId);
    expect(syntheticRows.find((gate) => gate.id === target)?.configuration).toContain('"match":"no"');

    // The flipped pass rule now closes synthetic applicants answering yes…
    expect(evaluateEligibilityServerSide(syntheticRows, syntheticAnswers, "1–2 years").eligible).toBe(false);

    // …while BDO remains fully configured and unaffected.
    const bdoAfter = await getRoleEligibilityGates("role-business-development-officer");
    expect(bdoAfter.map((gate) => gate.configuration)).toEqual(bdoSnapshot);
    expect(evaluateEligibilityServerSide(bdoAfter, bdoAnswers, "3–5 years").eligible).toBe(true);
  });

  it("deleting the synthetic role's gates leaves BDO with its seven gates", async () => {
    for (const gateId of createdGateIds) {
      expect(await deleteEligibilityGate(gateId)).toBe(true);
    }
    createdGateIds.length = 0;
    expect(await getRoleEligibilityGates(syntheticRoleId)).toHaveLength(0);
    expect(await getRoleEligibilityGates("role-business-development-officer")).toHaveLength(7);
  });
});
