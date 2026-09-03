/**
 * Cleanup utility for synthetic CSV-import test records that were left in the
 * live TiDB workspace by previous test runs.
 *
 * Targets ONLY records whose id or slug matches the patterns created by
 * csvImportApi.test.ts — specifically roles whose id starts with one of:
 *
 *   csv-preview-    csv-import-    csv-scope-    csv-rollback-
 *   csv-equiv-      csv-regress-   csv-nofw-
 *
 * All associated data cascades automatically via FK ON DELETE CASCADE:
 *   assessment_question_assignments → assessments → recruitment_roles
 *   assessment_questions   (deleted separately by reference pattern)
 *   eligibility_gates      (cascade from role)
 *   assessment_dimensions  (cascade from role)
 *
 * NEVER touches:
 *   - Business Development Officer (role-business-development-officer)
 *   - Any role whose id does not start with a csv-* test prefix
 *   - Any real applicant records, applications or CVs
 *
 * Usage
 * ─────
 *   Dry run (default — reports what WOULD be deleted, touches nothing):
 *     npx tsx scripts/cleanup-synthetic-csv-test-data.ts
 *
 *   Apply (actually deletes — requires explicit flag):
 *     npx tsx scripts/cleanup-synthetic-csv-test-data.ts --apply
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");

const SYNTHETIC_PREFIXES = [
  "csv-preview-",
  "csv-import-",
  "csv-scope-",
  "csv-rollback-",
  "csv-equiv-",
  "csv-regress-",
  "csv-nofw-",
  "tmp-assessment-",
  "tmp-q-",
];

const PROTECTED_ROLE_IDS = [
  "role-business-development-officer",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌  DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Synthetic CSV test data cleanup`);
  console.log(`  Mode: ${APPLY ? "⚠️  APPLY (will delete)" : "DRY RUN (read-only)"}`);
  console.log(`${"─".repeat(60)}\n`);

  // ── Collect synthetic roles ───────────────────────────────────────────────

  const [roleRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, slug, title FROM recruitment_roles ORDER BY id",
  );

  const syntheticRoles = roleRows.filter((r) => {
    if (PROTECTED_ROLE_IDS.includes(r.id)) return false;
    return SYNTHETIC_PREFIXES.some((prefix) => String(r.id).startsWith(prefix));
  });

  if (syntheticRoles.length === 0) {
    console.log("✅  No synthetic csv-* roles found. Nothing to delete.\n");
    await conn.end();
    return;
  }

  console.log(`Found ${syntheticRoles.length} synthetic role(s):\n`);
  for (const role of syntheticRoles) {
    console.log(`  ${role.id} | ${role.slug} | ${role.title}`);
  }

  // ── Associated questions ──────────────────────────────────────────────────

  const [questionRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, reference FROM assessment_questions WHERE reference NOT LIKE 'D%.Q%' AND reference NOT LIKE 'EXAMPLE%' ORDER BY reference",
  );

  const syntheticQuestions = questionRows.filter((q) =>
    SYNTHETIC_PREFIXES.some((prefix) => String(q.reference).includes(prefix.replace("-", "").slice(0, 6)))
    || /^[A-F0-9]{8,}\./.test(String(q.reference))
    || /^[A-Z0-9]{6,}\.D[0-9]\.Q/.test(String(q.reference)),
  );

  if (syntheticQuestions.length > 0) {
    console.log(`\nFound ${syntheticQuestions.length} synthetic question(s):\n`);
    for (const q of syntheticQuestions) {
      console.log(`  ${q.id} | ${q.reference}`);
    }
  } else {
    console.log("\n✅  No synthetic questions found.");
  }

  // ── Temporary assessments (tmp-assessment-*) ──────────────────────────────

  const [tempAssessmentRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, slug, name FROM assessments WHERE id LIKE 'tmp-assessment-%' OR slug LIKE 'tmp-%' ORDER BY id",
  );

  if (tempAssessmentRows.length > 0) {
    console.log(`\nFound ${tempAssessmentRows.length} temporary assessment(s):\n`);
    for (const a of tempAssessmentRows) {
      console.log(`  ${a.id} | ${a.slug} | ${a.name}`);
    }
  }

  console.log(`\n${"─".repeat(60)}`);

  if (!APPLY) {
    console.log(`\n⚠️  DRY RUN — nothing was deleted.`);
    console.log(`   To apply, run:\n`);
    console.log(`     npx tsx scripts/cleanup-synthetic-csv-test-data.ts --apply\n`);
    await conn.end();
    return;
  }

  // ── Apply deletions ───────────────────────────────────────────────────────

  console.log("\n🗑   Deleting…\n");

  // 1. Orphaned synthetic questions (no role cascade needed)
  if (syntheticQuestions.length > 0) {
    const ids = syntheticQuestions.map((q) => q.id);
    const placeholders = ids.map(() => "?").join(", ");
    await conn.execute(`DELETE FROM assessment_questions WHERE id IN (${placeholders})`, ids);
    console.log(`  Deleted ${syntheticQuestions.length} synthetic question(s).`);
  }

  // 2. Temporary assessments (cascade deletes assignments)
  if (tempAssessmentRows.length > 0) {
    await conn.execute("DELETE FROM assessments WHERE id LIKE 'tmp-assessment-%' OR slug LIKE 'tmp-%'");
    console.log(`  Deleted ${tempAssessmentRows.length} temporary assessment(s).`);
  }

  // 3. Synthetic roles (cascade deletes gates, dimensions, assessments, assignments)
  if (syntheticRoles.length > 0) {
    const ids = syntheticRoles.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(", ");
    await conn.execute(`DELETE FROM recruitment_roles WHERE id IN (${placeholders})`, ids);
    console.log(`  Deleted ${syntheticRoles.length} synthetic role(s) and all cascaded data.`);
  }

  console.log(`\n✅  Cleanup complete.\n`);
  await conn.end();
}

main().catch((error) => {
  console.error("❌  Cleanup failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
