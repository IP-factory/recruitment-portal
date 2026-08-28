/**
 * Task 24B — server Admin authentication tests.
 *
 * Pure coverage for password hashing, session cookies, OAuth state, and the
 * session payload contract; live-database coverage (skipped without
 * DATABASE_URL) verifies the authorization schema: unique auth_user_id,
 * password-free admin_profiles, and scrypt credential round-trips.
 */
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildSessionPayload, decodeOAuthState, encodeOAuthState, hashPassword, hashSessionToken, parseCookies, resolveSafeAdminTarget, serializeSessionCookie, serializeSignOutCookie, verifyPassword } from "./adminAuth";
import { COOKIE_NAME } from "../shared/const";

describe("password hashing", () => {
  it("verifies correct passwords and rejects incorrect ones", () => {
    const stored = hashPassword("a-very-strong-operator-password");
    expect(verifyPassword("a-very-strong-operator-password", stored)).toBe(true);
    expect(verifyPassword("a-very-strong-operator-password!", stored)).toBe(false);
    expect(verifyPassword("123456", stored)).toBe(false);
  });

  it("stores salted hashes only — never the plaintext password", () => {
    const password = "never-store-me-in-plain-text";
    const stored = hashPassword(password);
    expect(stored).not.toContain(password);
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(hashPassword(password)).not.toBe(stored); // unique salt per hash
  });

  it("rejects malformed or absent stored hashes safely", () => {
    expect(verifyPassword("anything", null)).toBe(false);
    expect(verifyPassword("anything", undefined)).toBe(false);
    expect(verifyPassword("anything", "garbage")).toBe(false);
    expect(verifyPassword("anything", "scrypt:not:enough:parts")).toBe(false);
  });
});

describe("session tokens and cookies", () => {
  it("hashes session tokens deterministically and never stores the raw token", () => {
    const token = "a".repeat(64);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken("b".repeat(64))).not.toBe(hashSessionToken(token));
  });

  it("issues an HttpOnly same-site session cookie with the native cookie name", () => {
    const cookie = serializeSessionCookie("token-value");
    expect(cookie).toContain(`${COOKIE_NAME}=token-value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it("sign-out cookie expires the session cookie", () => {
    expect(serializeSignOutCookie()).toContain(`${COOKIE_NAME}=`);
    expect(serializeSignOutCookie()).toContain("Max-Age=0");
  });

  it("parses request cookie headers", () => {
    expect(parseCookies(`${COOKIE_NAME}=abc123; other=1`)[COOKIE_NAME]).toBe("abc123");
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe("post-authentication redirect safety", () => {
  it("keeps redirects inside the Admin area", () => {
    expect(resolveSafeAdminTarget("/admin/questions")).toBe("/admin/questions");
    expect(resolveSafeAdminTarget("/admin")).toBe("/admin");
    expect(resolveSafeAdminTarget("/admin/login")).toBe("/admin");
    expect(resolveSafeAdminTarget("//evil.example")).toBe("/admin");
    expect(resolveSafeAdminTarget("https://evil.example/admin")).toBe("/admin");
    expect(resolveSafeAdminTarget("/apply")).toBe("/admin");
    expect(resolveSafeAdminTarget(undefined)).toBe("/admin");
  });
});

describe("native OAuth state", () => {
  it("round-trips redirect URI and Admin return target", () => {
    const state = encodeOAuthState({ redirectUri: "https://example.com/api/oauth/callback", next: "/admin/screening" });
    expect(decodeOAuthState(state)).toEqual({ redirectUri: "https://example.com/api/oauth/callback", next: "/admin/screening" });
    expect(decodeOAuthState("not-base64-json")).toBeNull();
    expect(decodeOAuthState(undefined)).toBeNull();
  });
});

describe("session payload contract", () => {
  const user = { id: 3, email: "admin@example.com", name: "Admin" };
  const profile = { id: "admin-profile-x", email: "admin@example.com", fullName: null, role: "Admin", status: "Active" };

  it("exposes identity only when authenticated, authorization only when all conditions hold", () => {
    expect(buildSessionPayload(null, profile)).toEqual({ authenticated: false, authorized: false, user: null, profile: null });
    expect(buildSessionPayload(user, null)).toEqual({ authenticated: true, authorized: false, user, profile: null });
    expect(buildSessionPayload(user, { ...profile, status: "Inactive" })).toMatchObject({ authenticated: true, authorized: false });
    expect(buildSessionPayload(user, profile)).toEqual({ authenticated: true, authorized: true, user, profile });
  });

  it("never includes credential material in the payload", () => {
    expect(JSON.stringify(buildSessionPayload(user, profile))).not.toMatch(/password/i);
  });
});

// ── Live database integration (skipped without DATABASE_URL) ─────────────────

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("Task 24B authorization schema", () => {
  const connection = databaseUrl ? mysql.createPool(databaseUrl) : null;

  afterAll(async () => {
    await connection?.end();
  });

  it("admin_profiles stores authorization metadata only — no password columns", async () => {
    const [columns] = await connection!.query<(RowDataPacket & { Field: string })[]>("SHOW COLUMNS FROM admin_profiles");
    const fields = columns.map((column) => column.Field.toLowerCase());
    expect(fields).toEqual(expect.arrayContaining(["id", "auth_user_id", "email", "full_name", "role", "status", "created_at", "updated_at"]));
    expect(fields.some((field) => field.includes("password") || field.includes("secret") || field.includes("hash"))).toBe(false);
  });

  it("each auth account may have at most one Admin profile (unique auth_user_id)", async () => {
    const marker = randomBytes(8).toString("hex");
    const openId = `task24b-test-${marker}`;
    const email = `task24b-test-${marker}@example.com`;
    const [userResult] = await connection!.query("INSERT INTO users (openId, email, loginMethod, role) VALUES (?, ?, 'test', 'user')", [openId, email]);
    const userId = (userResult as { insertId: number }).insertId;
    try {
      await connection!.query("INSERT INTO admin_profiles (id, auth_user_id, email, role, status) VALUES (?, ?, ?, 'Admin', 'Active')", [`task24b-profile-${marker}`, userId, email]);
      await expect(
        connection!.query("INSERT INTO admin_profiles (id, auth_user_id, email, role, status) VALUES (?, ?, ?, 'Admin', 'Active')", [`task24b-profile-dup-${marker}`, userId, email]),
      ).rejects.toThrow(/Duplicate/i);
    } finally {
      await connection!.query("DELETE FROM users WHERE id = ?", [userId]);
    }
    const [remaining] = await connection!.query<(RowDataPacket & { n: number })[]>("SELECT COUNT(*) AS n FROM admin_profiles WHERE auth_user_id = ?", [userId]);
    expect(remaining[0].n).toBe(0); // cascade removed the profile
  });

  it("supports the full credential lifecycle without exposing plaintext", async () => {
    const marker = randomBytes(8).toString("hex");
    const openId = `credential:task24b-${marker}@example.com`;
    const password = `task-24b-credential-${marker}`;
    const storedHash = hashPassword(password);
    const [userResult] = await connection!.query("INSERT INTO users (openId, email, loginMethod, role, password_hash) VALUES (?, ?, 'credential', 'user', ?)", [openId, `task24b-${marker}@example.com`, storedHash]);
    const userId = (userResult as { insertId: number }).insertId;
    try {
      const [rows] = await connection!.query<(RowDataPacket & { password_hash: string })[]>("SELECT password_hash FROM users WHERE id = ?", [userId]);
      expect(rows[0].password_hash).not.toContain(password);
      expect(verifyPassword(password, rows[0].password_hash)).toBe(true);
      expect(verifyPassword("123456", rows[0].password_hash)).toBe(false);
    } finally {
      await connection!.query("DELETE FROM users WHERE id = ?", [userId]);
    }
  });
});
