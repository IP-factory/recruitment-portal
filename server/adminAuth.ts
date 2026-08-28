/**
 * Task 24B — real Admin authentication and authorization for the server.
 *
 * Session contract (native Manus session mechanism):
 * - Credentials are verified server-side only; passwords are stored as salted
 *   scrypt hashes in the native `users` table. No plaintext password ever
 *   appears in source, seed files, client bundles, logs, or profile tables.
 * - Successful authentication issues an opaque random session token. Only its
 *   SHA-256 hash is persisted in `auth_sessions`; the token itself lives in an
 *   HttpOnly `app_session_id` cookie, so a browser refresh keeps the session
 *   while localStorage is never the source of truth.
 * - Authentication alone never grants Admin access: `/admin` additionally
 *   requires an Active `admin_profiles` row with the Admin role, keyed by a
 *   unique `auth_user_id` relationship to the auth user.
 * - The native Manus OAuth scaffold (getLoginUrl / /api/oauth/callback) is
 *   wired into the same session mechanism for SSO-provisioned accounts.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import express, { type Request, type Response, type Router } from "express";
import { adminProfiles, authSessions, users } from "../drizzle/schema";
import { evaluateAdminAuthorization, type AdminProfileSummary, type AdminSessionPayload, type AdminSessionUser } from "../shared/adminAuth";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getDatabase } from "./db";

// ── Password hashing (salted scrypt; never plaintext, never reversible) ─────

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
// Precomputed dummy hash keeps sign-in timing consistent when the email is unknown.
const DUMMY_PASSWORD_HASH = hashPassword("task-24b-timing-equalizer");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS).toString("hex");
  return `scrypt:${SCRYPT_OPTIONS.N}:${SCRYPT_OPTIONS.r}:${SCRYPT_OPTIONS.p}:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  const [, n, r, p, salt, expected] = parts;
  try {
    const derived = scryptSync(password, salt, Buffer.from(expected, "hex").length, { N: Number(n), r: Number(r), p: Number(p) });
    return timingSafeEqual(derived, Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ── Session tokens and cookies ────────────────────────────────────────────────

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeSessionCookie(token: string): string {
  const parts = [`${COOKIE_NAME}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(ONE_YEAR_MS / 1000)}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function serializeSignOutCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const piece of header.split(";")) {
    const separator = piece.indexOf("=");
    if (separator === -1) continue;
    const key = piece.slice(0, separator).trim();
    const value = piece.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function readSessionToken(request: Request): string | null {
  const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
  return token && token.length > 0 ? token : null;
}

/** Redirect targets after authentication must stay inside the Admin area. */
export function resolveSafeAdminTarget(candidate: unknown): string {
  if (typeof candidate !== "string") return "/admin";
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/admin") || trimmed.startsWith("//") || trimmed.includes("\\")) return "/admin";
  if (trimmed === "/admin/login" || trimmed.startsWith("/admin/login?") || trimmed.startsWith("/admin/login/")) return "/admin";
  const rest = trimmed.slice("/admin".length);
  if (rest !== "" && !rest.startsWith("/")) return "/admin";
  return trimmed;
}

// ── OAuth state for the native Manus authentication scaffold ─────────────────

export interface OAuthStatePayload {
  redirectUri: string;
  next?: string;
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (typeof parsed.redirectUri !== "string") return null;
    return { redirectUri: parsed.redirectUri, next: typeof parsed.next === "string" ? parsed.next : undefined };
  } catch {
    return null;
  }
}

// ── Database-backed session and profile resolution ───────────────────────────

interface ResolvedSession {
  user: { id: number; email: string | null; name: string | null };
  sessionId: string;
}

export async function createSessionForUser(userId: number): Promise<{ token: string }> {
  const db = getDatabase();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
  await db.insert(authSessions).values({ id: `session-${randomBytes(12).toString("hex")}`, userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token };
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const db = getDatabase();
  const rows = await db
    .select({ sessionId: authSessions.id, expiresAt: authSessions.expiresAt, userId: users.id, email: users.email, name: users.name })
    .from(authSessions)
    .innerJoin(users, sql`${authSessions.userId} = ${users.id}`)
    .where(sql`${authSessions.tokenHash} = ${hashSessionToken(token)}`)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await db.delete(authSessions).where(sql`${authSessions.id} = ${row.sessionId}`).catch(() => undefined);
    return null;
  }
  return { user: { id: row.userId, email: row.email, name: row.name }, sessionId: row.sessionId };
}

export async function revokeSession(token: string): Promise<void> {
  const db = getDatabase();
  await db.delete(authSessions).where(sql`${authSessions.tokenHash} = ${hashSessionToken(token)}`);
}

export async function findAdminProfileForUser(userId: number) {
  const db = getDatabase();
  return (await db.select().from(adminProfiles).where(sql`${adminProfiles.authUserId} = ${userId}`).limit(1))[0] ?? null;
}

export async function findUserByLowerEmail(email: string) {
  const db = getDatabase();
  return (await db.select().from(users).where(sql`LOWER(${users.email}) = ${email.trim().toLowerCase()}`).limit(1))[0] ?? null;
}

export function buildSessionPayload(user: ResolvedSession["user"] | null, profile: { id: string; email: string; fullName: string | null; role: string; status: string } | null): AdminSessionPayload {
  const outcome = evaluateAdminAuthorization(user, profile);
  const authorized = outcome === "authorized";
  const userSummary: AdminSessionUser | null = user ? { id: user.id, email: user.email, name: user.name } : null;
  const profileSummary: AdminProfileSummary | null =
    user && profile && profile.role === "Admin"
      ? { id: profile.id, email: profile.email, fullName: profile.fullName, role: "Admin", status: profile.status as AdminProfileSummary["status"] }
      : null;
  return { authenticated: Boolean(user), authorized, user: userSummary, profile: profileSummary };
}

// ── Native Manus OAuth callback (SSO accounts share the same session model) ──

interface OAuthTokenResponse {
  openId?: string;
  sub?: string;
  email?: string;
  name?: string;
  loginMethod?: string;
}

async function exchangeOAuthCode(code: string): Promise<OAuthTokenResponse | null> {
  const portalUrl = (process.env.OAUTH_PORTAL_URL || process.env.VITE_OAUTH_PORTAL_URL || "").replace(/\/+$/, "");
  const appId = process.env.APP_ID || process.env.VITE_APP_ID;
  if (!portalUrl || !appId) return null;
  const tokenUrl = process.env.OAUTH_TOKEN_URL || `${portalUrl}/token`;
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, appSecret: process.env.OAUTH_CLIENT_SECRET, code }),
    });
    if (!response.ok) return null;
    return (await response.json()) as OAuthTokenResponse;
  } catch (error) {
    console.error("[auth] native OAuth token exchange failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// ── Express router ───────────────────────────────────────────────────────────

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function createAdminAuthRouter(): Router {
  const router = express.Router();

  router.get("/api/admin/session", async (request: Request, response: Response) => {
    if (!databaseConfigured()) {
      response.status(503).json({ ok: false });
      return;
    }
    const token = readSessionToken(request);
    if (!token) {
      response.json({ authenticated: false, authorized: false, user: null, profile: null } satisfies AdminSessionPayload);
      return;
    }
    try {
      const session = await resolveSession(token);
      if (!session) {
        response.setHeader("Set-Cookie", serializeSignOutCookie());
        response.json({ authenticated: false, authorized: false, user: null, profile: null } satisfies AdminSessionPayload);
        return;
      }
      const profile = await findAdminProfileForUser(session.user.id);
      response.json(buildSessionPayload(session.user, profile));
    } catch (error) {
      console.error("[auth] session resolution failed:", error instanceof Error ? error.message : String(error));
      response.status(503).json({ ok: false });
    }
  });

  router.post("/api/admin/auth/sign-in", async (request: Request, response: Response) => {
    if (!databaseConfigured()) {
      response.status(503).json({ ok: false });
      return;
    }
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!email || !password) {
      response.status(401).json({ ok: false });
      return;
    }
    try {
      const user = await findUserByLowerEmail(email);
      const valid = verifyPassword(password, user?.passwordHash ?? null);
      if (!user || !valid) {
        response.status(401).json({ ok: false });
        return;
      }
      const db = getDatabase();
      await db.update(users).set({ lastSignedIn: new Date() }).where(sql`${users.id} = ${user.id}`);
      const { token } = await createSessionForUser(user.id);
      response.setHeader("Set-Cookie", serializeSessionCookie(token));
      const profile = await findAdminProfileForUser(user.id);
      response.json({ ok: true, session: buildSessionPayload({ id: user.id, email: user.email, name: user.name }, profile) });
    } catch (error) {
      console.error("[auth] sign-in failed:", error instanceof Error ? error.message : String(error));
      response.status(503).json({ ok: false });
    }
  });

  router.post("/api/admin/auth/sign-out", async (request: Request, response: Response) => {
    const token = readSessionToken(request);
    if (token && databaseConfigured()) {
      await revokeSession(token).catch((error) => console.error("[auth] sign-out revoke failed:", error instanceof Error ? error.message : String(error)));
    }
    response.setHeader("Set-Cookie", serializeSignOutCookie());
    response.json({ ok: true });
  });

  /**
   * Native Manus OAuth callback: completes SSO sign-in for accounts
   * provisioned through the platform. Authorization still requires an Active
   * Admin profile — SSO authentication alone never grants Admin access.
   */
  router.get("/api/oauth/callback", async (request: Request, response: Response) => {
    const loginTarget = "/admin/login?authError=1";
    const state = decodeOAuthState(typeof request.query.state === "string" ? request.query.state : undefined);
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const origin = `${request.protocol}://${request.get("host")}`;
    if (!state || !code || state.redirectUri !== `${origin}/api/oauth/callback` || !databaseConfigured()) {
      response.redirect(loginTarget);
      return;
    }
    try {
      const tokenResponse = await exchangeOAuthCode(code);
      const openId = tokenResponse?.openId ?? tokenResponse?.sub;
      if (!tokenResponse || !openId) {
        response.redirect(loginTarget);
        return;
      }
      const db = getDatabase();
      const existing = (await db.select().from(users).where(sql`${users.openId} = ${openId}`).limit(1))[0];
      let userId: number;
      if (existing) {
        userId = existing.id;
        await db.update(users).set({ lastSignedIn: new Date(), name: tokenResponse.name ?? existing.name, email: tokenResponse.email ?? existing.email, loginMethod: tokenResponse.loginMethod ?? existing.loginMethod }).where(sql`${users.id} = ${existing.id}`);
      } else {
        await db.insert(users).values({ openId, name: tokenResponse.name ?? null, email: tokenResponse.email ?? null, loginMethod: tokenResponse.loginMethod ?? "oauth", role: "user" });
        userId = (await db.select().from(users).where(sql`${users.openId} = ${openId}`).limit(1))[0].id;
      }
      const { token } = await createSessionForUser(userId);
      response.setHeader("Set-Cookie", serializeSessionCookie(token));
      response.redirect(resolveSafeAdminTarget(state.next));
    } catch (error) {
      console.error("[auth] OAuth callback failed:", error instanceof Error ? error.message : String(error));
      response.redirect(loginTarget);
    }
  });

  return router;
}
