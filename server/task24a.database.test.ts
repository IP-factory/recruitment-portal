import mysql from "mysql2/promise";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("Task 24A native database foundation", () => {
  const connection = databaseUrl ? mysql.createPool(databaseUrl) : null;

  afterAll(async () => {
    await connection?.end();
  });

  it("persists the approved role, gates, dimensions, and v2 assessment counts", async () => {
    const [rows] = await connection!.query<Array<Record<string, string>>>(`SELECT
      (SELECT COUNT(*) FROM recruitment_roles WHERE slug='business-development-officer') AS roles,
      (SELECT COUNT(*) FROM eligibility_gates WHERE role_id='role-business-development-officer') AS gates,
      (SELECT COUNT(*) FROM assessment_dimensions WHERE role_id='role-business-development-officer') AS dimensions,
      (SELECT COALESCE(SUM(weight),0) FROM assessment_dimensions WHERE role_id='role-business-development-officer') AS weight_total,
      (SELECT COUNT(*) FROM assessment_questions) AS questions,
      (SELECT COUNT(*) FROM assessments WHERE slug='business-development-officer-assessment-v2' AND status='Draft' AND version=2) AS draft_assessments,
      (SELECT COUNT(*) FROM assessment_question_assignments WHERE assessment_id='assessment-business-development-officer-v2') AS assignments`);
    expect(rows[0]).toMatchObject({ roles: 1, gates: 7, dimensions: 8, weight_total: "100", questions: 14, draft_assessments: 1, assignments: 14 });
  });

  it("preserves supported type counts and v2 relationships", async () => {
    const [types] = await connection!.query<Array<{ question_type: string; count: string }>>(`SELECT question_type, COUNT(*) AS count FROM assessment_questions GROUP BY question_type ORDER BY question_type`);
    expect(types).toEqual([
      { question_type: "ORDINAL", count: 3 },
      { question_type: "MULTI", count: 3 },
      { question_type: "NUMERIC", count: 2 },
      { question_type: "SJT", count: 2 },
      { question_type: "OPEN", count: 3 },
      { question_type: "EVIDENCE", count: 1 },
    ]);
    const [links] = await connection!.query<Array<{ evidence: string; claimed: string }>>(`SELECT e.reference AS evidence, c.reference AS claimed FROM question_evidence_links l JOIN assessment_questions e ON e.id=l.evidence_question_id JOIN assessment_questions c ON c.id=l.claimed_question_id`);
    expect(links).toEqual([{ evidence: "D2.Q1E", claimed: "D2.Q1" }]);
    const [checks] = await connection!.query<Array<{ rule_type: string; source: string; comparison: string }>>(`SELECT rule_type, s.reference AS source, c.reference AS comparison FROM assessment_cross_checks x JOIN assessment_questions s ON s.id=x.source_question_id JOIN assessment_questions c ON c.id=x.comparison_question_id ORDER BY source`);
    expect(checks).toHaveLength(3);
    expect(checks).toEqual(expect.arrayContaining([
      { rule_type: "Integrity flag", source: "D1.Q1", comparison: "D1.Q2" },
      { rule_type: "Integrity flag", source: "D2.Q3", comparison: "D2.Q2" },
      { rule_type: "Manual review", source: "D4.Q1", comparison: "D4.Q2" },
    ]));
  });
});
