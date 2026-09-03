/**
 * Task 24C-1 — Recruitment Role, Eligibility and Evaluation Framework API tests.
 *
 * Pure coverage for the shared contract helpers (validation, slugs, gate
 * summaries, band ranges); live-database coverage (skipped without
 * DATABASE_URL) drives the real Express router against TiDB and verifies the
 * public applicant-safe endpoints (A–E), the Task 24B-authorized Admin
 * endpoints (F–J), the Evaluation Framework configuration, DB-failure
 * restraint, and status-regression behavior.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionForUser } from "./adminAuth";
import { createRecruitmentApiRouter } from "./recruitmentApi";
import { COOKIE_NAME } from "../shared/const";
import {
  describeScreeningBandRange,
  deriveEligibilityGateSummary,
  formatRoleDateLabel,
  formatRoleUpdatedLabel,
  resolveUniqueSlug,
  slugifyRoleTitle,
  validateRecruitmentRoleInput,
  type RecruitmentRoleInput,
} from "../shared/recruitmentApi";

// ── Pure contract helpers (no database required) ─────────────────────────────

describe("role input validation", () => {
  const validInput: RecruitmentRoleInput = {
    title: "Operations Coordinator",
    department: "Operations",
    location: "Riyadh",
    employmentType: "Full-time",
    shortDescription: "Coordinate delivery across teams.",
    fullDescription: "A longer description of the role.",
    status: "Draft",
    openingDate: "2026-09-01",
    closingDate: "2026-10-01",
  };

  it("accepts a complete, valid input", () => {
    const outcome = validateRecruitmentRoleInput(validInput);
    expect("input" in outcome).toBe(true);
    if ("input" in outcome) expect(outcome.input).toEqual(validInput);
  });

  it("rejects missing required fields with restrained messages", () => {
    const outcome = validateRecruitmentRoleInput({});
    expect("errors" in outcome).toBe(true);
    if ("errors" in outcome) {
      expect(outcome.errors).toEqual(
        expect.arrayContaining(["Enter a role title.", "Enter a department.", "Enter a location.", "Select a valid employment type.", "Enter a short role description.", "Select a valid role status."]),
      );
    }
    expect(validateRecruitmentRoleInput(null)).toEqual({ errors: ["Role data is missing."] });
  });

  it("rejects invalid employment types, statuses, and date combinations", () => {
    expect(validateRecruitmentRoleInput({ ...validInput, employmentType: "Volunteer" })).toEqual({ errors: ["Select a valid employment type."] });
    expect(validateRecruitmentRoleInput({ ...validInput, status: "Retired" })).toEqual({ errors: ["Select a valid role status."] });
    expect(validateRecruitmentRoleInput({ ...validInput, openingDate: "2026-13-01", closingDate: null })).toEqual({ errors: ["The opening date is not valid."] });
    expect(validateRecruitmentRoleInput({ ...validInput, openingDate: "2026-10-01", closingDate: "2026-09-01" })).toEqual({ errors: ["Closing date must be after the opening date."] });
  });

  it("normalizes empty dates to null and trims strings", () => {
    const outcome = validateRecruitmentRoleInput({ ...validInput, openingDate: "", closingDate: null, title: "  Trimmed Title  " });
    if ("input" in outcome) {
      expect(outcome.input.openingDate).toBeNull();
      expect(outcome.input.closingDate).toBeNull();
      expect(outcome.input.title).toBe("Trimmed Title");
    } else expect.unreachable();
  });
});

describe("slug helpers", () => {
  it("slugifies titles into stable URL fragments", () => {
    expect(slugifyRoleTitle("Business Development Officer")).toBe("business-development-officer");
    expect(slugifyRoleTitle("  Senior -- Analyst (HQ)  ")).toBe("senior-analyst-hq");
    expect(slugifyRoleTitle("###")).toBe("recruitment-role");
  });

  it("resolves the first free slug variant", () => {
    const taken = new Set(["role-a", "role-a-2"]);
    expect(resolveUniqueSlug("role-a", taken)).toBe("role-a-3");
    expect(resolveUniqueSlug("role-b", taken)).toBe("role-b");
  });
});

describe("gate summary and band range helpers", () => {
  it("derives the restrained gate summary", () => {
    const summary = deriveEligibilityGateSummary([
      { status: "Active" },
      { status: "Active" },
      { status: "Configuration Required" },
      { status: "Inactive" },
    ]);
    expect(summary).toEqual({ totalCount: 4, activeCount: 2, configurationRequiredCount: 1 });
  });

  it("describes band ranges with the approved copy", () => {
    expect(describeScreeningBandRange({ band: "A", minimumScore: 80, maximumScore: 100, label: "" })).toBe("80–100");
    expect(describeScreeningBandRange({ band: "B", minimumScore: 65, maximumScore: 79.999, label: "" })).toBe("65–79");
    expect(describeScreeningBandRange({ band: "C", minimumScore: 50, maximumScore: 64.999, label: "" })).toBe("50–64");
    expect(describeScreeningBandRange({ band: "D", minimumScore: 0, maximumScore: 49.999, label: "" })).toBe("Below 50");
  });

  it("formats date labels with a null-safe fallback", () => {
    expect(formatRoleUpdatedLabel("2026-08-26T00:00:00.000Z")).toBe("26 Aug 2026");
    expect(formatRoleUpdatedLabel("not-a-date")).toBe("—");
    expect(formatRoleDateLabel(null)).toBe("Not set");
    expect(formatRoleDateLabel("2026-08-26T00:00:00.000Z")).toBe("26 Aug 2026");
  });
});

// ── Live API integration (skipped without DATABASE_URL) ───────────────────────

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("Task 24C-1 recruitment API against TiDB", () => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createRecruitmentApiRouter());

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
    const { users, adminProfiles, authSessions } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();

    // Authorized Admin: auth user + Active Admin profile + live session.
    const adminOpenId = `task24c1-admin-${marker}`;
    await db.insert(users).values({ openId: adminOpenId, email: `task24c1-admin-${marker}@example.com`, loginMethod: "test", role: "user" });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({ id: `task24c1-profile-${marker}`, authUserId: adminUser.id, email: `task24c1-admin-${marker}@example.com`, role: "Admin", status: "Active" });
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    // Authenticated viewer WITHOUT an Admin profile — authorization must fail.
    const viewerOpenId = `task24c1-viewer-${marker}`;
    await db.insert(users).values({ openId: viewerOpenId, email: `task24c1-viewer-${marker}@example.com`, loginMethod: "test", role: "user" });
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

  // ── A–E: public applicant-safe endpoints ─────────────────────────────────

  it("A. public role list exposes Open/Closed roles without ids or internal configuration", async () => {
    const { status, body } = await api("/api/public/recruitment-roles");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.roles)).toBe(true);
    expect(body.roles.length).toBeGreaterThan(0);
    expect(body.roles.some((role: any) => role.slug === "business-development-officer")).toBe(true);
    for (const role of body.roles) {
      expect(["Open", "Closed"]).toContain(role.status);
      expect(role.id).toBeUndefined();
      expect(role.updatedAt).toBeUndefined();
    }
    expect(JSON.stringify(body)).not.toMatch(/weight|floor|multiplier|penalty|bonusCap/i);
  });

  it("B. public role detail serves the seeded role by slug", async () => {
    const { status, body } = await api("/api/public/recruitment-roles/business-development-officer");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.role).toMatchObject({ slug: "business-development-officer", title: "Business Development Officer", status: "Open" });
    expect(body.role.id).toBeUndefined();
  });

  it("C. public detail returns a restrained 404 for unknown slugs", async () => {
    const { status, body } = await api("/api/public/recruitment-roles/does-not-exist");
    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, error: "Unable to load this recruitment role." });
  });

  it("D. public eligibility exposes the BDO gate configuration", async () => {
    const { status, body } = await api("/api/public/recruitment-roles/business-development-officer/eligibility");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.roleSlug).toBe("business-development-officer");
    // BDO now has 5 live gates (G2, G6, G7 removed via Admin dashboard).
    expect(body.gates).toHaveLength(5);
    expect(body.summary).toEqual({ totalCount: 5, activeCount: 5, configurationRequiredCount: 0 });
    // G1 is still Abuja availability with SINGLE_SELECT and three options.
    const gate1 = body.gates.find((gate: any) => gate.reference === "G1");
    expect(gate1.inputType).toBe("SINGLE_SELECT");
    expect(Array.isArray(gate1.options)).toBe(true);
    expect(gate1.options.map((option: any) => option.value)).toEqual(["abuja", "relocate", "not-relocate"]);
    // G2 is now the Minimum BD experience gate (APPLICATION_FIELD experience check).
    const gate2 = body.gates.find((gate: any) => gate.reference === "G2");
    expect(gate2).toBeDefined();
    // Option outcomes drive evaluation and are never exposed to applicants.
    expect(JSON.stringify(body)).not.toMatch(/"outcome"/);
    for (const gate of body.gates) {
      expect(gate.configuration).toBeUndefined();
    }
    expect(JSON.stringify(body)).not.toMatch(/requiredAnswer|relevantDomains|scoring/i);
  });

  it("E. public eligibility 404s for unknown roles and never leaks Admin data", async () => {
    const { status, body } = await api("/api/public/recruitment-roles/no-such-role/eligibility");
    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, error: "Unable to load this recruitment role." });
  });

  // ── F–J: Admin endpoints guarded by Task 24B authorization ───────────────

  it("F. Admin endpoints require an authorized Admin session", async () => {
    for (const path of [
      "/api/admin/recruitment-roles",
      "/api/admin/recruitment-roles/business-development-officer",
      "/api/admin/recruitment-roles/business-development-officer/eligibility",
      "/api/admin/recruitment-roles/business-development-officer/evaluation-framework",
    ]) {
      const anonymous = await api(path);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body).toEqual({ ok: false, error: "Admin authorization is required." });
      const viewer = await api(path, { headers: { Cookie: viewerCookie } });
      expect(viewer.status).toBe(401);
    }
    const createAnonymous = await api("/api/admin/recruitment-roles", { method: "POST", body: JSON.stringify({}) });
    expect(createAnonymous.status).toBe(401);
  });

  it("G. Admin role list includes every status with ids and timestamps", async () => {
    const { status, body } = await api("/api/admin/recruitment-roles", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const seeded = body.roles.find((role: any) => role.slug === "business-development-officer");
    expect(seeded).toMatchObject({ id: "role-business-development-officer", status: "Open" });
    expect(typeof seeded.updatedAt).toBe("string");
  });

  it("H. Admin can create, update, and look up roles with slug uniqueness", async () => {
    const payload = {
      title: `Task 24C1 Test Role ${marker}`,
      department: "People",
      location: "Remote",
      employmentType: "Contract",
      shortDescription: "Temporary verification role.",
      fullDescription: "",
      status: "Draft",
      openingDate: null,
      closingDate: null,
    };
    const created = await api("/api/admin/recruitment-roles", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify(payload) });
    expect(created.status).toBe(201);
    expect(created.body.ok).toBe(true);
    expect(created.body.role.slug).toBe(`task-24c1-test-role-${marker}`);
    cleanup.push({ table: "recruitment_roles", column: "id", value: created.body.role.id });

    // Lookup works by both database id and slug.
    const byId = await api(`/api/admin/recruitment-roles/${created.body.role.id}`, { headers: { Cookie: adminCookie } });
    expect(byId.status).toBe(200);
    const bySlug = await api(`/api/admin/recruitment-roles/${created.body.role.slug}`, { headers: { Cookie: adminCookie } });
    expect(bySlug.status).toBe(200);

    // Duplicate title receives a suffixed slug rather than failing.
    const duplicate = await api("/api/admin/recruitment-roles", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify(payload) });
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.role.slug).toBe(`task-24c1-test-role-${marker}-2`);
    cleanup.push({ table: "recruitment_roles", column: "id", value: duplicate.body.role.id });

    // Metadata-only update leaves eligibility gates untouched.
    const updated = await api(`/api/admin/recruitment-roles/${created.body.role.id}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ ...payload, title: `Task 24C1 Test Role ${marker} Revised`, status: "Open" }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.role.title).toBe(`Task 24C1 Test Role ${marker} Revised`);
    expect(updated.body.role.status).toBe("Open");

    // Invalid input is rejected server-side with a restrained message.
    const invalid = await api("/api/admin/recruitment-roles", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify({ title: "" }) });
    expect(invalid.status).toBe(400);
    expect(invalid.body.ok).toBe(false);
    expect(typeof invalid.body.error).toBe("string");

    // Unknown role yields the restrained 404.
    const missing = await api("/api/admin/recruitment-roles/no-such-role", { headers: { Cookie: adminCookie } });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ ok: false, error: "Unable to load this recruitment role." });
  });

  it("I. Admin eligibility exposes full gate configuration for all live BDO gates", async () => {
    const { status, body } = await api("/api/admin/recruitment-roles/business-development-officer/eligibility", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.roleId).toBe("role-business-development-officer");
    // BDO now has 5 live gates (G2/G6/G7 removed via Admin dashboard).
    expect(body.gates).toHaveLength(5);
    expect(body.gates.map((gate: any) => gate.reference)).toEqual(["G1", "G2", "G3", "G4", "G5"]);
    // Every gate must have a configuration object with at least an inputType.
    for (const gate of body.gates) {
      const conf = typeof gate.configuration === "string" ? JSON.parse(gate.configuration) : gate.configuration;
      expect(typeof conf.inputType).toBe("string");
      expect(gate.displayOrder).toBeGreaterThan(0);
    }
  });

  it("J. Evaluation Framework serves the approved v2 configuration", async () => {
    const { status, body } = await api("/api/admin/recruitment-roles/business-development-officer/evaluation-framework", { headers: { Cookie: adminCookie } });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.roleId).toBe("role-business-development-officer");
    expect(body.dimensions.map((dimension: any) => dimension.reference)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
    expect(body.dimensions.map((dimension: any) => dimension.weight)).toEqual([22, 18, 14, 12, 12, 8, 8, 6]);
    expect(body.totalWeight).toBe(100);
    expect(body.dimensions.filter((dimension: any) => dimension.minimumFloor !== null).map((dimension: any) => [dimension.reference, dimension.minimumFloor])).toEqual([
      ["D1", 50],
      ["D2", 40],
      ["D5", 50],
    ]);
    expect(body.screening).not.toBeNull();
    expect(body.screening.integrityPenalty).toBe(10);
    expect(body.screening.bonusCap).toBe(5);
    expect(body.screening.verification.map((entry: any) => entry.multiplier)).toEqual([1, 0.95, 0.85]);
    expect(body.screening.bands.map((band: any) => [band.band, band.minimumScore])).toEqual([
      ["A", 80],
      ["B", 65],
      ["C", 50],
      ["D", 0],
    ]);
  });

  // ── Role status regression ────────────────────────────────────────────────

  it("keeps Draft and Archived roles hidden from applicants while Admins see them", async () => {
    const payload = {
      title: `Task 24C1 Hidden Role ${marker}`,
      department: "People",
      location: "Remote",
      employmentType: "Full-time",
      shortDescription: "Hidden role.",
      fullDescription: "",
      status: "Draft",
      openingDate: null,
      closingDate: null,
    };
    const created = await api("/api/admin/recruitment-roles", { method: "POST", headers: { Cookie: adminCookie }, body: JSON.stringify(payload) });
    expect(created.status).toBe(201);
    cleanup.push({ table: "recruitment_roles", column: "id", value: created.body.role.id });
    const slug = created.body.role.slug;

    const publicList = await api("/api/public/recruitment-roles");
    expect(publicList.body.roles.some((role: any) => role.slug === slug)).toBe(false);
    expect((await api(`/api/public/recruitment-roles/${slug}`)).status).toBe(404);
    expect((await api(`/api/public/recruitment-roles/${slug}/eligibility`)).status).toBe(404);

    const adminView = await api(`/api/admin/recruitment-roles/${slug}`, { headers: { Cookie: adminCookie } });
    expect(adminView.status).toBe(200);
    expect(adminView.body.role.status).toBe("Draft");
  });

  it("Closed roles stay publicly listed but never leak scoring configuration", async () => {
    const publicList = await api("/api/public/recruitment-roles");
    for (const role of publicList.body.roles) {
      expect(["Open", "Closed"]).toContain(role.status);
    }
    const eligibility = await api("/api/public/recruitment-roles/business-development-officer/eligibility");
    const serialized = JSON.stringify(eligibility.body);
    for (const forbidden of ["weight", "floor", "multiplier", "integrityPenalty", "bonusCap", "minimumScore"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
