/**
 * Task 24D-3 — activate the BDO v2 assessment for production.
 *
 * Idempotent operator script that verifies all safety constraints before
 * promoting the seeded Business Development Officer Assessment v2 from
 * Draft to Active. Refuses to proceed unless every approved invariant
 * holds, and returns success without mutation when the assessment is
 * already Active and valid.
 *
 * Safety checks (all must pass before activation):
 *   1. BDO role exists and is Open
 *   2. v2 assessment exists with version = 2
 *   3. Exactly 14 assignments exist
 *   4. All 14 assigned questions exist and are Active
 *   5. Exact approved order is preserved (D1.Q1, D3.Q1, ..., D2.Q2)
 *   6. No duplicate assignments (guaranteed by unique indexes, re-verified)
 *   7. No conflicting Active assessment exists for the same role
 *
 * Usage:
 *   npx tsx scripts/activate-bdo-v2-assessment.ts
 *
 * Exit codes:
 *   0 — Active (either already active and valid, or freshly activated)
 *   1 — configuration / validation failure (no mutation performed)
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const BDO_SLUG = "business-development-officer";
const BDO_ASSESSMENT_SLUG = "business-development-officer-assessment-v2";
const BDO_ASSESSMENT_VERSION = 2;
const APPROVED_ORDER = [
  "D1.Q1", "D3.Q1", "D2.Q3", "D4.Q1", "D4.Q2", "D3.Q3", "D5.Q1",
  "D2.Q1", "D2.Q1E", "D7.Q1", "D1.Q2", "D6.Q1", "D8.Q1", "D2.Q2",
];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not available");
  process.exit(1);
}

function fail(reason: string): never {
  console.error(JSON.stringify({ ok: false, activated: false, reason }, null, 2));
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);
try {
  // 1. BDO role exists and is Open.
  const [roles] = await connection.query<Array<{ id: string; status: string; title: string }>>(
    "SELECT id, status, title FROM recruitment_roles WHERE slug = ? LIMIT 1",
    [BDO_SLUG],
  );
  if (roles.length === 0) fail("BDO role not found in recruitment_roles");
  const role = roles[0];
  if (role.status !== "Open") fail(`BDO role status is '${role.status}', expected 'Open'`);

  // 2. v2 assessment exists with version = 2.
  const [assessments] = await connection.query<Array<{
    id: string; status: string; version: number; name: string; role_id: string;
  }>>(
    "SELECT id, status, version, name, role_id FROM assessments WHERE slug = ? AND version = ? LIMIT 1",
    [BDO_ASSESSMENT_SLUG, BDO_ASSESSMENT_VERSION],
  );
  if (assessments.length === 0) fail("BDO v2 assessment not found");
  const assessment = assessments[0];
  if (assessment.role_id !== role.id) fail("BDO v2 assessment is linked to a different role");
  if (assessment.version !== BDO_ASSESSMENT_VERSION) fail("Assessment version mismatch");

  // 3. Exactly 14 assignments.
  const [assignments] = await connection.query<Array<{
    assignment_id: string; question_id: string; display_order: number; reference: string; question_status: string;
  }>>(
    `SELECT
       aqg.id AS assignment_id,
       aqg.question_id,
       aqg.display_order,
       aq.reference,
       aq.status AS question_status
     FROM assessment_question_assignments aqg
     JOIN assessment_questions aq ON aq.id = aqg.question_id
     WHERE aqg.assessment_id = ?
     ORDER BY aqg.display_order ASC`,
    [assessment.id],
  );
  if (assignments.length !== 14) fail(`Expected 14 assignments, found ${assignments.length}`);

  // 4. All assigned questions are Active.
  const inactive = assignments.filter((a) => a.question_status !== "Active");
  if (inactive.length > 0) {
    fail(`Inactive assigned questions: ${inactive.map((a) => a.reference).join(", ")}`);
  }

  // 5. Exact approved order.
  const actualOrder = assignments.map((a) => a.reference);
  if (actualOrder.length !== APPROVED_ORDER.length || !actualOrder.every((ref, idx) => ref === APPROVED_ORDER[idx])) {
    fail(`Assignment order does not match approved order. Actual: ${actualOrder.join(", ")}`);
  }

  // 6. No duplicate assignments (unique indexes enforce this; re-verify).
  const seenQuestions = new Set<string>();
  const seenOrders = new Set<number>();
  for (const a of assignments) {
    if (seenQuestions.has(a.question_id)) fail(`Duplicate question_id assignment: ${a.question_id}`);
    if (seenOrders.has(a.display_order)) fail(`Duplicate display_order: ${a.display_order}`);
    seenQuestions.add(a.question_id);
    seenOrders.add(a.display_order);
  }

  // 7. No conflicting Active assessment for the same role.
  const [conflicts] = await connection.query<Array<{ id: string; slug: string; version: number }>>(
    "SELECT id, slug, version FROM assessments WHERE role_id = ? AND status = 'Active' AND id <> ?",
    [role.id, assessment.id],
  );
  if (conflicts.length > 0) {
    fail(`Conflicting Active assessment exists: ${conflicts[0].slug} v${conflicts[0].version}`);
  }

  // Idempotent: if already Active and valid, report success without mutation.
  if (assessment.status === "Active") {
    console.log(JSON.stringify({
      ok: true,
      activated: false,
      alreadyActive: true,
      assessmentId: assessment.id,
      name: assessment.name,
      version: assessment.version,
      status: "Active",
      assignments: assignments.length,
      order: actualOrder,
    }, null, 2));
    process.exit(0);
  }

  // Only Draft → Active is permitted; other statuses require manual review.
  if (assessment.status !== "Draft") {
    fail(`Assessment status is '${assessment.status}'; only 'Draft' can be auto-activated`);
  }

  await connection.query(
    "UPDATE assessments SET status = 'Active' WHERE id = ?",
    [assessment.id],
  );

  console.log(JSON.stringify({
    ok: true,
    activated: true,
    assessmentId: assessment.id,
    name: assessment.name,
    version: assessment.version,
    status: "Active",
    roleTitle: role.title,
    assignments: assignments.length,
    order: actualOrder,
  }, null, 2));
} finally {
  await connection.end();
  process.exit(0);
}
