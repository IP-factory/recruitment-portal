/**
 * Task 24F — idempotent stale-score backfill for completed BDO v2 applications.
 *
 * Some completed Business Development Officer v2 applications carry stale
 * evaluation scores (e.g. 31.0, 24.9) that were persisted by an earlier
 * scoring iteration. This script recalculates those scores using the current
 * scoring engine (`recalculateAndPersistEvaluation`), which reads the
 * applicant's persisted responses plus any existing OPEN reviews, integrity
 * flags, and bonus review decisions.
 *
 * Guarantees:
 * - Applicant responses are never modified.
 * - Incomplete attempts are never completed or scored.
 * - Legacy (non-v2) assessments are never converted.
 * - OPEN review scores, integrity decisions, and bonus decisions are reused
 *   exactly as persisted (admin decisions are preserved by the engine).
 * - Recalculation is a pure function of persisted inputs, so re-running the
 *   script is safe (idempotent).
 * - The script never runs automatically at startup — it only executes when
 *   invoked directly from the command line.
 *
 * Usage:
 *   npx tsx scripts/backfill-v2-evaluations.ts            # dry run (report only, no writes)
 *   npx tsx scripts/backfill-v2-evaluations.ts --apply    # recalculate and persist
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { applicationEvaluations, applications, assessmentAttempts, assessments, recruitmentRoles } from "../drizzle/schema";
import { getDatabase } from "../server/db";
import { recalculateAndPersistEvaluation } from "../server/evaluationScoring";

export const BACKFILL_ROLE_SLUG = "business-development-officer";
export const BACKFILL_MINIMUM_VERSION = 2;

export interface BackfillScanInput {
  applicationId: string;
  fullName: string;
  /** applications.assessment_id (may be null on older rows). */
  applicationAssessmentId: string | null;
  /** The application's first assessment attempt, if any. */
  attempt: { assessmentId: string; status: string } | null;
  /** Assessment ids that belong to the v2 (or later) generation. */
  v2AssessmentIds: ReadonlySet<string>;
}

export interface BackfillScanOutcome {
  applicationId: string;
  fullName: string;
  action: "recalculate" | "skip";
  /** Skip reason, present only when action === "skip". */
  reason?: string;
}

/**
 * Pure classification used by both the live run and the tests. An application
 * is recalculated only when it has a Complete attempt against a v2 assessment;
 * every other case is skipped with a reason.
 */
export function classifyBackfillCandidate(input: BackfillScanInput): BackfillScanOutcome {
  const { applicationId, fullName, applicationAssessmentId, attempt, v2AssessmentIds } = input;
  if (!attempt) {
    return { applicationId, fullName, action: "skip", reason: "No assessment attempt recorded" };
  }
  const effectiveAssessmentId = applicationAssessmentId ?? attempt.assessmentId;
  if (!v2AssessmentIds.has(effectiveAssessmentId)) {
    return { applicationId, fullName, action: "skip", reason: "Legacy assessment — not converted" };
  }
  if (attempt.status !== "Complete") {
    return { applicationId, fullName, action: "skip", reason: `Attempt not complete (status: ${attempt.status})` };
  }
  return { applicationId, fullName, action: "recalculate" };
}

/** Pure comparison of stored decimal score strings. */
export function describeScoreChange(before: string | null, after: string | null): "recalculated" | "unchanged" {
  const beforeNumber = before === null ? null : Number(before);
  const afterNumber = after === null ? null : Number(after);
  if (beforeNumber === null && afterNumber === null) return "unchanged";
  if (beforeNumber === null || afterNumber === null) return "recalculated";
  return Math.abs(beforeNumber - afterNumber) < 0.0001 ? "unchanged" : "recalculated";
}

export interface BackfillReportEntry {
  applicationId: string;
  fullName: string;
  beforeScore: string | null;
  afterScore: string | null;
  outcome: "recalculated" | "unchanged";
}

export interface BackfillReport {
  mode: "dry-run" | "apply";
  scanned: number;
  recalculated: number;
  unchanged: number;
  entries: BackfillReportEntry[];
  skipped: Array<{ applicationId: string; fullName: string; reason: string }>;
  failed: Array<{ applicationId: string; fullName: string; error: string }>;
}

async function fetchStoredScore(applicationId: string): Promise<string | null> {
  const db = getDatabase();
  const rows = await db
    .select({ finalScreeningScore: applicationEvaluations.finalScreeningScore })
    .from(applicationEvaluations)
    .where(eq(applicationEvaluations.applicationId, applicationId))
    .limit(1);
  return rows[0]?.finalScreeningScore ?? null;
}

export async function runBackfill(options: { apply: boolean }): Promise<BackfillReport> {
  const db = getDatabase();
  const report: BackfillReport = {
    mode: options.apply ? "apply" : "dry-run",
    scanned: 0,
    recalculated: 0,
    unchanged: 0,
    entries: [],
    skipped: [],
    failed: [],
  };

  const [role] = await db.select().from(recruitmentRoles).where(eq(recruitmentRoles.slug, BACKFILL_ROLE_SLUG)).limit(1);
  if (!role) throw new Error(`Recruitment role with slug "${BACKFILL_ROLE_SLUG}" was not found.`);

  const roleAssessments = await db.select().from(assessments).where(eq(assessments.roleId, role.id));
  const v2AssessmentIds = new Set(
    roleAssessments.filter((assessment) => assessment.version >= BACKFILL_MINIMUM_VERSION).map((assessment) => assessment.id),
  );
  if (v2AssessmentIds.size === 0) throw new Error("No v2 (or later) assessments exist for this role; nothing to backfill.");

  const roleApplications = await db.select().from(applications).where(eq(applications.roleId, role.id));
  report.scanned = roleApplications.length;

  for (const application of roleApplications) {
    const attempts = await db
      .select()
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.applicationId, application.id))
      .limit(1);
    const attempt = attempts[0] ?? null;
    const outcome = classifyBackfillCandidate({
      applicationId: application.id,
      fullName: application.fullName,
      applicationAssessmentId: application.assessmentId,
      attempt: attempt ? { assessmentId: attempt.assessmentId, status: attempt.status } : null,
      v2AssessmentIds,
    });

    if (outcome.action === "skip") {
      report.skipped.push({ applicationId: application.id, fullName: application.fullName, reason: outcome.reason ?? "Skipped" });
      continue;
    }

    const beforeScore = await fetchStoredScore(application.id);
    if (!options.apply) {
      report.entries.push({
        applicationId: application.id,
        fullName: application.fullName,
        beforeScore,
        afterScore: null,
        outcome: "recalculated",
      });
      continue;
    }

    try {
      // Recalculation reads persisted responses/reviews only and never writes
      // applicant responses; re-running always converges to the same result.
      const result = await recalculateAndPersistEvaluation(application.id);
      if (!result) {
        report.failed.push({ applicationId: application.id, fullName: application.fullName, error: "Scoring engine returned no result" });
        continue;
      }
      const afterScore = result.finalScreeningScore !== null ? String(result.finalScreeningScore) : null;
      const change = describeScoreChange(beforeScore, afterScore);
      report.entries.push({ applicationId: application.id, fullName: application.fullName, beforeScore, afterScore, outcome: change });
      if (change === "recalculated") report.recalculated += 1;
      else report.unchanged += 1;
    } catch (err) {
      report.failed.push({
        applicationId: application.id,
        fullName: application.fullName,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return report;
}

function printReport(report: BackfillReport) {
  const lines: string[] = [];
  lines.push(`Task 24F v2 evaluation backfill — mode: ${report.mode}`);
  lines.push(`Scanned applications:   ${report.scanned}`);
  if (report.mode === "apply") {
    lines.push(`Recalculated:           ${report.recalculated}`);
    lines.push(`Unchanged:              ${report.unchanged}`);
  } else {
    lines.push(`Would recalculate:      ${report.entries.length}`);
  }
  lines.push(`Skipped:                ${report.skipped.length}`);
  lines.push(`Failed:                 ${report.failed.length}`);
  for (const entry of report.entries) {
    const scoreSummary = report.mode === "apply"
      ? `${entry.beforeScore ?? "—"} → ${entry.afterScore ?? "—"} (${entry.outcome})`
      : `current score ${entry.beforeScore ?? "—"} (will be recalculated)`;
    lines.push(`  - ${entry.fullName} [${entry.applicationId}]: ${scoreSummary}`);
  }
  for (const skip of report.skipped) lines.push(`  - skipped ${skip.fullName} [${skip.applicationId}]: ${skip.reason}`);
  for (const failure of report.failed) lines.push(`  - FAILED ${failure.fullName} [${failure.applicationId}]: ${failure.error}`);
  if (report.mode === "dry-run") lines.push("Dry run complete — no data was written. Re-run with --apply to persist recalculated scores.");
  console.log(lines.join("\n"));
}

const invokedDirectly = process.argv[1]?.endsWith("backfill-v2-evaluations.ts") ?? false;
if (invokedDirectly) {
  const apply = process.argv.includes("--apply");
  runBackfill({ apply })
    .then(printReport)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
