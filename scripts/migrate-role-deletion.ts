import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { asc, isNull } from "drizzle-orm";
import { recruitmentRoles } from "../drizzle/schema";

// Targeted, repeatable migration for installations with manually applied historical migrations.
// Do not replay unrelated migrations or modify recruitment records.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const migrationText = await readFile(new URL("../drizzle/migrations/0009_soft_delete_recruitment_roles.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(new URL("../drizzle/migrations/meta/_journal.json", import.meta.url), "utf8"));
  const entry = journal.entries.find((item: { tag: string }) => item.tag === "0009_soft_delete_recruitment_roles");
  if (!entry) throw new Error("Role deletion migration is missing from the journal");
  const hash = createHash("sha256").update(migrationText).digest("hex");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [columns] = await connection.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recruitment_roles' AND COLUMN_NAME = 'deleted_at'",
    );
    if (columns.length === 0) {
      await connection.query(migrationText);
      console.log("Added recruitment_roles.deleted_at.");
    } else if (columns[0].DATA_TYPE !== "timestamp" || columns[0].IS_NULLABLE !== "YES") {
      throw new Error("Existing deleted_at column has an unexpected definition; no changes were made");
    } else {
      console.log("recruitment_roles.deleted_at already exists; no schema change needed.");
    }

    // Execute the same projection and filter used to load the admin roles list.
    const roles = await drizzle(connection).select().from(recruitmentRoles)
      .where(isNull(recruitmentRoles.deletedAt)).orderBy(asc(recruitmentRoles.createdAt));
    console.log(`Verified role-list query: ${roles.length} roles load successfully.`);

    await connection.query("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)");
    const [recorded] = await connection.query<RowDataPacket[]>("SELECT id FROM __drizzle_migrations WHERE hash = ? LIMIT 1", [hash]);
    if (recorded.length === 0) {
      await connection.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [hash, entry.when]);
      console.log("Recorded migration 0009 in the migration history.");
    } else {
      console.log("Migration 0009 is already recorded.");
    }
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  // Connection errors can contain credentials or infrastructure details.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "migration failed";
  console.error(`Role deletion migration failed (${code}). Check database connectivity and schema before retrying.`);
  process.exitCode = 1;
});
