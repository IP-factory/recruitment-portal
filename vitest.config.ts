import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Load root .env so process.env.DATABASE_URL is available to database
// integration tests (e.g. server/task24a.database.test.ts and
// server/task24b.auth.test.ts). Tests that require a live DB use
// describe.skipIf(!databaseUrl) and are silently skipped when absent.
loadDotenv();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "server/**/*.test.ts"],
    // Remote database integration tests need headroom for network latency.
    testTimeout: 20000,
    // Database suites share one remote TiDB instance; running files in
    // parallel intermittently exceeds its connection budget, so serialize.
    fileParallelism: false,
  },
});
