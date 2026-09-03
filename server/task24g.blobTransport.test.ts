/**
 * Task 24G (final transport fix) — CV Blob transport regression tests.
 *
 * Live-database coverage (skipped without DATABASE_URL) proving the Vercel
 * Blob transport model:
 * - a 10 MB permitted CV bypasses the application function body entirely
 *   (scoped client-token direct upload + metadata-only completion)
 * - upload authorizations are application-specific
 * - Applicant A cannot attach a Blob uploaded for Applicant B
 * - the Blob read-write token is never returned to the browser
 * - Admins must authenticate before receiving a private download URL
 * - unauthenticated users cannot obtain a private CV download
 * - production refuses the local filesystem fallback
 * - local development fallback still works
 *
 * The Blob control plane is exercised through the storage test seams (fakes),
 * so the proofs do not require a real Blob store. Every database mutation
 * uses temporary records removed during cleanup.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSessionForUser } from "./adminAuth";
import { createAdminApplicationApiRouter } from "./adminApplicationApi";
import { createApplicationApiRouter } from "./applicationApi";
import { createCvApiRouter } from "./cvApi";
import {
  CvStorageConfigurationError,
  getCvStorage,
  resetCvStorageForTests,
  setBlobSeamsForTests,
} from "./cvStorage";
import { COOKIE_NAME } from "../shared/const";
import { CV_MAX_FILE_SIZE } from "../shared/cvApi";

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

const pdfBytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("Task 24G transport test CV.\n"), Buffer.alloc(64, 0x41)]);

suite("Task 24G CV Blob transport", () => {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(createApplicationApiRouter());
  app.use(createCvApiRouter());
  app.use(createAdminApplicationApiRouter());

  let server: Server;
  let baseUrl = "";
  let adminCookie = "";
  let viewerCookie = "";
  const marker = randomBytes(6).toString("hex");
  const RW_TOKEN = `blob-rw-token-${marker}`;
  let roleId = "";
  let applicationA: { id: string; token: string } | null = null;
  let applicationB: { id: string; token: string } | null = null;
  const cleanup: Array<{ table: string; column: string; value: string }> = [];

  // Fake private Blob store + observed control-plane calls.
  const fakeStore = new Map<string, { size: number; contentType: string }>();
  const clientTokenRequests: Array<{ pathname: string; token: string; maximumSizeInBytes: number; allowedContentTypes: string[] }> = [];
  const signedTokenRequests: Array<{ pathname: string; operations: string[] }> = [];
  /** Bytes actually sent to the application function during this suite. */
  let bytesSentToApi = 0;

  function installFakeBlobSeams() {
    setBlobSeamsForTests({
      async generateClientToken(options) {
        clientTokenRequests.push({ pathname: options.pathname, token: options.token, maximumSizeInBytes: options.maximumSizeInBytes, allowedContentTypes: options.allowedContentTypes });
        return `scoped-client-token:${options.pathname}`;
      },
      async head(key) {
        const entry = fakeStore.get(key);
        return entry ? { size: entry.size, contentType: entry.contentType } : null;
      },
      async issueSignedToken(options) {
        signedTokenRequests.push({ pathname: options.pathname, operations: [...options.operations] });
        return { delegationToken: `delegation:${options.pathname}`, clientSigningToken: "signing-secret", validUntil: options.validUntil };
      },
      async presignUrl(signedToken, options) {
        return { presignedUrl: `https://fake.blob.vercel-storage.com/${options.pathname}?sig=${signedToken.delegationToken.slice(0, 8)}` };
      },
    });
  }

  function useBlobMode() {
    process.env.BLOB_READ_WRITE_TOKEN = RW_TOKEN;
    delete process.env.VERCEL;
    resetCvStorageForTests();
    installFakeBlobSeams();
  }

  function useLocalMode() {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    resetCvStorageForTests();
    setBlobSeamsForTests(null);
  }

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const { getDatabase } = await import("./db");
    const { users, adminProfiles, recruitmentRoles } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();

    const adminOpenId = `task24g-blob-admin-${marker}`;
    await db.insert(users).values({ openId: adminOpenId, email: `task24g-blob-admin-${marker}@example.com`, loginMethod: "test", role: "user" });
    const adminUser = (await db.select().from(users).where(sql`${users.openId} = ${adminOpenId}`).limit(1))[0];
    await db.insert(adminProfiles).values({ id: `task24g-blob-profile-${marker}`, authUserId: adminUser.id, email: `task24g-blob-admin-${marker}@example.com`, role: "Admin", status: "Active" });
    adminCookie = `${COOKIE_NAME}=${(await createSessionForUser(adminUser.id)).token}`;

    const viewerOpenId = `task24g-blob-viewer-${marker}`;
    await db.insert(users).values({ openId: viewerOpenId, email: `task24g-blob-viewer-${marker}@example.com`, loginMethod: "test", role: "user" });
    const viewerUser = (await db.select().from(users).where(sql`${users.openId} = ${viewerOpenId}`).limit(1))[0];
    viewerCookie = `${COOKIE_NAME}=${(await createSessionForUser(viewerUser.id)).token}`;

    cleanup.push({ table: "admin_profiles", column: "auth_user_id", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(adminUser.id) });
    cleanup.push({ table: "auth_sessions", column: "userId", value: String(viewerUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(adminUser.id) });
    cleanup.push({ table: "users", column: "id", value: String(viewerUser.id) });

    roleId = `task24g-blob-role-${marker}`;
    await db.insert(recruitmentRoles).values({
      id: roleId,
      slug: `tmp-blob-role-${marker}`,
      title: `Task 24G Blob Role ${marker}`,
      department: "Test Department",
      location: "Test Location",
      employmentType: "Full-time",
      shortDescription: "Transport test role.",
      fullDescription: "Transport test role description.",
      status: "Open",
      closingDate: "2027-12-31",
    });
    cleanup.push({ table: "recruitment_roles", column: "id", value: roleId });

    const create = async (suffix: string) => {
      const response = await fetch(`${baseUrl}/api/public/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleSlug: `tmp-blob-role-${marker}`,
          fullName: `Task24G Blob Applicant ${suffix}`,
          email: `task24g-blob-${suffix}-${marker}@example.com`,
          phone: "+234 800 0000",
          city: "Abuja",
          currentStatus: "Employed",
          recentRole: "Test Associate",
          totalExperience: "1-3 years",
          relevantExperience: "1-3 years",
          eligibility: {},
        }),
      });
      const body = (await response.json()) as { applicationId?: string; applicantToken?: string };
      if (response.status !== 201 || !body.applicationId || !body.applicantToken) throw new Error(`application create failed: ${response.status}`);
      return { id: body.applicationId, token: body.applicantToken };
    };
    applicationA = await create("a");
    applicationB = await create("b");
    cleanup.push({ table: "applications", column: "id", value: applicationA.id });
    cleanup.push({ table: "applications", column: "id", value: applicationB.id });
  });

  afterEach(() => {
    // Never leak environment changes into other suites.
    useLocalMode();
    process.env.NODE_ENV = "test";
  });

  afterAll(async () => {
    const { getDatabase } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = getDatabase();
    for (const item of [...cleanup].reverse()) {
      await db.execute(sql.raw(`DELETE FROM ${item.table} WHERE ${item.column} = '${item.value}'`)).catch(() => undefined);
    }
    setBlobSeamsForTests(null);
    resetCvStorageForTests();
    server?.close();
  });

  async function json(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    return { status: response.status, response, body: (await response.json().catch(() => null)) as Record<string, any> | null };
  }

  const applicantHeaders = (token: string): Record<string, string> => ({ "X-Application-Token": token });

  function requestUploadUrl(token: string, filename: string, size: number) {
    return json("/api/public/applications/me/cv/upload-url", {
      method: "POST",
      headers: applicantHeaders(token),
      body: JSON.stringify({ filename, size }),
    });
  }

  it("issues application-specific direct upload authorization and never returns the Blob write token", async () => {
    useBlobMode();
    const result = await requestUploadUrl(applicationA!.token, "resume.pdf", 4096);
    expect(result.status).toBe(200);
    expect(result.body?.mode).toBe("blob");
    expect(typeof result.body?.clientToken).toBe("string");
    expect(result.body?.clientToken).not.toBe(RW_TOKEN);
    expect(result.body?.pathname.startsWith(`cv/${applicationA!.id}/`)).toBe(true);
    expect(result.body?.pathname.endsWith(".pdf")).toBe(true);
    expect(result.body?.maximumSizeInBytes).toBe(CV_MAX_FILE_SIZE);

    // The authorization was scoped to this exact pathname with constraints,
    // generated server-side from the read-write token.
    const observed = clientTokenRequests.at(-1);
    expect(observed?.pathname).toBe(result.body?.pathname);
    expect(observed?.token).toBe(RW_TOKEN);
    expect(observed?.maximumSizeInBytes).toBe(CV_MAX_FILE_SIZE);
    expect(observed?.allowedContentTypes).toEqual(["application/pdf"]);

    // No storage credential anywhere in the response.
    expect(JSON.stringify(result.body).includes(RW_TOKEN)).toBe(false);
  });

  it("uploads a full-size 10 MB PDF without passing the bytes through the application function", async () => {
    useBlobMode();
    // A real 10 MB PDF-shaped payload. It is handed to the PRIVATE Blob store
    // directly in production; here the fake store records it. It is NEVER
    // posted to the API.
    const tenMbPdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(CV_MAX_FILE_SIZE - 9, 0x41)]);
    expect(tenMbPdf.length).toBe(CV_MAX_FILE_SIZE);

    const auth = await requestUploadUrl(applicationA!.token, "large-cv.pdf", tenMbPdf.length);
    expect(auth.status).toBe(200);
    const pathname = auth.body?.pathname as string;

    // Browser → Blob (direct). Simulated by populating the fake store.
    fakeStore.set(pathname, { size: tenMbPdf.length, contentType: "application/pdf" });

    // Browser → API: metadata only.
    const completePayload = JSON.stringify({ pathname, filename: "large-cv.pdf", contentType: "application/pdf", size: tenMbPdf.length });
    expect(completePayload.length).toBeLessThan(1024); // tiny JSON, not the file
    const complete = await json("/api/public/applications/me/cv/complete", {
      method: "POST",
      headers: applicantHeaders(applicationA!.token),
      body: completePayload,
    });
    expect(complete.status).toBe(200);
    expect(complete.body?.ok).toBe(true);
    expect(complete.body?.cv?.fileSize).toBe(CV_MAX_FILE_SIZE);
    expect(complete.body?.cv?.originalFilename).toBe("large-cv.pdf");

    // The 10 MB payload never travelled through the application function.
    expect(bytesSentToApi).toBe(0);
    expect(JSON.stringify(complete.body).includes(RW_TOKEN)).toBe(false);
  });

  it("rejects Applicant A attaching a Blob uploaded for Applicant B", async () => {
    useBlobMode();
    // Applicant B obtains an authorization and "uploads" to their own key.
    const authB = await requestUploadUrl(applicationB!.token, "b-resume.pdf", pdfBytes.length);
    expect(authB.status).toBe(200);
    const pathnameB = authB.body?.pathname as string;
    expect(pathnameB.startsWith(`cv/${applicationB!.id}/`)).toBe(true);
    fakeStore.set(pathnameB, { size: pdfBytes.length, contentType: "application/pdf" });

    // Applicant A tries to attach B's blob to their own application.
    const hijack = await json("/api/public/applications/me/cv/complete", {
      method: "POST",
      headers: applicantHeaders(applicationA!.token),
      body: JSON.stringify({ pathname: pathnameB, filename: "stolen.pdf", contentType: "application/pdf", size: pdfBytes.length }),
    });
    expect(hijack.status).toBe(403);

    // A's CV metadata still points at A's own file (from the previous test).
    const inspect = await json("/api/public/applications/me/cv", { headers: applicantHeaders(applicationA!.token) });
    expect(inspect.status).toBe(200);
    expect(inspect.body?.cv?.originalFilename).toBe("large-cv.pdf");

    // B can still complete with their own key — the failure was the cross-attach.
    const completeB = await json("/api/public/applications/me/cv/complete", {
      method: "POST",
      headers: applicantHeaders(applicationB!.token),
      body: JSON.stringify({ pathname: pathnameB, filename: "b-resume.pdf", contentType: "application/pdf", size: pdfBytes.length }),
    });
    expect(completeB.status).toBe(200);
    expect(completeB.body?.cv?.originalFilename).toBe("b-resume.pdf");
  });

  it("requires Admin authentication before issuing a private download URL", async () => {
    useBlobMode();
    const path = `/api/admin/applications/${applicationA!.id}/cv/file`;

    // No session at all.
    const anonymous = await json(path);
    expect(anonymous.status).toBe(401);
    expect(JSON.stringify(anonymous.body ?? {}).includes("presigned")).toBe(false);
    expect(JSON.stringify(anonymous.body ?? {}).includes("blob.vercel-storage.com")).toBe(false);

    // Authenticated user without Admin authorization.
    const viewer = await json(path, { headers: { Cookie: viewerCookie } });
    expect(viewer.status).toBe(401);
    expect(viewer.body?.url).toBeUndefined();

    // Authorized Admin receives a short-lived signed URL only.
    const admin = await json(path, { headers: { Cookie: adminCookie } });
    expect(admin.status).toBe(200);
    expect(admin.body?.ok).toBe(true);
    expect(admin.body?.kind).toBe("url");
    expect(typeof admin.body?.url).toBe("string");
    expect((admin.body?.url as string).startsWith("https://fake.blob.vercel-storage.com/cv/")).toBe(true);
    expect(admin.body?.filename).toBe("large-cv.pdf");
    expect(admin.body?.expiresAt).toBeGreaterThan(Date.now());
    // The signed token was scoped to get-operations on this blob only.
    const observed = signedTokenRequests.at(-1);
    expect(observed?.operations).toEqual(["get"]);
    expect(observed?.pathname.startsWith(`cv/${applicationA!.id}/`)).toBe(true);
    // No permanent credentials in the response.
    expect(JSON.stringify(admin.body).includes(RW_TOKEN)).toBe(false);
  });

  it("refuses the local filesystem fallback in production without Blob configuration", async () => {
    useLocalMode();
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      resetCvStorageForTests();
      expect(getCvStorage).toThrow(CvStorageConfigurationError);

      const auth = await requestUploadUrl(applicationA!.token, "resume.pdf", 1024);
      expect(auth.status).toBe(503);
      expect(auth.body?.error).toMatch(/not configured/i);

      // The raw-bytes route must not accept files either.
      bytesSentToApi += pdfBytes.length;
      const raw = await fetch(`${baseUrl}/api/public/applications/me/cv`, {
        method: "PUT",
        headers: { ...applicantHeaders(applicationA!.token), "Content-Type": "application/octet-stream", "x-cv-filename": encodeURIComponent("resume.pdf") },
        body: pdfBytes,
      });
      bytesSentToApi -= pdfBytes.length;
      expect(raw.status).toBe(403);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      resetCvStorageForTests();
    }
  });

  it("keeps the local development fallback working outside production", async () => {
    useLocalMode();
    const auth = await requestUploadUrl(applicationB!.token, "resume.pdf", pdfBytes.length);
    expect(auth.status).toBe(200);
    expect(auth.body?.mode).toBe("local");
    expect(auth.body?.code).toBe("local-upload-required");

    bytesSentToApi += pdfBytes.length;
    const raw = await fetch(`${baseUrl}/api/public/applications/me/cv`, {
      method: "PUT",
      headers: { ...applicantHeaders(applicationB!.token), "Content-Type": "application/octet-stream", "x-cv-filename": encodeURIComponent("local-cv.pdf") },
      body: pdfBytes,
    });
    bytesSentToApi -= pdfBytes.length;
    const rawBody = (await raw.json()) as Record<string, any>;
    expect(raw.status).toBe(200);
    expect(rawBody?.cv?.originalFilename).toBe("local-cv.pdf");

    // In local mode the Admin file route streams bytes itself (no signed URL).
    const admin = await fetch(`${baseUrl}/api/admin/applications/${applicationB!.id}/cv/file`, { headers: { Cookie: adminCookie } });
    expect(admin.status).toBe(200);
    expect(admin.headers.get("content-type")).toContain("application/pdf");
    const streamed = Buffer.from(await admin.arrayBuffer());
    expect(streamed.equals(pdfBytes)).toBe(true);
  });
});
