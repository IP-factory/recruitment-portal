/**
 * Task 24C-2 — Admin Question Bank API tests.
 *
 * Pure coverage for the shared type-aware validation contract, plus
 * live-database coverage (skipped without DATABASE_URL) that drives the real
 * Express router against TiDB: authorization, the seeded list (14 questions),
 * type-specific detail projections, cross-check relationships, and the
 * transactional create/update lifecycle including reference locking and
 * assessment-usage protection.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionForUser } from "./adminAuth";
import { createQuestionBankApiRouter } from "./questionBankApi";
import { COOKIE_NAME } from "../shared/const";
import { formatUsedInLabel, validateQuestionInput } from "../shared/questionBankApi";

// ── Pure contract validation (no database required) ──────────────────────────

const validOrdinal = {
  reference: "T.ORD",
  dimensionReference: "D5",
  required: true,
  prompt: "Ordered band question",
  helpText: "",
  status: "Active",
  timeLimitSec: null,
  type: "ORDINAL",
  qWeight: 2,
  options: [
    { text: "Band A", rawScore: 0 },
    { text: "Band B", rawScore: 2 },
    { text: "Band C", rawScore: 4 },
    { text: "Band D", rawScore: 5 },
  ],
};

describe("question input validation", () => {
  it("accepts a valid ordinal input and trims text", () => {
    const outcome = validateQuestionInput({ ...validOrdinal, prompt: "  Trimmed  " });
    expect("input" in outcome).toBe(true);
    if ("input" in outcome) {
      expect(outcome.input.type).toBe("ORDINAL");
      expect(outcome.input.prompt).toBe("Trimmed");
    }
  });

  it("rejects missing payload, prompt, and invalid type", () => {
    expect(validateQuestionInput(null)).toEqual({ errors: ["Question data is missing."] });
    const noPrompt = validateQuestionInput({ ...validOrdinal, prompt: " " });
    expect("errors" in noPrompt && noPrompt.errors).toContain("Enter the question prompt.");
    const badType = validateQuestionInput({ ...validOrdinal, type: "Experience" });
    expect("errors" in badType && badType.errors).toContain("Select a valid question type.");
  });

  it("rejects a question weight on gate and evidence questions", () => {
    const gate = validateQuestionInput({
      reference: "T.GATE", dimensionReference: null, required: true, prompt: "Gate", helpText: "", status: "Active", timeLimitSec: null,
      type: "GATE", qWeight: 2, options: [{ text: "Yes", outcomeType: "pass" }, { text: "No", outcomeType: "fail" }],
    });
    expect("errors" in gate && gate.errors).toContain("Gate and evidence questions do not carry a question weight.");
  });

  it("requires a 1–3 weight for scored types", () => {
    const outcome = validateQuestionInput({ ...validOrdinal, qWeight: 4 });
    expect("errors" in outcome && outcome.errors).toContain("Question weight must be 1, 2 or 3.");
  });

  it("enforces ordinal option bounds and close-outcome rules", () => {
    const tooFew = validateQuestionInput({ ...validOrdinal, options: validOrdinal.options.slice(0, 3) });
    expect("errors" in tooFew && tooFew.errors).toContain("Ordinal questions need between 4 and 5 options.");
    const closeWithScore = validateQuestionInput({
      ...validOrdinal,
      options: [...validOrdinal.options.slice(0, 3), { text: "Close", rawScore: 3, outcomeType: "close" }],
    });
    expect("errors" in closeWithScore && closeWithScore.errors).toContain("Option 4 closes the application and cannot carry a raw score.");
  });

  it("forces multi decoys to score −1", () => {
    const multi = {
      reference: "T.MULTI", dimensionReference: "D3", required: true, prompt: "Breadth", helpText: "", status: "Active", timeLimitSec: null,
      type: "MULTI", qWeight: 2, scoreCap: 5,
      options: [{ text: "A", rawScore: 2, isDecoy: false }, { text: "B", rawScore: 0, isDecoy: true }],
    };
    const outcome = validateQuestionInput(multi);
    expect("errors" in outcome && outcome.errors).toContain("Option 2 is a decoy and must score −1.");
  });

  it("requires exactly four SJT options each with an internal explanation", () => {
    const sjt = {
      reference: "T.SJT", dimensionReference: "D5", required: true, prompt: "Scenario", helpText: "", status: "Active", timeLimitSec: null,
      type: "SJT", qWeight: 2,
      options: [
        { text: "A", rawScore: 5, internalExplanation: "Best" },
        { text: "B", rawScore: 2, internalExplanation: "Partial" },
        { text: "C", rawScore: -2 },
      ],
    };
    const outcome = validateQuestionInput(sjt);
    expect("errors" in outcome && outcome.errors).toEqual(expect.arrayContaining(["Scenario questions need exactly 4 options.", "Option 3 needs an internal explanation."]));
  });

  it("rejects overlapping numeric bands and fills the derived calculation type", () => {
    const numeric = {
      reference: "T.NUM", dimensionReference: "D2", required: true, prompt: "Numeric", helpText: "", status: "Active", timeLimitSec: null,
      type: "NUMERIC", qWeight: 2,
      numericConfig: { mode: "calendarYearExperience", inputDefinitions: [{ label: "Year", unit: "year" }], bands: [{ lowerBound: 0, upperBound: 5, rawScore: 3 }, { lowerBound: 3, upperBound: null, rawScore: 5 }] },
    };
    const overlapping = validateQuestionInput(numeric);
    expect("errors" in overlapping && overlapping.errors).toContain("Numeric scoring bands must not overlap.");
    const clean = validateQuestionInput({ ...numeric, numericConfig: { ...numeric.numericConfig, bands: [{ lowerBound: 5, upperBound: null, rawScore: 5 }, { lowerBound: 0, upperBound: 4, rawScore: 3 }] } });
    expect("input" in clean).toBe(true);
    if ("input" in clean && clean.input.type === "NUMERIC") expect(clean.input.numericConfig.derivedCalculationType).toBe("calendar_year_to_derived_years");
  });

  it("supports open rubric anchors as exact scores and ranges", () => {
    const open = {
      reference: "T.OPEN", dimensionReference: "D6", required: true, prompt: "Written", helpText: "", status: "Active", timeLimitSec: null,
      type: "OPEN", qWeight: 2,
      openConfig: { minimumWords: 10, maximumWords: 60, timeLimitSec: 90, pasteAllowed: false, rubric: [{ scoreMin: 0, scoreMax: 1, anchorText: "Low" }, { scoreMin: 5, scoreMax: 5, anchorText: "High" }] },
    };
    const outcome = validateQuestionInput(open);
    expect("input" in outcome).toBe(true);
    const inverted = validateQuestionInput({ ...open, openConfig: { ...open.openConfig, rubric: [{ scoreMin: 4, scoreMax: 2, anchorText: "Bad" }] } });
    expect("errors" in inverted && inverted.errors).toContain("Rubric anchor 1 cannot end below its minimum score.");
  });

  it("prevents an evidence question verifying itself and restricts multipliers", () => {
    const evidence = (ref: string, claimed: string, multiplier: number) => ({
      reference: ref, dimensionReference: "D2", required: true, prompt: "Evidence", helpText: "", status: "Active", timeLimitSec: null,
      type: "EVIDENCE", claimedQuestionReference: claimed, options: [{ text: "Verified", verificationMultiplier: multiplier }],
    });
    const self = validateQuestionInput(evidence("T.EV", "T.EV", 1));
    expect("errors" in self && self.errors).toContain("An evidence question cannot verify itself.");
    const badMultiplier = validateQuestionInput(evidence("T.EV", "D2.Q1", 0.5));
    expect("errors" in badMultiplier && badMultiplier.errors).toContain("Option 1 must use a verification multiplier of 1.00, 0.95 or 0.85.");
  });
});

describe("used-in label helper", () => {
  it("appends the status unless the assessment is Active", () => {
    expect(formatUsedInLabel("Assessment v2", "Draft")).toBe("Assessment v2 — Draft");
    expect(formatUsedInLabel("Assessment v2", "Active")).toBe("Assessment v2");
  });
});

// ── Live API integration (skipped without DATABASE_URL) ───────────────────────

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("Task 24C-2 Question Bank API against TiDB", () => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createQuestionBankApiRouter());

  let server: Server;
  let baseUrl = "";
  let adminCookie = "";
  let viewerCookie = "";
  const cleanup: Array<{ table: string; column: string; value: string }> = [];
  const marker = randomBytes(6).toString("hex");

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const { getDatabase } = await import("./db");
    const { users, adminProfiles } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();

    const adminOpenId = `task24c2-admin-${marker}`;
    await db.insert(users).values({ openId: adminOpenId, email: `task24c2-admin-${marker}@example.com`, loginMethod: "test", role: "user" });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({ id: `task24c2-profile-${marker}`, authUserId: adminUser.id, email: `task24c2-admin-${marker}@example.com`, role: "Admin", status: "Active" });
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    const viewerOpenId = `task24c2-viewer-${marker}`;
    await db.insert(users).values({ openId: viewerOpenId, email: `task24c2-viewer-${marker}@example.com`, loginMethod: "test", role: "user" });
    const viewerUser = (await db.select().from(users).where(sql`${users.openId} = ${viewerOpenId}`).limit(1))[0];
    viewerCookie = `${COOKIE_NAME}=${(await createSessionForUser(viewerUser.id)).token}`;

    cleanup.push({ table: "admin_profiles", column: "auth_user_id", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(viewerUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(adminUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(viewerUser.id) });
  });

  afterAll(async () => {
    const { getDatabase } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();
    for (const item of cleanup.reverse()) {
      await db.execute(sql.raw(`DELETE FROM ${item.table} WHERE ${item.column} = '${item.value}'`)).catch(() => undefined);
    }
    server?.close();
  });

  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  // ── Authorization ──────────────────────────────────────────────────────────

  it("requires an authorized Admin session for every Question Bank endpoint", async () => {
    for (const path of ["/api/admin/questions", "/api/admin/questions/D1.Q1"]) {
      const anonymous = await api(path);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body).toEqual({ ok: false, error: "Admin authorization is required." });
      const viewer = await api(path, { headers: { Cookie: viewerCookie } });
      expect(viewer.status).toBe(401);
    }
    const createAnonymous = await api("/api/admin/questions", { method: "POST", body: JSON.stringify({}) });
    expect(createAnonymous.status).toBe(401);
    const patchViewer = await api("/api/admin/questions/D1.Q1", { method: "PATCH", headers: { Cookie: viewerCookie }, body: JSON.stringify({}) });
    expect(patchViewer.status).toBe(401);
  });

  // ── List ───────────────────────────────────────────────────────────────────

  it("lists the 14 seeded questions with DB-resolved dimensions and a concise payload", async () => {
    const { status, body } = await api("/api/admin/questions", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.total).toBe(14);
    expect(body.summary).toEqual({ total: 14, active: 14, dimensionCount: 8 });
    expect(body.dimensions.map((dimension: any) => dimension.reference)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
    // Default pagination: page 1 of 10 → 2 pages for 14 items.
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
    expect(body.totalPages).toBe(2);
    expect(body.items).toHaveLength(10);
    // Concise rows carry no nested configuration.
    for (const item of body.items) {
      expect(item.options).toBeUndefined();
      expect(item.numericConfig).toBeUndefined();
      expect(item.openConfig).toBeUndefined();
    }
  });

  it("paginates to the second page", async () => {
    const { body } = await api("/api/admin/questions?page=2", { headers: { Cookie: adminCookie } });
    expect(body.page).toBe(2);
    expect(body.items).toHaveLength(4);
  });

  it("filters by type, dimension, status, and search", async () => {
    const byType = await api("/api/admin/questions?type=MULTI&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(byType.body.total).toBe(3);
    expect(byType.body.items.every((item: any) => item.type === "MULTI")).toBe(true);

    const byDimension = await api("/api/admin/questions?dimension=D1&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(byDimension.body.items.map((item: any) => item.reference).sort()).toEqual(["D1.Q1", "D1.Q2"]);

    const gateDimension = await api("/api/admin/questions?dimension=GATE&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(gateDimension.body.total).toBe(0);

    const byStatus = await api("/api/admin/questions?status=Active&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(byStatus.body.total).toBe(14);

    const bySearch = await api("/api/admin/questions?search=D1.Q1", { headers: { Cookie: adminCookie } });
    expect(bySearch.body.items.map((item: any) => item.reference)).toEqual(["D1.Q1"]);
  });

  it("sorts by reference and exposes the assessment usage label", async () => {
    const ascending = await api("/api/admin/questions?sortKey=reference&sortDirection=asc&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(ascending.body.items[0].reference).toBe("D1.Q1");
    const descending = await api("/api/admin/questions?sortKey=reference&sortDirection=desc&pageSize=50", { headers: { Cookie: adminCookie } });
    expect(descending.body.items[0].reference).toBe("D8.Q1");
    const d1q1 = ascending.body.items.find((item: any) => item.reference === "D1.Q1");
    // Production state: Active assessments render as just the name; Draft appends ' — Draft'.
    expect(d1q1.usedIn.length).toBe(1);
    expect(d1q1.usedIn[0]).toMatch(/^Business Development Officer Assessment v2( — Draft)?$/);
  });

  // ── Detail: type-specific projections ──────────────────────────────────────

  it("returns the ordinal detail with a close-application option mapped to G3", async () => {
    const { status, body } = await api("/api/admin/questions/D1.Q1", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.question).toMatchObject({ reference: "D1.Q1", type: "ORDINAL", qWeight: 3, maxScore: 5, dimension: { reference: "D1" } });
    expect(body.question.options).toHaveLength(4);
    const closing = body.question.options.find((option: any) => option.outcomeType === "close");
    expect(closing.rawScore).toBeNull();
    expect(closing.relatedGate).toMatchObject({ reference: "G3" });
  });

  it("returns the multi detail with −1 decoys and a score cap of 5", async () => {
    const { body } = await api("/api/admin/questions/D3.Q1", { headers: { Cookie: adminCookie } });
    expect(body.question.type).toBe("MULTI");
    expect(body.question.scoreCap).toBe(5);
    const decoys = body.question.options.filter((option: any) => option.isDecoy);
    expect(decoys).toHaveLength(2);
    expect(decoys.every((option: any) => option.rawScore === -1)).toBe(true);
  });

  it("returns the numeric detail with mode, inputs and ordered bands", async () => {
    const { body } = await api("/api/admin/questions/D2.Q2", { headers: { Cookie: adminCookie } });
    expect(body.question.numericConfig.mode).toBe("twoValueDerived");
    expect(body.question.numericConfig.derivedCalculationType).toBe("two_inputs_to_percentage_attainment");
    expect(body.question.numericConfig.inputDefinitions).toHaveLength(2);
    expect(body.question.numericConfig.bands.map((band: any) => [band.lowerBound, band.upperBound, band.rawScore])).toEqual([
      [110, null, 5],
      [100, 109, 4],
      [90, 99, 3],
      [70, 89, 1],
      [0, 69, 0],
    ]);
  });

  it("returns the SJT detail with exactly four options and internal explanations", async () => {
    const { body } = await api("/api/admin/questions/D5.Q1", { headers: { Cookie: adminCookie } });
    expect(body.question.type).toBe("SJT");
    expect(body.question.options).toHaveLength(4);
    expect(body.question.options.map((option: any) => option.rawScore)).toEqual([5, 2, 1, -2]);
    expect(body.question.options.every((option: any) => typeof option.internalExplanation === "string" && option.internalExplanation.length > 0)).toBe(true);
  });

  it("returns the open detail with word limit, time limit, paste policy and rubric anchors", async () => {
    const { body } = await api("/api/admin/questions/D6.Q1", { headers: { Cookie: adminCookie } });
    expect(body.question.type).toBe("OPEN");
    expect(body.question.timeLimitSec).toBe(90);
    expect(body.question.openConfig.maximumWords).toBe(60);
    expect(body.question.openConfig.pasteAllowed).toBe(false);
    expect(body.question.openConfig.rubric.map((anchor: any) => [anchor.scoreMin, anchor.scoreMax])).toEqual([
      [5, 5],
      [4, 4],
      [3, 3],
      [2, 2],
      [1, 1],
    ]);
  });

  it("returns the evidence detail paired to D2.Q1 with verification multipliers", async () => {
    const { body } = await api("/api/admin/questions/D2.Q1E", { headers: { Cookie: adminCookie } });
    expect(body.question.type).toBe("EVIDENCE");
    expect(body.question.qWeight).toBeNull();
    expect(body.question.maxScore).toBeNull();
    expect(body.question.evidenceLink.claimedQuestionReference).toBe("D2.Q1");
    expect(body.question.options.map((option: any) => option.verificationMultiplier)).toEqual([1, 0.95, 0.85]);
  });

  it("returns a restrained 404 for an unknown question", async () => {
    const { status, body } = await api("/api/admin/questions/does-not-exist", { headers: { Cookie: adminCookie } });
    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, error: "Unable to load this question." });
  });

  // ── Cross-check relationships ──────────────────────────────────────────────

  it("exposes the seeded cross-check relationships from both sides", async () => {
    const source = await api("/api/admin/questions/D1.Q1", { headers: { Cookie: adminCookie } });
    expect(source.body.question.crossChecks).toEqual([{ id: expect.any(String), direction: "source", otherQuestionReference: "D1.Q2", ruleType: "Integrity flag", description: expect.any(String), defaultOutcome: expect.any(String), status: "Active" }]);

    const comparison = await api("/api/admin/questions/D1.Q2", { headers: { Cookie: adminCookie } });
    expect(comparison.body.question.crossChecks[0]).toMatchObject({ direction: "comparison", otherQuestionReference: "D1.Q1", ruleType: "Integrity flag" });

    const manual = await api("/api/admin/questions/D4.Q1", { headers: { Cookie: adminCookie } });
    expect(manual.body.question.crossChecks[0]).toMatchObject({ direction: "source", otherQuestionReference: "D4.Q2", ruleType: "Manual review" });
  });

  // ── Create / update lifecycle ──────────────────────────────────────────────

  it("creates, reads, updates and locks a question reference", async () => {
    const reference = `T24C2-${marker}`;
    const payload = {
      reference,
      dimensionReference: "D5",
      required: true,
      prompt: "Lifecycle ordinal question",
      helpText: "Supporting text",
      status: "Active",
      timeLimitSec: null,
      type: "ORDINAL",
      qWeight: 2,
      options: [
        { text: "Low", rawScore: 0 },
        { text: "Mid", rawScore: 2 },
        { text: "High", rawScore: 4 },
        { text: "Highest", rawScore: 5 },
      ],
    };

    const created = await api("/api/admin/questions", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify(payload) });
    expect(created.status).toBe(201);
    expect(created.body.ok).toBe(true);
    expect(created.body.question.reference).toBe(reference);
    expect(created.body.question.options).toHaveLength(4);
    expect(created.body.question.maxScore).toBe(5);
    const createdId = created.body.question.id;
    cleanup.push({ table: "assessment_questions", column: "id", value: createdId });

    // Readable by both id and reference.
    const byId = await api(`/api/admin/questions/${createdId}`, { headers: { Cookie: adminCookie } });
    expect(byId.status).toBe(200);
    const byReference = await api(`/api/admin/questions/${reference}`, { headers: { Cookie: adminCookie } });
    expect(byReference.status).toBe(200);

    // Update the prompt and qWeight; the reference stays locked.
    const updated = await api(`/api/admin/questions/${createdId}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ ...payload, prompt: "Lifecycle ordinal question — revised", qWeight: 3 }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.question.prompt).toBe("Lifecycle ordinal question — revised");
    expect(updated.body.question.qWeight).toBe(3);
    expect(updated.body.question.options).toHaveLength(4);

    // Attempting to change the reference is rejected.
    const relabel = await api(`/api/admin/questions/${createdId}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ ...payload, reference: `${reference}-X` }),
    });
    expect(relabel.status).toBe(400);
    expect(relabel.body.error).toBe("Question references cannot be changed after creation.");
  });

  it("rejects a duplicate question reference with a useful error", async () => {
    const duplicate = await api("/api/admin/questions", {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ ...validOrdinal, reference: "D1.Q1" }),
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.ok).toBe(false);
    expect(duplicate.body.error).toContain("already exists");
  });

  it("rejects invalid payloads with a restrained 400", async () => {
    const invalid = await api("/api/admin/questions", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify({ prompt: "" }) });
    expect(invalid.status).toBe(400);
    expect(typeof invalid.body.error).toBe("string");
  });

  it("blocks a type change while the question is used in an assessment", async () => {
    const asMulti = {
      reference: "D1.Q1",
      dimensionReference: "D1",
      required: true,
      prompt: "Attempt type change",
      helpText: "",
      status: "Active",
      timeLimitSec: null,
      type: "MULTI",
      qWeight: 2,
      scoreCap: 5,
      options: [
        { text: "A", rawScore: 2, isDecoy: false },
        { text: "B", rawScore: 1, isDecoy: false },
      ],
    };
    const { status, body } = await api("/api/admin/questions/D1.Q1", { method: "PATCH", headers: { Cookie: adminCookie }, body: JSON.stringify(asMulti) });
    expect(status).toBe(400);
    expect(body.error).toBe("This question's type cannot change while it is used in an assessment.");
    // The seeded question is untouched.
    const after = await api("/api/admin/questions/D1.Q1", { headers: { Cookie: adminCookie } });
    expect(after.body.question.type).toBe("ORDINAL");
  });
});
