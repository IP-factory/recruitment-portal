import { V2_BONUS_CAP, V2_BONUS_ITEMS, V2_DIMENSION_FLOORS, V2_SCREENING_BANDS, V2_VERIFICATION_MULTIPLIERS, V2_INTEGRITY_PENALTY } from "@/lib/v2ModifierScoring";
import { V2_DIMENSION_LABELS, V2_DIMENSION_WEIGHTS, type V2BaseScoringResult } from "@/lib/v2BaseScoring";

export const V2_EVALUATION_DIMENSIONS = (Object.keys(V2_DIMENSION_WEIGHTS) as Array<keyof typeof V2_DIMENSION_WEIGHTS>).map((dimensionId) => ({
  dimensionId,
  label: V2_DIMENSION_LABELS[dimensionId],
  weight: V2_DIMENSION_WEIGHTS[dimensionId],
  floor: V2_DIMENSION_FLOORS[dimensionId as keyof typeof V2_DIMENSION_FLOORS],
}));

export const V2_PIPELINE_STEPS = [
  "Eligibility",
  "Dimension scoring",
  "Base Assessment Score",
  "Verification",
  "Integrity adjustments",
  "Bonus",
  "Final Screening Score",
  "Applied Band",
] as const;

export const V2_BAND_GUIDANCE = V2_SCREENING_BANDS.map((band) => ({
  band: band.band,
  range: band.band === "A" ? "80–100" : band.band === "B" ? "65–79" : band.band === "C" ? "50–64" : "Below 50",
  label: band.label,
}));

export const V2_FRAMEWORK_REFERENCE = {
  verification: Object.values(V2_VERIFICATION_MULTIPLIERS),
  integrityPenalty: V2_INTEGRITY_PENALTY,
  bonusCap: V2_BONUS_CAP,
  bonusItems: V2_BONUS_ITEMS,
} as const;

export function getV2DimensionProfile(result?: V2BaseScoringResult) {
  return V2_EVALUATION_DIMENSIONS.map((dimension) => {
    const scored = result?.dimensionResults.find((item) => item.dimensionId === dimension.dimensionId);
    const score = scored?.score;
    return {
      ...dimension,
      score,
      status: typeof score !== "number" ? "Pending" : dimension.floor === undefined ? "Passed" : score >= dimension.floor ? "Passed" : "Below required floor",
    } as const;
  });
}

export function v2LegacyLabel() {
  return "Legacy" as const;
}

export function v2ScoreStateLabel(result?: { scoringReady: boolean; finalScore?: number; appliedBand?: { band: string; label: string } }) {
  if (!result) return { score: "Legacy", band: "Legacy", help: "This application was assessed using the previous prototype model and does not have a v2 Final Screening Score." };
  if (!result.scoringReady || typeof result.finalScore !== "number") return { score: "Pending review", band: "Pending", help: "Complete the v2 assessment and resolve any OPEN rubric review before a Final Screening Score is available." };
  return { score: `${Math.round(result.finalScore)}%`, band: result.appliedBand ? `${result.appliedBand.band} · ${result.appliedBand.label}` : "Pending", help: "The applied band supports screening decisions. Recruitment actions remain subject to Admin review." };
}
