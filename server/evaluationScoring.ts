/**
 * Task 24D-2 — centralized server scoring service.
 *
 * Calculates the complete v2 evaluation for a submitted application:
 * objective question raw scores, dimension normalisation, Base Assessment
 * Score, verification multiplier, integrity cross-checks, bonus, Final
 * Screening Score, floors, Raw Band and Applied Band.
 *
 * All scoring is performed server-side; the client never sends authoritative
 * score values.
 */
import { randomBytes } from "node:crypto";
import { and, eq, sql, asc } from "drizzle-orm";
import {
  applicationBonusReviews,
  applicationDimensionScores,
  applicationEvaluations,
  applicationIntegrityFlags,
  applicationShortlist,
  applications,
  assessmentAttempts,
  assessmentCrossChecks,
  assessmentDimensions,
  assessmentQuestions,
  assessmentQuestionAssignments,
  assessmentResponses,
  numericQuestionConfigs,
  numericScoringBands,
  openQuestionConfigs,
  openResponseReviews,
  questionOptions,
  screeningConfigurations,
  screeningVerificationMultipliers,
} from "../drizzle/schema";
import {
  BONUS_CAP,
  BONUS_TYPES,
  DIMENSION_FLOORS,
  DIMENSION_WEIGHTS,
  INTEGRITY_PENALTY_PER_FLAG,
  calculateFinalScore,
  resolveBand,
  applyFloorCap,
  type EvaluationStatus,
  type ScreeningBand,
} from "../shared/adminApplicationApi";
import { getDatabase } from "./db";

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function generateId(): string {
  return randomBytes(12).toString("hex");
}

// ── Question raw score calculation ────────────────────────────────────────────

interface QuestionScoringConfig {
  questionId: string;
  reference: string;
  questionType: string;
  dimensionId: string | null;
  dimensionReference: string | null;
  qWeight: number | null;
  maxScore: number | null;
  options: Array<{ id: string; rawScore: number | null; isDecoy: number; verificationMultiplier: string | null; outcomeType: string | null }>;
  numericConfig: { mode: string; derivedCalculationType: string } | null;
  numericBands: Array<{ lowerBound: string | null; upperBound: string | null; rawScore: number }>;
}

interface ResponsePayload {
  responseType: string;
  responsePayload: string;
}

export function scoreObjectiveQuestion(config: QuestionScoringConfig, response: ResponsePayload): number | null {
  const payload = parseJson<unknown>(response.responsePayload, null);
  if (!payload) return null;

  switch (config.questionType) {
    case "ORDINAL":
    case "SJT":
    case "GATE": {
      if (typeof payload !== "string") return null;
      const option = config.options.find((o) => o.id === payload);
      return option?.rawScore ?? null;
    }
    case "MULTI": {
      if (!Array.isArray(payload)) return null;
      const selected = payload.filter((id): id is string => typeof id === "string");
      let total = 0;
      for (const id of selected) {
        const option = config.options.find((o) => o.id === id);
        if (option?.rawScore !== null && option?.rawScore !== undefined) total += option.rawScore;
      }
      return Math.min(config.maxScore ?? 5, Math.max(0, total));
    }
    case "NUMERIC": {
      if (!config.numericConfig || config.numericBands.length === 0) return null;
      const obj = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
      let derivedValue: number;
      if (config.numericConfig.mode === "calendarYearExperience") {
        if (obj.never === true) derivedValue = 0;
        else if (typeof obj.year !== "string" || !/^\d{4}$/.test(obj.year)) return null;
        else derivedValue = new Date().getFullYear() - Number(obj.year);
      } else {
        const target = Number(obj.target);
        const actual = Number(obj.actual);
        if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual) || actual < 0) return null;
        derivedValue = (actual / target) * 100;
      }
      const band = config.numericBands.find((b) => {
        const lower = b.lowerBound !== null ? Number(b.lowerBound) : -Infinity;
        const upper = b.upperBound !== null ? Number(b.upperBound) : Infinity;
        return derivedValue >= lower && derivedValue <= upper;
      });
      return band?.rawScore ?? null;
    }
    case "EVIDENCE": {
      // EVIDENCE awards no raw assessment points
      return null;
    }
    default:
      return null;
  }
}

export function resolveEvidenceMultiplier(
  config: QuestionScoringConfig,
  response: ResponsePayload,
): number | null {
  if (config.questionType !== "EVIDENCE") return null;
  const payload = parseJson<unknown>(response.responsePayload, null);
  if (typeof payload !== "string") return null;
  const option = config.options.find((o) => o.id === payload);
  if (!option?.verificationMultiplier) return null;
  const value = Number(option.verificationMultiplier);
  return Number.isFinite(value) ? value : null;
}

// ── Dimension normalisation ───────────────────────────────────────────────────

interface QuestionScoreResult {
  questionId: string;
  reference: string;
  questionType: string;
  dimensionId: string | null;
  dimensionReference: string | null;
  qWeight: number | null;
  maxScore: number | null;
  rawScore: number | null;
}

interface DimensionScoreResult {
  dimensionId: string;
  dimensionReference: string;
  normalizedScore: number;
  weight: number;
  weightedContribution: number;
  floor: number | null;
  floorStatus: string | null;
}

export function calculateDimensionScores(
  questionResults: QuestionScoreResult[],
  openScores: Record<string, number>,
  dimensions: Array<{ id: string; reference: string; weight: number; minimumFloor: number | null }>,
): DimensionScoreResult[] {
  return dimensions.map((dim) => {
    const assigned = questionResults.filter(
      (q) => q.dimensionId === dim.id && q.questionType !== "GATE" && q.questionType !== "EVIDENCE",
    );
    if (assigned.length === 0) {
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: 0,
        weight: dim.weight,
        weightedContribution: 0,
        floor: dim.minimumFloor,
        floorStatus: "No questions assigned",
      };
    }

    // Resolve raw scores: use openScores for OPEN questions
    const scored = assigned.map((q) => {
      let raw = q.rawScore;
      if (q.questionType === "OPEN" && openScores[q.questionId] !== undefined) {
        raw = openScores[q.questionId];
      }
      return { ...q, resolvedRaw: raw };
    });

    const allScored = scored.every((q) => typeof q.resolvedRaw === "number" && typeof q.maxScore === "number" && typeof q.qWeight === "number");
    if (!allScored) {
      // Do NOT return normalizedScore: 0 here — that would silently treat an
      // unresolved dimension as contributing zero to the base score.
      // Return weightedContribution: null so calculateFullEvaluation can detect
      // that this dimension is genuinely pending and must not be summed.
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: null as unknown as number, // deliberately unresolved
        weight: dim.weight,
        weightedContribution: null as unknown as number, // deliberately unresolved
        floor: dim.minimumFloor,
        floorStatus: "Pending",
      };
    }

    const denominator = scored.reduce((sum, q) => sum + (q.qWeight ?? 0), 0);
    if (denominator <= 0) {
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: 0,
        weight: dim.weight,
        weightedContribution: 0,
        floor: dim.minimumFloor,
        floorStatus: "No weighted questions",
      };
    }

    const normalizedScore = Math.min(
      100,
      Math.max(
        0,
        (scored.reduce((sum, q) => {
          const input = (q.resolvedRaw! / q.maxScore!) * q.qWeight!;
          return sum + input;
        }, 0) / denominator) * 100,
      ),
    );

    const weight = dim.weight;
    const weightedContribution = (normalizedScore * weight) / 100;
    const floorValue = dim.minimumFloor;
    const floorStatus = floorValue !== null ? (normalizedScore >= floorValue ? "Passed" : "Below floor") : null;

    return {
      dimensionId: dim.id,
      dimensionReference: dim.reference,
      normalizedScore: Number(normalizedScore.toFixed(3)),
      weight,
      weightedContribution: Number(weightedContribution.toFixed(3)),
      floor: floorValue,
      floorStatus,
    };
  });
}

// ── Integrity cross-checks ────────────────────────────────────────────────────

export interface IntegrityFlagResult {
  id: string;
  source: string;
  description: string;
  sourceQuestionId: string;
  comparisonQuestionId: string | null;
  status: "Clear" | "Flagged" | "Confirmed" | "Dismissed";
}

export function evaluateIntegrityCrossChecks(
  questionResults: QuestionScoreResult[],
  responses: Array<{ questionId: string; responsePayload: string; questionType: string; reference: string }>,
  crossCheckConfigs: Array<{
    id: string;
    sourceQuestionId: string;
    comparisonQuestionId: string;
    ruleType: string;
    ruleConfiguration: string;
    description: string;
    status: string;
  }>,
  existingFlags: Array<{ id: string; sourceQuestionId: string; status: string }>,
): IntegrityFlagResult[] {
  const flags: IntegrityFlagResult[] = [];

  for (const check of crossCheckConfigs) {
    if (check.status !== "Active") continue;
    const existing = existingFlags.find((f) => f.sourceQuestionId === check.sourceQuestionId);
    const currentStatus = existing?.status ?? "Flagged";

    const sourceResponse = responses.find((r) => r.questionId === check.sourceQuestionId);
    const comparisonResponse = responses.find((r) => r.questionId === check.comparisonQuestionId);
    if (!sourceResponse || !comparisonResponse) continue;

    if (check.ruleType === "Manual review") {
      flags.push({
        id: existing?.id ?? `flag-${generateId()}`,
        source: `${sourceResponse.reference} / ${comparisonResponse.reference}`,
        description: check.description,
        sourceQuestionId: check.sourceQuestionId,
        comparisonQuestionId: check.comparisonQuestionId,
        status: currentStatus as IntegrityFlagResult["status"],
      });
      continue;
    }

    // Deterministic integrity checks
    const sourcePayload = parseJson<unknown>(sourceResponse.responsePayload, null);
    const comparisonPayload = parseJson<unknown>(comparisonResponse.responsePayload, null);

    // D1.Q1 vs D1.Q2 consistency check
    if (sourceResponse.reference === "D1.Q1" && comparisonResponse.reference === "D1.Q2") {
      const expectedYears: Record<string, number> = { a: 10, b: 4, c: 0 };
      let shouldFlag = false;
      if (typeof sourcePayload === "string") {
        const compObj = typeof comparisonPayload === "object" && comparisonPayload !== null ? comparisonPayload as Record<string, unknown> : {};
        let years: number | undefined;
        if (compObj.never === true) years = 0;
        else if (typeof compObj.year === "string" && /^\d{4}$/.test(compObj.year)) years = new Date().getFullYear() - Number(compObj.year);
        if (years !== undefined && expectedYears[sourcePayload] !== undefined && Math.abs(years - expectedYears[sourcePayload]) > 2) {
          shouldFlag = true;
        }
      }
      if (shouldFlag) {
        flags.push({
          id: existing?.id ?? `flag-${generateId()}`,
          source: "D1.Q1 / D1.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus as IntegrityFlagResult["status"],
        });
      } else if (existing) {
        flags.push({
          id: existing.id,
          source: "D1.Q1 / D1.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus as IntegrityFlagResult["status"],
        });
      }
    }

    // D2.Q3 vs D2.Q2 attainment check
    if (sourceResponse.reference === "D2.Q3" && comparisonResponse.reference === "D2.Q2") {
      const compObj = typeof comparisonPayload === "object" && comparisonPayload !== null ? comparisonPayload as Record<string, unknown> : {};
      const target = Number(compObj.target);
      const actual = Number(compObj.actual);
      const attainment = Number.isFinite(target) && target > 0 && Number.isFinite(actual) && actual >= 0 ? (actual / target) * 100 : undefined;
      let shouldFlag = false;
      if (attainment !== undefined && attainment < 100) {
        shouldFlag = true;
      }
      if (shouldFlag) {
        flags.push({
          id: existing?.id ?? `flag-${generateId()}`,
          source: "D2.Q3 / D2.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus as IntegrityFlagResult["status"],
        });
      } else if (existing) {
        flags.push({
          id: existing.id,
          source: "D2.Q3 / D2.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus as IntegrityFlagResult["status"],
        });
      }
    }
  }

  return flags;
}

// ── Full evaluation calculation ───────────────────────────────────────────────

export interface FullEvaluationResult {
  evaluationStatus: EvaluationStatus;
  baseAssessmentScore: number | null;
  verificationMultiplier: number | null;
  integrityPenalty: number;
  bonus: number;
  finalScreeningScore: number | null;
  rawBand: ScreeningBand | null;
  appliedBand: ScreeningBand | null;
  floorMissed: string | null;
  manualReviewRequired: boolean;
  dimensions: DimensionScoreResult[];
  questionScores: QuestionScoreResult[];
}

export function calculateFullEvaluation(
  questionConfigs: QuestionScoringConfig[],
  responses: Array<{ questionId: string; responseType: string; responsePayload: string }>,
  openScores: Record<string, number>,
  dimensions: Array<{ id: string; reference: string; weight: number; minimumFloor: number | null }>,
  integrityFlags: IntegrityFlagResult[],
  bonusConfirmed: Record<string, boolean>,
  attemptComplete: boolean,
): FullEvaluationResult {
  // 1. Score each question
  const questionScores: QuestionScoreResult[] = questionConfigs.map((config) => {
    const response = responses.find((r) => r.questionId === config.questionId);
    if (!response) {
      return {
        questionId: config.questionId,
        reference: config.reference,
        questionType: config.questionType,
        dimensionId: config.dimensionId,
        dimensionReference: config.dimensionReference,
        qWeight: config.qWeight,
        maxScore: config.maxScore,
        rawScore: null,
      };
    }
    const rawScore = scoreObjectiveQuestion(config, response);
    return {
      questionId: config.questionId,
      reference: config.reference,
      questionType: config.questionType,
      dimensionId: config.dimensionId,
      dimensionReference: config.dimensionReference,
      qWeight: config.qWeight,
      maxScore: config.maxScore,
      rawScore,
    };
  });

  // 2. Check if assessment is complete
  if (!attemptComplete) {
    return {
      evaluationStatus: "Pending Assessment",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: [],
      questionScores,
    };
  }

  // 3. Check OPEN questions are all reviewed
  const openQuestions = questionConfigs.filter((q) => q.questionType === "OPEN");
  const allOpenReviewed = openQuestions.every((q) => openScores[q.questionId] !== undefined);
  if (!allOpenReviewed) {
    const dims = calculateDimensionScores(questionScores, openScores, dimensions);
    return {
      evaluationStatus: "Pending OPEN Review",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: dims,
      questionScores,
    };
  }

  // 4. Calculate dimension scores
  const dimensionResults = calculateDimensionScores(questionScores, openScores, dimensions);

  // 5. Verify all dimensions are fully scored before computing Base Assessment Score.
  // A pending dimension (unreviewed OPEN, missing option, etc.) must block the
  // final score — silently treating it as 0 would produce a deterministically
  // wrong result.
  const pendingDimensions = dimensionResults.filter((d) => d.floorStatus === "Pending" || d.normalizedScore === null || d.weightedContribution === null);
  if (pendingDimensions.length > 0) {
    return {
      evaluationStatus: "Pending OPEN Review",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: dimensionResults,
      questionScores,
    };
  }

  // 5b. Calculate Base Assessment Score — all dimensions are confirmed scored.
  const baseAssessmentScore = Number(
    dimensionResults.reduce((sum, dim) => sum + dim.weightedContribution, 0).toFixed(3),
  );

  // 6. Resolve verification multiplier
  let verificationMultiplier: number = 1;
  const evidenceQuestions = questionConfigs.filter((q) => q.questionType === "EVIDENCE");
  const evidenceMultipliers: number[] = [];
  for (const config of evidenceQuestions) {
    const response = responses.find((r) => r.questionId === config.questionId);
    if (response) {
      const mult = resolveEvidenceMultiplier(config, response);
      if (mult !== null) evidenceMultipliers.push(mult);
    }
  }
  if (evidenceMultipliers.length > 0) {
    verificationMultiplier = Math.min(...evidenceMultipliers);
  }

  // 7. Integrity penalty
  const confirmedFlags = integrityFlags.filter((f) => f.status === "Confirmed");
  const integrityPenalty = confirmedFlags.length * INTEGRITY_PENALTY_PER_FLAG;
  const manualReviewRequired = confirmedFlags.length >= 2;

  // 8. Bonus
  const rawBonus = Object.entries(bonusConfirmed)
    .filter(([, confirmed]) => confirmed)
    .reduce((sum, [code]) => {
      const bonusDef = BONUS_TYPES.find((b) => b.code === code);
      return sum + (bonusDef?.points ?? 0);
    }, 0);
  const bonus = Math.min(BONUS_CAP, rawBonus);

  // 9. Final Screening Score
  const finalScreeningScore = Number(
    calculateFinalScore(baseAssessmentScore, verificationMultiplier, integrityPenalty, bonus).toFixed(3),
  );

  // 10. Raw Band
  const rawBand = resolveBand(finalScreeningScore);

  // 11. Floor check
  const failedFloors = dimensionResults.filter(
    (dim) => dim.floor !== null && dim.normalizedScore < dim.floor,
  );
  const floorMissed = failedFloors.length > 0 ? failedFloors.map((f) => f.dimensionReference).join(", ") : null;
  const { appliedBand } = applyFloorCap(rawBand, failedFloors.length > 0);

  // 12. Evaluation status
  const evaluationStatus: EvaluationStatus = manualReviewRequired ? "Manual Review Required" : "Scored";

  return {
    evaluationStatus,
    baseAssessmentScore,
    verificationMultiplier,
    integrityPenalty,
    bonus,
    finalScreeningScore,
    rawBand,
    appliedBand,
    floorMissed,
    manualReviewRequired,
    dimensions: dimensionResults,
    questionScores,
  };
}

// ── Database operations ───────────────────────────────────────────────────────

export async function loadQuestionScoringConfigs(assessmentId: string): Promise<QuestionScoringConfig[]> {
  const db = getDatabase();
  const assignments = await db
    .select({
      questionId: assessmentQuestionAssignments.questionId,
      displayOrder: assessmentQuestionAssignments.displayOrder,
    })
    .from(assessmentQuestionAssignments)
    .where(eq(assessmentQuestionAssignments.assessmentId, assessmentId))
    .orderBy(asc(assessmentQuestionAssignments.displayOrder));

  const results: QuestionScoringConfig[] = [];
  for (const assignment of assignments) {
    const [questions, options, numericConfigs, numericBands] = await Promise.all([
      db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, assignment.questionId)).limit(1),
      db.select().from(questionOptions).where(eq(questionOptions.questionId, assignment.questionId)).orderBy(asc(questionOptions.displayOrder)),
      db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, assignment.questionId)).limit(1),
      db.select().from(numericScoringBands).where(eq(numericScoringBands.questionId, assignment.questionId)).orderBy(asc(numericScoringBands.displayOrder)),
    ]);
    const question = questions[0];
    if (!question) continue;

    // Resolve dimension reference
    let dimensionReference: string | null = null;
    if (question.dimensionId) {
      const dims = await db.select().from(assessmentDimensions).where(eq(assessmentDimensions.id, question.dimensionId)).limit(1);
      dimensionReference = dims[0]?.reference ?? null;
    }

    results.push({
      questionId: question.id,
      reference: question.reference,
      questionType: question.questionType,
      dimensionId: question.dimensionId,
      dimensionReference,
      qWeight: question.qWeight,
      maxScore: question.maxScore,
      options: options.map((o) => ({
        id: o.id,
        rawScore: o.rawScore,
        isDecoy: o.isDecoy,
        verificationMultiplier: o.verificationMultiplier,
        outcomeType: o.outcomeType,
      })),
      numericConfig: numericConfigs[0] ? {
        mode: numericConfigs[0].mode,
        derivedCalculationType: numericConfigs[0].derivedCalculationType,
      } : null,
      numericBands: numericBands.map((b) => ({
        lowerBound: b.lowerBound,
        upperBound: b.upperBound,
        rawScore: b.rawScore,
      })),
    });
  }
  return results;
}

export async function recalculateAndPersistEvaluation(applicationId: string): Promise<FullEvaluationResult | null> {
  const db = getDatabase();

  // Load application and attempt
  const [appRows] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!appRows) return null;

  const attempts = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.applicationId, applicationId)))
    .limit(1);
  if (attempts.length === 0) return null;

  const attempt = attempts[0];
  const assessmentId = appRows.assessmentId ?? attempt.assessmentId;
  if (!assessmentId) return null;

  // Load all required data
  const [questionConfigs, responses, openReviews, existingFlags, bonusReviews, dimensions, crossCheckConfigs] = await Promise.all([
    loadQuestionScoringConfigs(assessmentId),
    db.select().from(assessmentResponses).where(eq(assessmentResponses.attemptId, attempt.id)),
    db.select().from(openResponseReviews).where(eq(openResponseReviews.applicationId, applicationId)),
    db.select().from(applicationIntegrityFlags).where(eq(applicationIntegrityFlags.applicationId, applicationId)),
    db.select().from(applicationBonusReviews).where(eq(applicationBonusReviews.applicationId, applicationId)),
    db.select().from(assessmentDimensions).where(eq(assessmentDimensions.roleId, appRows.roleId)).orderBy(asc(assessmentDimensions.displayOrder)),
    db.select().from(assessmentCrossChecks).where(eq(assessmentCrossChecks.status, "Active")),
  ]);

  // Build open scores map
  const openScores: Record<string, number> = {};
  for (const review of openReviews) {
    openScores[review.questionId] = review.rawScore;
  }

  // Build bonus map
  const bonusConfirmed: Record<string, boolean> = {};
  for (const bonus of bonusReviews) {
    bonusConfirmed[bonus.bonusType] = bonus.confirmed === 1;
  }

  // Build response data for integrity checks
  const responseData = responses.map((r) => {
    const config = questionConfigs.find((q) => q.questionId === r.questionId);
    return {
      questionId: r.questionId,
      responsePayload: r.responsePayload,
      questionType: r.responseType,
      reference: config?.reference ?? "",
    };
  });

  // Evaluate integrity flags
  const integrityResults = evaluateIntegrityCrossChecks(
    questionConfigs.map((q) => ({
      questionId: q.questionId,
      reference: q.reference,
      questionType: q.questionType,
      dimensionId: q.dimensionId,
      dimensionReference: q.dimensionReference,
      qWeight: q.qWeight,
      maxScore: q.maxScore,
      rawScore: null,
    })),
    responseData,
    crossCheckConfigs,
    existingFlags,
  );

  // Calculate full evaluation
  const result = calculateFullEvaluation(
    questionConfigs,
    responses.map((r) => ({ questionId: r.questionId, responseType: r.responseType, responsePayload: r.responsePayload })),
    openScores,
    dimensions.map((d) => ({ id: d.id, reference: d.reference, weight: d.weight, minimumFloor: d.minimumFloor })),
    integrityResults,
    bonusConfirmed,
    attempt.status === "Complete",
  );

  // Persist evaluation
  const now = new Date();
  const evalId = `eval-${generateId()}`;
  const existingEval = await db
    .select({ id: applicationEvaluations.id })
    .from(applicationEvaluations)
    .where(eq(applicationEvaluations.applicationId, applicationId))
    .limit(1);

  if (existingEval.length > 0) {
    await db
      .update(applicationEvaluations)
      .set({
        baseAssessmentScore: result.baseAssessmentScore !== null ? String(result.baseAssessmentScore) : null,
        verificationMultiplier: result.verificationMultiplier !== null ? String(result.verificationMultiplier) : null,
        integrityPenalty: result.integrityPenalty,
        bonus: result.bonus,
        finalScreeningScore: result.finalScreeningScore !== null ? String(result.finalScreeningScore) : null,
        rawBand: result.rawBand,
        appliedBand: result.appliedBand,
        floorMissed: result.floorMissed,
        manualReviewRequired: result.manualReviewRequired ? 1 : 0,
        evaluationStatus: result.evaluationStatus,
        calculatedAt: now,
      })
      .where(eq(applicationEvaluations.applicationId, applicationId));
  } else {
    await db.insert(applicationEvaluations).values([{
      id: evalId,
      applicationId,
      attemptId: attempt.id,
      baseAssessmentScore: result.baseAssessmentScore !== null ? String(result.baseAssessmentScore) : null,
      verificationMultiplier: result.verificationMultiplier !== null ? String(result.verificationMultiplier) : null,
      integrityPenalty: result.integrityPenalty,
      bonus: result.bonus,
      finalScreeningScore: result.finalScreeningScore !== null ? String(result.finalScreeningScore) : null,
      rawBand: result.rawBand,
      appliedBand: result.appliedBand,
      floorMissed: result.floorMissed,
      manualReviewRequired: result.manualReviewRequired ? 1 : 0,
      evaluationStatus: result.evaluationStatus,
      calculatedAt: now,
    }]);
  }

  // Persist dimension scores
  await db.delete(applicationDimensionScores).where(eq(applicationDimensionScores.applicationId, applicationId));
  if (result.dimensions.length > 0) {
    await db.insert(applicationDimensionScores).values(
      result.dimensions.map((dim) => ({
        id: `dim-${generateId()}`,
        applicationId,
        dimensionId: dim.dimensionId,
        dimensionReference: dim.dimensionReference,
        normalizedScore: String(dim.normalizedScore),
        weight: dim.weight,
        weightedContribution: String(dim.weightedContribution),
        floor: dim.floor,
        floorStatus: dim.floorStatus,
        calculatedAt: now,
      })),
    );
  }

  // Upsert integrity flags
  for (const flag of integrityResults) {
    const existing = existingFlags.find((f) => f.sourceQuestionId === flag.sourceQuestionId);
    if (existing) {
      // Don't overwrite admin decisions
      if (existing.status === "Confirmed" || existing.status === "Dismissed") continue;
      await db
        .update(applicationIntegrityFlags)
        .set({ status: flag.status })
        .where(eq(applicationIntegrityFlags.id, existing.id));
    } else if (flag.status === "Flagged") {
      await db.insert(applicationIntegrityFlags).values({
        id: flag.id,
        applicationId,
        sourceQuestionId: flag.sourceQuestionId,
        comparisonQuestionId: flag.comparisonQuestionId,
        description: flag.description,
        source: flag.source,
        status: flag.status,
      });
    }
  }

  return result;
}
