/**
 * Express application factory.
 *
 * This module creates and configures the Express app — middleware, all API
 * routers — and exports it as the default export so it can be consumed by:
 *
 *   server/index.ts  → local development listener (app.listen)
 *   api/index.ts     → Vercel Function adapter (export default app)
 *
 * It does NOT call app.listen() or load dotenv. Both of those belong in the
 * consumer. It also does NOT mount express.static() or the SPA catch-all:
 * on Vercel, static assets are served by Vercel's CDN from the build output
 * directory; on local dev, Vite serves the frontend directly.
 */
import mysql from "mysql2/promise";
import express from "express";
import { createAdminAuthRouter } from "./adminAuth";
import { createAdminApplicationApiRouter } from "./adminApplicationApi";
import { createApplicationApiRouter } from "./applicationApi";
import { createAssessmentApiRouter } from "./assessmentApi";
import { createQuestionBankApiRouter } from "./questionBankApi";
import { createRecruitmentApiRouter } from "./recruitmentApi";

const app = express();

// ── Reverse proxy trust ──────────────────────────────────────────────────────
// When served behind a TLS-terminating reverse proxy (production HTTPS), the
// Secure cookie flag requires Express to trust the proxy-reported protocol
// (X-Forwarded-Proto). TRUST_PROXY=1 trusts the first proxy hop. Leave unset
// in local HTTP development so cookies are not marked Secure unnecessarily.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}
// ── Middleware ────────────────────────────────────────────────────────────────
// 100 KB JSON body limit — sufficient for OPEN review notes, eligibility
// payloads, and admin mutations. CV/file upload is out of MVP scope; when
// that arrives, a multipart parser with a separate per-route limit is needed.
app.use(express.json({ limit: "100kb" }));

// ── API routers ───────────────────────────────────────────────────────────────

// Admin authentication / authorization API (Task 24B): session, sign-in,
// sign-out, and the native Manus OAuth callback.
app.use(createAdminAuthRouter());

// Recruitment Role / Eligibility / Evaluation Framework API (Task 24C-1):
// public applicant-safe endpoints plus Admin endpoints guarded by Task 24B.
app.use(createRecruitmentApiRouter());

// Admin Question Bank API (Task 24C-2): list, detail, create and update,
// all guarded by Task 24B authorization. No public question endpoints.
app.use(createQuestionBankApiRouter());

// Admin Assessment API (Task 24C-3): assessment list, detail, create, update,
// assignment management, and admin preview. All guarded by Task 24B auth.
app.use(createAssessmentApiRouter());

// Public Applicant Runtime API (Task 24D-1): application creation,
// server-side eligibility, assessment responses, completion and submission.
// Uses applicant token, not Admin authorization.
app.use(createApplicationApiRouter());

// Admin Application & Scoring API (Task 24D-2): real applications list,
// candidate detail, OPEN review, integrity flags, bonuses, shortlisting,
// and application status management. Requires Task 24B Admin authorization.
app.use(createAdminApplicationApiRouter());

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * GET /api/health/database
 *
 * Verifies the database is reachable by executing SELECT 1.
 * Returns { ok: true, database: "connected" } on success.
 * Returns { ok: false, database: "unreachable" } on failure.
 *
 * Never exposes credentials, host names, or stack traces in the response.
 */
app.get("/api/health/database", async (_req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    res.status(503).json({ ok: false, database: "unreachable", reason: "DATABASE_URL is not configured" });
    return;
  }

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection(url);
    await connection.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error("[health] database connectivity check failed:", err instanceof Error ? err.message : String(err));
    res.status(503).json({ ok: false, database: "unreachable" });
  } finally {
    await connection?.end().catch(() => undefined);
  }
});

export default app;
