/**
 * Local development entry point.
 *
 * Loads .env, imports the shared Express app from server/app.ts, serves the
 * Vite-built static frontend, and starts listening on PORT (default 3100).
 *
 * On Vercel this file is NOT used — api/index.ts is the Vercel Function
 * adapter and Vercel's CDN serves the Vite build directly.
 */
import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Static frontend (local dev / self-hosted production only) ─────────────────
// On Vercel this block never executes — this file is not the Vercel Function
// entrypoint. Vercel serves dist/public from its CDN instead.
// In local development NODE_ENV is undefined/development.
// In a self-hosted production deployment it is "production".
const staticPath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public")
    : path.resolve(__dirname, "..", "dist", "public");

app.use(express.static(staticPath));

// React client-side-routing catch-all (must remain last).
// Protected Admin shells are never cacheable so a signed-out session cannot
// restore usable protected content via the browser Back button.
app.get("/admin*", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

// ── Listener ──────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3100);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/`);
});
