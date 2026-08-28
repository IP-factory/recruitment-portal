/**
 * Vercel Function adapter.
 *
 * Vercel treats any file under /api as a Node.js Function. Exporting an
 * Express app as the default export is the officially supported pattern for
 * running Express on Vercel.
 *
 * This file is intentionally minimal — all routes, middleware and business
 * logic live in server/app.ts. This is only the deployment seam.
 *
 * dotenv is NOT loaded here: on Vercel, environment variables are injected
 * directly into process.env by the platform. No DATABASE_URL or other secret
 * is ever exposed to client/Vite code.
 */
import app from "../server/app";

export default app;
