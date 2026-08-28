// Load .env before anything else so process.env.DATABASE_URL is available
// to server/db.ts and all route handlers.
import "dotenv/config";

import express from "express";
import { createServer } from "http";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import { createAdminAuthRouter } from "./adminAuth";
import { createQuestionBankApiRouter } from "./questionBankApi";
import { createRecruitmentApiRouter } from "./recruitmentApi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── 1. Body parsing middleware ────────────────────────────────────────────
  app.use(express.json());

  // Admin authentication / authorization API (Task 24B): session, sign-in,
  // sign-out, and the native Manus OAuth callback.
  app.use(createAdminAuthRouter());

  // Recruitment Role / Eligibility / Evaluation Framework API (Task 24C-1):
  // public applicant-safe endpoints plus Admin endpoints guarded by Task 24B.
  app.use(createRecruitmentApiRouter());

  // Admin Question Bank API (Task 24C-2): list, detail, create and update,
  // all guarded by Task 24B authorization. No public question endpoints.
  app.use(createQuestionBankApiRouter());

  // ── 2. API routes (must come before the static / catch-all) ──────────────

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
      // Log server-side only — never send credentials or stack traces to the client
      console.error("[health] database connectivity check failed:", err instanceof Error ? err.message : String(err));
      res.status(503).json({ ok: false, database: "unreachable" });
    } finally {
      await connection?.end().catch(() => undefined);
    }
  });

  // ── 3. Static frontend assets ─────────────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // ── 4. React client-side-routing catch-all (must remain last) ────────────
  // Protected Admin shells are never cacheable so a signed-out session cannot
  // restore usable protected content via the browser Back button.
  app.get("/admin*", (_req, _res, next) => {
    _res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // ── 5. Start listening ───────────────────────────────────────────────────
  // Default to 3100 in development so Vite (3000) can proxy /api/* here.
  // PORT env var overrides for production deployments.
  const port = process.env.PORT || 3100;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
