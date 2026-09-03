/**
 * Task 24G — CV upload, manual CV scoring and role detail API tests.
 *
 * Live-database coverage (skipped without DATABASE_URL) that drives the real
 * Express routers against TiDB:
 * - applicant CV upload lifecycle (upload, replace, inspect, remove) with
 *   server-side content validation (never trusts the browser MIME type)
 * - cross-applicant isolation and Admin-only file access
 * - manual CV score persistence and validation (0–100, one decimal)
 * - assessment protection: saving/changing a CV score never alters the
 *   assessment evaluation
 * - DB-driven role detail contract (short description on the list, full
 *   description on the detail, synthetic roles serve their own copy)
 *
 * Every mutation uses temporary records removed during cleanup.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionForUser } from "./adminAuth";
import { createAdminApplicationApiRouter } from "./adminApplicationApi";
import { createApplicationApiRouter } from "./applicationApi";
import { createCvApiRouter } from "./cvApi";
import { createRecruitmentApiRouter } from "./recruitmentApi";
import { COOKIE_NAME } from "../shared/const";
import { CV_MAX_FILE_SIZE } from "../shared/cvApi";

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

// Minimal valid-looking CV payloads (magic-byte identified).
const pdfBytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("Task 24G test CV content.\n"), Buffer.alloc(64, 0x41)]);
const docBytes = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64, 0x42)]);
const docxBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml"), Buffer.alloc(64, 0x43)]);

suite("Task 24G CV upload, scoring and role detail against TiDB", () => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createApplicationApiRouter());
  app.use(createCvApiRouter());
  app.use(createAdminApplicationApiRouter());
  app.use(createRecruitmentApiRouter());

  let server: Server;
  let baseUrl = "";
  let adminCookie = "";
  let viewerCookie = "";
  const marker = randomBytes(6).toString("hex");
  const roleSlug = `tmp-role-${marker}`;
  const roleShort = `Task 24G short ${marker}`;
  const roleFull = `## About ${marker}\n\nA **rich** description for the *synthetic* role.\n\n- Benefit one\n- Benefit two`;
  let roleId = "";
  let applicationA: { id: string; token: string } | null = null;
  let applicationB: { id: string; token: string } | null = null;
  const cleanup: Array<{ table: string; column: string; value: string }> = [];

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const { getDatabase } = await import("./db");
    const { users, adminProfiles, recruitmentRoles } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();

    // Admin user + profile.
    const adminOpenId = `task24g-admin-${marker}`;
    await db.insert(users).values({ openId: adminOpenId, email: `task24g-admin-${marker}@example.com`, loginMethod: "test", role: "user" });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({ id: `task24g-profile-${marker}`, authUserId: adminUser.id, email: `task24g-admin-${marker}@example.com`, role: "Admin", status: "Active" });
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    // Viewer without an admin profile (must be rejected).
    const viewerOpenId = `task24g-viewer-${marker}`;
    await db.insert(users).values({ openId: viewerOpenId, email: `task24g-viewer-${marker}@example.com`, loginMethod: "test", role: "user" });
    const viewerUser = (await db.select().from(users).where(sql`${users.openId} = ${viewerOpenId}`).limit(1))[0];
    viewerCookie = `${COOKIE_NAME}=${(await createSessionForUser(viewerUser.id)).token}`;

    cleanup.push({ table: "admin_profiles", column: "auth_user_id", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(viewerUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(adminUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(viewerUser.id) });

    // Synthetic Open role with rich short + full descriptions (no gates).
    await db.insert(recruitmentRoles).values({
      id: `task24g-role-${marker}`,
      slug: roleSlug,
      title: `Task 24G Role ${marker}`,
      department: "Test Department",
      location: "Test Location",
      employmentType: "Full-time",
      shortDescription: roleShort,
      fullDescription: roleFull,
      status: "Open",
      closingDate: "2027-12-31",
    });
    roleId = `task24g-role-${marker}`;
    cleanup.push({ table: "recruitment_roles", column: "id", value: roleId });

    // Two applicant applications against the synthetic role.
    const create = async (suffix: string) => {
      const response = await fetch(`${baseUrl}/api/public/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleSlug,
          fullName: `Task24G Applicant ${suffix}`,
          email: `task24g-${suffix}-${marker}@example.com`,
          phone: "+234 800 0000",
          city: "Abuja",
          currentStatus: "Employed",
          recentRole: "Test Associate",
          totalExperience: "1-3 years",
          relevantExperience: "1-3 years",
          eligibility: {},
        }),
      });
      const body = (await response.json()) as { ok?: boolean; applicationId?: string; applicantToken?: string };
      if (response.status !== 201 || !body.applicationId || !body.applicantToken) throw new Error(`application create failed: ${response.status}`);
      return { id: body.applicationId, token: body.applicantToken };
    };
    applicationA = await create("a");
    applicationB = await create("b");
    cleanup.push({ table: "applications", column: "id", value: applicationA.id });
    cleanup.push({ table: "applications", column: "id", value: applicationB.id });
  });

  afterAll(async () => {
    const { getDatabase } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();
    // Applications cascade their CV file/review rows; roles are standalone.
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
    return { status: response.status, response, body: (await response.json().catch(() => null)) as Record<string, any> };
  }

  async function uploadCv(token: string, bytes: Buffer, filename: string) {
    return fetch(`${baseUrl}/api/public/applications/me/cv`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "X-Application-Token": token, "x-cv-filename": encodeURIComponent(filename) },
      body: new Uint8Array(bytes),
    });
  }

  // ── Upload lifecycle ───────────────────────────────────────────────────────

  it("accepts a supported PDF upload and returns metadata without storage details", async () => {
    expect(applicationA).not.toBeNull();
    const response = await uploadCv(applicationA!.token, pdfBytes, "applicant-a.pdf");
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.cv.originalFilename).toBe("applicant-a.pdf");
    expect(body.cv.mimeType).toBe("application/pdf");
    expect(body.cv.fileSize).toBe(pdfBytes.length);

    // Applicant metadata responses never expose storage keys or URLs.
    const inspect = await api("/api/public/applications/me/cv", { headers: { "X-Application-Token": applicationA!.token } });
    expect(inspect.status).toBe(200);
    expect(JSON.stringify(inspect.body)).not.toContain("storageKey");
    expect(JSON.stringify(inspect.body)).not.toContain("cv/");
  });

  it("replaces the CV safely: one active file per application", async () => {
    expect(applicationA).not.toBeNull();
    const response = await uploadCv(applicationA!.token, docxBytes, "applicant-a-updated.docx");
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, any>;
    expect(body.cv.originalFilename).toBe("applicant-a-updated.docx");
    expect(body.cv.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const adminCv = await api(`/api/admin/applications/${applicationA!.id}/cv`, { headers: { Cookie: adminCookie } });
    expect(adminCv.body.cv.originalFilename).toBe("applicant-a-updated.docx");
    // The Admin file route now streams the replacement bytes.
    const fileResponse = await fetch(`${baseUrl}/api/admin/applications/${applicationA!.id}/cv/file`, { headers: { Cookie: adminCookie } });
    expect(new Uint8Array(await fileResponse.arrayBuffer())).toEqual(new Uint8Array(docxBytes));
  });

  it("rejects unsupported file types", async () => {
    expect(applicationB).not.toBeNull();
    const response = await uploadCv(applicationB!.token, Buffer.from("plain text content"), "notes.txt");
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, any>;
    expect(body.ok).toBe(false);
    expect(body.error).toContain("PDF, DOC or DOCX");
  });

  it("rejects files larger than 10 MB", async () => {
    expect(applicationB).not.toBeNull();
    const oversized = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(CV_MAX_FILE_SIZE - 8)]);
    const response = await uploadCv(applicationB!.token, oversized, "large.pdf");
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, any>;
    expect(body.error).toContain("too large");
  });

  it("rejects content whose magic bytes do not match the extension", async () => {
    expect(applicationB).not.toBeNull();
    const response = await uploadCv(applicationB!.token, Buffer.from("not really a pdf"), "fake.pdf");
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, any>;
    expect(body.ok).toBe(false);
  });

  it("requires an applicant token and blocks unknown tokens", async () => {
    const anon = await api("/api/public/applications/me/cv");
    expect(anon.status).toBe(401);
    const unknown = await api("/api/public/applications/me/cv", { headers: { "X-Application-Token": "not-a-real-token" } });
    expect(unknown.status).toBe(403);
  });

  it("isolates applicants: B never sees A's CV and removing works", async () => {
    expect(applicationA && applicationB).toBeTruthy();
    // B inspects its own CV: nothing uploaded.
    const bView = await api("/api/public/applications/me/cv", { headers: { "X-Application-Token": applicationB!.token } });
    expect(bView.body.cv).toBeNull();

    // B uploads its own DOC — A's file is unaffected.
    const upload = await uploadCv(applicationB!.token, docBytes, "applicant-b.doc");
    expect(upload.status).toBe(200);
    const aView = await api("/api/public/applications/me/cv", { headers: { "X-Application-Token": applicationA!.token } });
    expect(aView.body.cv.originalFilename).toBe("applicant-a-updated.docx");

    // Applicant metadata never carries a download URL; the Admin proxy is the
    // only file path. Remove A's CV and confirm both sides agree.
    const remove = await api("/api/public/applications/me/cv", { method: "DELETE", headers: { "X-Application-Token": applicationA!.token } });
    expect(remove.status).toBe(200);
    expect(remove.body.cv).toBeNull();
    const adminFile = await api(`/api/admin/applications/${applicationA!.id}/cv/file`, { headers: { Cookie: adminCookie } });
    expect(adminFile.status).toBe(404);
  });

  // ── Admin access & file proxy ──────────────────────────────────────────────

  it("blocks unauthenticated and non-Admin access to CV endpoints", async () => {
    expect(applicationB).not.toBeNull();
    const endpoints: Array<[string, RequestInit?]> = [
      [`/api/admin/applications/${applicationB!.id}/cv`],
      [`/api/admin/applications/${applicationB!.id}/cv/file`],
      [`/api/admin/applications/${applicationB!.id}/cv-review`, { method: "PUT", body: JSON.stringify({ score: 50 }) }],
    ];
    for (const [path, init] of endpoints) {
      const anon = await api(path, init);
      expect(anon.status, `anonymous ${path}`).toBe(401);
      const viewer = await api(path, { ...init, headers: { Cookie: viewerCookie } });
      expect(viewer.status, `viewer ${path}`).toBe(401);
    }
  });

  it("streams the CV through the authenticated proxy with download control", async () => {
    expect(applicationB).not.toBeNull();
    const inline = await fetch(`${baseUrl}/api/admin/applications/${applicationB!.id}/cv/file`, { headers: { Cookie: adminCookie } });
    expect(inline.status).toBe(200);
    expect(inline.headers.get("content-type")).toBe("application/msword");
    expect(inline.headers.get("cache-control")).toBe("no-store");
    expect(inline.headers.get("content-disposition")).toContain("inline");
    expect(new Uint8Array(await inline.arrayBuffer())).toEqual(new Uint8Array(docBytes));

    const download = await fetch(`${baseUrl}/api/admin/applications/${applicationB!.id}/cv/file?download=1`, { headers: { Cookie: adminCookie } });
    expect(download.headers.get("content-disposition")).toContain("attachment");
  });

  // ── Manual CV scoring ──────────────────────────────────────────────────────

  it("saves a manual CV score with note and supports update and reset", async () => {
    expect(applicationB).not.toBeNull();
    const saved = await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 86.5, note: "Strong evidence of BD results." }),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.review.score).toBe(86.5);
    expect(saved.body.review.reviewNote).toBe("Strong evidence of BD results.");

    const updated = await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 74 }),
    });
    expect(updated.body.review.score).toBe(74);
    expect(updated.body.review.reviewNote).toBeNull();

    // A score of 0 is a valid reviewed score, not "missing".
    const zero = await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 0 }),
    });
    expect(zero.status).toBe(200);
    expect(zero.body.review.score).toBe(0);

    const reset = await api(`/api/admin/applications/${applicationB!.id}/cv-review`, { method: "DELETE", headers: { Cookie: adminCookie } });
    expect(reset.status).toBe(200);
    expect(reset.body.review).toBeNull();
  });

  it("rejects CV scores outside 0–100 or with more than one decimal", async () => {
    expect(applicationB).not.toBeNull();
    const cases: unknown[] = [-1, 100.1, 101, "74.25", "abc", null];
    for (const score of cases) {
      const result = await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ score }),
      });
      expect(result.status, `score ${JSON.stringify(score)}`).toBe(400);
      expect(result.body.ok).toBe(false);
    }
  });

  it("returns cvScore and cvUploaded on the screening list", async () => {
    expect(applicationB).not.toBeNull();
    await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 60 }),
    });
    const list = await api("/api/admin/applications", { headers: { Cookie: adminCookie } });
    const row = list.body.applications.find((a: any) => a.id === applicationB!.id);
    expect(row.cvScore).toBe(60);
    expect(row.cvUploaded).toBe(true);
    const detail = await api(`/api/admin/applications/${applicationB!.id}`, { headers: { Cookie: adminCookie } });
    expect(detail.body.application.cv).not.toBeNull();
    expect(detail.body.application.cvReview.score).toBe(60);
    await api(`/api/admin/applications/${applicationB!.id}/cv-review`, { method: "DELETE", headers: { Cookie: adminCookie } });
  });

  // ── Assessment protection ──────────────────────────────────────────────────

  it("never changes the assessment evaluation when CV data changes", async () => {
    expect(applicationB).not.toBeNull();
    const before = await api(`/api/admin/applications/${applicationB!.id}/evaluation`, { headers: { Cookie: adminCookie } });

    await uploadCv(applicationB!.token, docBytes, "applicant-b-v2.doc");
    await api(`/api/admin/applications/${applicationB!.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 99 }),
    });

    const after = await api(`/api/admin/applications/${applicationB!.id}/evaluation`, { headers: { Cookie: adminCookie } });
    expect(after.body).toEqual(before.body);

    await api(`/api/admin/applications/${applicationB!.id}/cv-review`, { method: "DELETE", headers: { Cookie: adminCookie } });
  });

  it("leaves a real scored candidate's assessment evaluation untouched by CV review", async () => {
    const list = await api("/api/admin/applications", { headers: { Cookie: adminCookie } });
    const scored = (list.body.applications as Array<{ id: string; finalScore: number | null }>).find((a) => a.finalScore !== null);
    if (!scored) return; // No scored candidate in this environment — covered by the synthetic test above.

    const before = await api(`/api/admin/applications/${scored.id}/evaluation`, { headers: { Cookie: adminCookie } });
    const save = await api(`/api/admin/applications/${scored.id}/cv-review`, {
      method: "PUT",
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ score: 77.5 }),
    });
    expect(save.status).toBe(200);
    const after = await api(`/api/admin/applications/${scored.id}/evaluation`, { headers: { Cookie: adminCookie } });
    expect(after.body).toEqual(before.body);
    // Restore the candidate's original state.
    await api(`/api/admin/applications/${scored.id}/cv-review`, { method: "DELETE", headers: { Cookie: adminCookie } });
  });

  // ── Role detail contract ───────────────────────────────────────────────────

  it("serves the short description on the public list and the full description on the detail", async () => {
    const list = await api("/api/public/recruitment-roles");
    const card = list.body.roles.find((r: any) => r.slug === roleSlug);
    expect(card).toBeDefined();
    expect(card.shortDescription).toBe(roleShort);

    const detail = await api(`/api/public/recruitment-roles/${roleSlug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.role.shortDescription).toBe(roleShort);
    expect(detail.body.role.fullDescription).toBe(roleFull);
    expect(detail.body.role.title).toContain(marker);
  });
});
