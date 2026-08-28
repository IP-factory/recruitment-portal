/**
 * Task 24C-3 — Admin Assessment API tests.
 *
 * Live-database coverage (skipped without DATABASE_URL) that drives the real
 * Express router against TiDB: authorization, the seeded assessment list,
 * detail projection with full ordered assignments, preview configuration
 * (retiring the firstQuestionOptions limitation), and the transactional
 * assignment management lifecycle (add, remove, reorder, duplicate rejection,
 * inactive-question rejection).
 *
 * Every test that mutates data uses temporary records and restores the seeded
 * BDO v2 assessment to its exact approved state before exiting.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionForUser } from "./adminAuth";
import { createAssessmentApiRouter } from "./assessmentApi";
import { COOKIE_NAME } from "../shared/const";

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

// ── Approved seeded order ─────────────────────────────────────────────────────

const APPROVED_ORDER = [
  "D1.Q1", "D3.Q1", "D2.Q3", "D4.Q1", "D4.Q2", "D3.Q3", "D5.Q1",
  "D2.Q1", "D2.Q1E", "D7.Q1", "D1.Q2", "D6.Q1", "D8.Q1", "D2.Q2",
] as const;

const BDO_V2_SLUG = "business-development-officer-assessment-v2";

suite("Task 24C-3 Assessment API against TiDB", () => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createAssessmentApiRouter());

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

    // Admin user + profile.
    const adminOpenId = `task24c3-admin-${marker}`;
    await db.insert(users).values({
      openId: adminOpenId,
      email: `task24c3-admin-${marker}@example.com`,
      loginMethod: "test",
      role: "user",
    });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({
      id: `task24c3-profile-${marker}`,
      authUserId: adminUser.id,
      email: `task24c3-admin-${marker}@example.com`,
      role: "Admin",
      status: "Active",
    });
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    // Viewer (no admin_profile).
    const viewerOpenId = `task24c3-viewer-${marker}`;
    await db.insert(users).values({
      openId: viewerOpenId,
      email: `task24c3-viewer-${marker}@example.com`,
      loginMethod: "test",
      role: "user",
    });
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
    // First: clean up any test questions/assessments created by this run.
    // Use pattern-based deletes that are idempotent and safe to repeat.
    await db.execute(sql.raw(`DELETE FROM assessment_question_assignments WHERE assessment_id IN (SELECT id FROM assessments WHERE slug LIKE 'tmp-%' OR slug LIKE '%${marker}%')`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM assessments WHERE slug LIKE 'tmp-%' OR slug LIKE '%${marker}%'`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM assessment_question_assignments WHERE question_id IN (SELECT id FROM assessment_questions WHERE reference LIKE 'T24C3-%${marker.slice(0, 6)}%')`)).catch(() => undefined);
    await db.execute(sql.raw(`DELETE FROM assessment_questions WHERE reference LIKE 'T24C3-%'`)).catch(() => undefined);
    // Then: clean up auth records.
    for (const item of [...cleanup].reverse()) {
      await db.execute(sql.raw(`DELETE FROM ${item.table} WHERE ${item.column} = '${item.value}'`)).catch(() => undefined);
    }
    server?.close();
  });

  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  // ── Authorization ─────────────────────────────────────────────────────────

  it("rejects unauthenticated and non-Admin requests on every assessment endpoint", async () => {
    const endpoints: Array<[string, RequestInit?]> = [
      ["/api/admin/assessments"],
      [`/api/admin/assessments/${BDO_V2_SLUG}`],
      [`/api/admin/assessments/${BDO_V2_SLUG}/preview`],
      [`/api/admin/assessments/${BDO_V2_SLUG}/questions`, { method: "POST", body: JSON.stringify({ questionId: "x" }) }],
    ];
    for (const [path, init] of endpoints) {
      const anon = await api(path, init);
      expect(anon.status, `anonymous ${path}`).toBe(401);
      expect(anon.body).toEqual({ ok: false, error: "Admin authorization is required." });

      const viewer = await api(path, { ...init, headers: { Cookie: viewerCookie } });
      expect(viewer.status, `viewer ${path}`).toBe(401);
    }
  });

  // ── List ──────────────────────────────────────────────────────────────────

  it("returns the seeded assessments with correct counts and summary", async () => {
    const { status, body } = await api("/api/admin/assessments", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    // At least 1 seeded assessment: BDO v2 (Draft, 14 questions).
    // The legacy BDM assessment exists only in local mock data (adminAssessmentData.ts)
    // and is not seeded in TiDB.
    expect(body.assessments.length).toBeGreaterThanOrEqual(1);
    expect(body.summary.total).toBeGreaterThanOrEqual(1);

    const bdo = body.assessments.find((a: any) => a.slug === BDO_V2_SLUG);
    expect(bdo).toBeDefined();
    // Production state: BDO v2 is Active after the activation script; Draft is tolerated pre-activation.
    expect(["Active", "Draft"]).toContain(bdo.status);
    expect(bdo.version).toBe(2);
    expect(bdo.questionCount).toBe(14);
    expect(bdo.role.title).toContain("Business Development Officer");

    // questionCount is database-derived — no options/assignments on the list row.
    expect(bdo.assignments).toBeUndefined();
  });

  // ── Test 49: seeded assessment verification ────────────────────────────────

  it("TEST-49: seeded BDO v2 assessment has correct metadata", async () => {
    const { body } = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    expect(body.assessment.name).toBe("Business Development Officer Assessment v2");
    expect(body.assessment.version).toBe(2);
    // Production state: Active after the activation script; Draft is tolerated pre-activation.
    expect(["Active", "Draft"]).toContain(body.assessment.status);
    expect(body.assessment.questionCount).toBe(14);
  });

  // ── Test 50: exact order ───────────────────────────────────────────────────

  it("TEST-50: seeded BDO v2 assignments are in the exact approved order", async () => {
    const { body } = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    const refs = body.assessment.assignments.map((a: any) => a.reference);
    expect(refs).toEqual([...APPROVED_ORDER]);
  });

  // ── Detail ────────────────────────────────────────────────────────────────

  it("returns full assessment detail with role and ordered assignments", async () => {
    const { status, body } = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.assessment.assignments).toHaveLength(14);

    // Verify assignment shape.
    const first = body.assessment.assignments[0];
    expect(first.reference).toBe("D1.Q1");
    expect(first.displayOrder).toBe(1);
    expect(typeof first.assignmentId).toBe("string");
    expect(typeof first.questionId).toBe("string");
    expect(typeof first.prompt).toBe("string");
    expect(first.status).toBe("Active");

    // Detail row should not include full options/numericConfig (that's preview-only).
    expect(first.options).toBeUndefined();
    expect(first.numericConfig).toBeUndefined();
  });

  it("returns a restrained 404 for an unknown assessment", async () => {
    const { status, body } = await api("/api/admin/assessments/does-not-exist", { headers: { Cookie: adminCookie } });
    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, error: "Assessment not found." });
  });

  // ── Test 57: preview — all assigned questions, full config ────────────────

  it("TEST-57: preview returns all 14 assigned questions with complete type configuration (retires firstQuestionOptions)", async () => {
    const { status, body } = await api(`/api/admin/assessments/${BDO_V2_SLUG}/preview`, { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const preview = body.preview;
    expect(preview.assignments).toHaveLength(14);

    // Verify approved order is preserved in preview.
    const refs = preview.assignments.map((a: any) => a.question.reference);
    expect(refs).toEqual([...APPROVED_ORDER]);

    // Every question must have a complete question object (not just first).
    for (const assignment of preview.assignments) {
      expect(typeof assignment.question.id).toBe("string");
      expect(typeof assignment.question.type).toBe("string");
      expect(typeof assignment.question.prompt).toBe("string");
    }

    // ORDINAL (D1.Q1) — must have options.
    const d1q1 = preview.assignments.find((a: any) => a.question.reference === "D1.Q1");
    expect(d1q1.question.options.length).toBeGreaterThan(0);

    // MULTI (D3.Q1) — must have options and scoreCap.
    const d3q1 = preview.assignments.find((a: any) => a.question.reference === "D3.Q1");
    expect(d3q1.question.options.length).toBeGreaterThan(0);
    expect(typeof d3q1.question.scoreCap).toBe("number");

    // NUMERIC (D2.Q2) — must have numericConfig with bands.
    const d2q2 = preview.assignments.find((a: any) => a.question.reference === "D2.Q2");
    expect(d2q2.question.numericConfig).not.toBeNull();
    expect(d2q2.question.numericConfig.bands.length).toBeGreaterThan(0);

    // OPEN (D2.Q1) — must have openConfig with rubric.
    const d2q1 = preview.assignments.find((a: any) => a.question.reference === "D2.Q1");
    expect(d2q1.question.openConfig).not.toBeNull();
    expect(d2q1.question.openConfig.rubric.length).toBeGreaterThan(0);

    // EVIDENCE (D2.Q1E) — must have evidenceLink.
    const d2q1e = preview.assignments.find((a: any) => a.question.reference === "D2.Q1E");
    expect(d2q1e.question.evidenceLink).not.toBeNull();
    expect(d2q1e.question.evidenceLink.claimedQuestionReference).toBe("D2.Q1");

    // SJT (D5.Q1) — must have options with internalExplanation.
    const d5q1 = preview.assignments.find((a: any) => a.question.reference === "D5.Q1");
    expect(d5q1.question.options.length).toBe(4);
    expect(d5q1.question.options.every((o: any) => typeof o.internalExplanation === "string")).toBe(true);

    // The preview is NOT just the first question's options (the old bug) —
    // verify the 14th question (D2.Q2) also has full config.
    const last = preview.assignments.at(-1);
    expect(last.question.reference).toBe("D2.Q2");
    expect(last.question.numericConfig).not.toBeNull();
    expect(last.question.numericConfig.bands.length).toBeGreaterThan(0);
  });

  // ── Test 52: add question ─────────────────────────────────────────────────

  it("TEST-52: adding a question increases questionCount and produces a valid displayOrder", async () => {
    // Get a question reference that isn't already in BDO v2 by using a
    // question from the legacy BDM assessment or create a temporary one.
    // We'll use the BDM assessment's D5 question (D5.Q1 is already in BDO v2).
    // Instead, fetch the question list to find an un-assigned question.
    const { getDatabase } = await import("./db");
    const { assessmentQuestions: aq, assessmentQuestionAssignments: aqa, assessments: assTable } = await import("../drizzle/schema");
    const { sql, not, inArray, eq } = await import("drizzle-orm");
    const db = getDatabase();

    // Find the BDO v2 assessment id.
    const bdo = (await db.select().from(assTable).where(sql`${assTable.slug} = ${BDO_V2_SLUG}`).limit(1))[0];
    const assignedQIds = (await db.select({ questionId: aqa.questionId }).from(aqa).where(eq(aqa.assessmentId, bdo.id))).map((r) => r.questionId);

    // Insert a temporary Active question for this test.
    const tmpRef = `T24C3-ADD-${marker}`;
    await db.insert(aq).values({
      id: `tmp-q-${marker}-add`,
      reference: tmpRef,
      questionType: "SJT",
      prompt: "Temporary question for add test",
      helpText: "",
      required: 1,
      status: "Active",
    });
    cleanup.push({ table: "assessment_questions", column: "id", value: `tmp-q-${marker}-add` });

    // Add to BDO v2 via API.
    const add = await api(`/api/admin/assessments/${BDO_V2_SLUG}/questions`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ questionId: `tmp-q-${marker}-add` }),
    });
    expect(add.status).toBe(201);
    expect(add.body.ok).toBe(true);
    const assignments: any[] = add.body.assignments;
    expect(assignments).toHaveLength(15); // 14 + 1
    const added = assignments.find((a) => a.questionId === `tmp-q-${marker}-add`);
    expect(added).toBeDefined();
    expect(added.displayOrder).toBe(15);

    // Clean up: remove the temporary assignment.
    const remove = await api(`/api/admin/assessments/${BDO_V2_SLUG}/questions/tmp-q-${marker}-add`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    expect(remove.status).toBe(200);
    expect(remove.body.assignments).toHaveLength(14);
  });

  // ── Test 53: duplicate assignment ─────────────────────────────────────────

  it("TEST-53: assigning the same question twice returns a controlled validation error", async () => {
    // Attempt to re-add D1.Q1 (already assigned to BDO v2).
    const { getDatabase } = await import("./db");
    const { assessmentQuestions: aq } = await import("../drizzle/schema");
    const { sql: sqlHelper } = await import("drizzle-orm");
    const db = getDatabase();
    const d1q1Row = (await db.select().from(aq).where(sqlHelper`${aq.reference} = 'D1.Q1'`).limit(1))[0];

    const dupe = await api(`/api/admin/assessments/${BDO_V2_SLUG}/questions`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ questionId: d1q1Row.id }),
    });
    expect(dupe.status).toBe(400);
    expect(dupe.body.ok).toBe(false);
    expect(dupe.body.error).toContain("already assigned");
  });

  // ── Test 54: reorder ──────────────────────────────────────────────────────

  it("TEST-54: reordering persists to database and is reflected on fresh read", async () => {
    // Create a temporary assessment + 3 questions, reorder them, verify.
    const { getDatabase } = await import("./db");
    const { assessmentQuestions: aq, assessments: assTable, recruitmentRoles: roles, assessmentQuestionAssignments: aqa } = await import("../drizzle/schema");
    const { sql: sqlHelper, eq } = await import("drizzle-orm");
    const db = getDatabase();

    const bdo = (await db.select().from(assTable).where(sqlHelper`${assTable.slug} = ${BDO_V2_SLUG}`).limit(1))[0];

    // Use temporary questions.
    const tmpIds = [`tmp-q-${marker}-r1`, `tmp-q-${marker}-r2`, `tmp-q-${marker}-r3`];
    const tmpRefs = [`T24C3-R1-${marker}`, `T24C3-R2-${marker}`, `T24C3-R3-${marker}`];
    for (const [i, id] of tmpIds.entries()) {
      await db.insert(aq).values({ id, reference: tmpRefs[i], questionType: "SJT", prompt: `Temp reorder ${i + 1}`, helpText: "", required: 1, status: "Active" });
      cleanup.push({ table: "assessment_questions", column: "id", value: id });
    }

    // Create a temporary assessment (need a real role_id).
    const roleRow = (await db.select().from(roles).limit(1))[0];
    const tmpAssId = `tmp-assessment-${marker}`;
    const tmpAssSlug = `tmp-reorder-${marker}`;
    await db.insert(assTable).values({ id: tmpAssId, slug: tmpAssSlug, roleId: roleRow.id, name: `Temp Reorder ${marker}`, description: "", status: "Draft", version: 99 });
    cleanup.push({ table: "assessments", column: "id", value: tmpAssId });

    // Add 3 questions.
    for (const [i, qId] of tmpIds.entries()) {
      await api(`/api/admin/assessments/${tmpAssSlug}/questions`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ questionId: qId }),
      });
    }

    // Verify original order: r1, r2, r3.
    const before = await api(`/api/admin/assessments/${tmpAssSlug}`, { headers: { Cookie: adminCookie } });
    expect(before.body.assessment.assignments.map((a: any) => a.questionId)).toEqual(tmpIds);

    // Reorder to: r3, r1, r2.
    const reorder = await api(`/api/admin/assessments/${tmpAssSlug}/questions/order`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ orderedQuestionIds: [tmpIds[2], tmpIds[0], tmpIds[1]] }),
    });
    expect(reorder.status).toBe(200);
    expect(reorder.body.assignments[0].questionId).toBe(tmpIds[2]);
    expect(reorder.body.assignments[0].displayOrder).toBe(1);

    // Fresh read confirms persistence.
    const after = await api(`/api/admin/assessments/${tmpAssSlug}`, { headers: { Cookie: adminCookie } });
    expect(after.body.assessment.assignments.map((a: any) => a.questionId)).toEqual([tmpIds[2], tmpIds[0], tmpIds[1]]);
    expect(after.body.assessment.assignments.map((a: any) => a.displayOrder)).toEqual([1, 2, 3]);
  });

  // ── Test 55: remove assignment ────────────────────────────────────────────

  it("TEST-55: removing a temporary assignment leaves the question in the Question Bank", async () => {
    const { getDatabase } = await import("./db");
    const { assessmentQuestions: aq, assessments: assTable, recruitmentRoles: roles } = await import("../drizzle/schema");
    const { sql: sqlHelper } = await import("drizzle-orm");
    const db = getDatabase();

    const roleRow = (await db.select().from(roles).limit(1))[0];
    const tmpQId = `tmp-q-${marker}-rem`;
    const tmpAssId = `tmp-assessment-${marker}-rem`;
    const tmpAssSlug = `tmp-rem-${marker}`;

    await db.insert(aq).values({ id: tmpQId, reference: `T24C3-REM-${marker}`, questionType: "SJT", prompt: "Remove test", helpText: "", required: 1, status: "Active" });
    await db.insert(assTable).values({ id: tmpAssId, slug: tmpAssSlug, roleId: roleRow.id, name: `Temp Remove ${marker}`, description: "", status: "Draft", version: 98 });
    cleanup.push({ table: "assessment_questions", column: "id", value: tmpQId });
    cleanup.push({ table: "assessments", column: "id", value: tmpAssId });

    // Add then remove.
    await api(`/api/admin/assessments/${tmpAssSlug}/questions`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ questionId: tmpQId }),
    });

    const remove = await api(`/api/admin/assessments/${tmpAssSlug}/questions/${tmpQId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    expect(remove.status).toBe(200);
    expect(remove.body.assignments).toHaveLength(0);

    // Question still exists in Question Bank.
    const qRows = await db.select().from(aq).where(sqlHelper`${aq.id} = ${tmpQId}`).limit(1);
    expect(qRows).toHaveLength(1);
  });

  // ── Test 56: inactive question ────────────────────────────────────────────

  it("TEST-56: an Inactive question cannot be newly assigned", async () => {
    const { getDatabase } = await import("./db");
    const { assessmentQuestions: aq } = await import("../drizzle/schema");
    const db = getDatabase();

    const tmpQId = `tmp-q-${marker}-inactive`;
    await db.insert(aq).values({ id: tmpQId, reference: `T24C3-INACT-${marker}`, questionType: "SJT", prompt: "Inactive test", helpText: "", required: 1, status: "Inactive" });
    cleanup.push({ table: "assessment_questions", column: "id", value: tmpQId });

    const result = await api(`/api/admin/assessments/${BDO_V2_SLUG}/questions`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ questionId: tmpQId }),
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("Active questions");

    // BDO v2 still has exactly 14 assignments.
    const detail = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    expect(detail.body.assessment.assignments).toHaveLength(14);
  });

  // ── Test 51: authorization summary ───────────────────────────────────────

  it("TEST-51: an authorized Admin can access all assessment endpoints successfully", async () => {
    const list = await api("/api/admin/assessments", { headers: { Cookie: adminCookie } });
    expect(list.status).toBe(200);
    const detail = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    expect(detail.status).toBe(200);
    const preview = await api(`/api/admin/assessments/${BDO_V2_SLUG}/preview`, { headers: { Cookie: adminCookie } });
    expect(preview.status).toBe(200);
  });

  // ── BDO v2 restore verification ───────────────────────────────────────────

  it("TEST-66: BDO v2 assessment is unchanged after all tests (14 questions, approved order)", async () => {
    const { body } = await api(`/api/admin/assessments/${BDO_V2_SLUG}`, { headers: { Cookie: adminCookie } });
    // Production state: Active after the activation script; Draft is tolerated pre-activation.
    expect(["Active", "Draft"]).toContain(body.assessment.status);
    expect(body.assessment.version).toBe(2);
    expect(body.assessment.assignments).toHaveLength(14);
    expect(body.assessment.assignments.map((a: any) => a.reference)).toEqual([...APPROVED_ORDER]);
  });
});
