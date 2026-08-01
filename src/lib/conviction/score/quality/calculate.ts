import type { QualityCompositeResult, QualityFactorScore } from "./types";
import { QUALITY_MIN_COVERAGE } from "./weights";

function clampScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

/**
 * Weighted quality composite from normalized factor scores.
 * Missing factors are omitted (weights renormalized); no agreement bonus —
 * quality is not meant to move with the news cycle.
 */
export function calculateQualityComposite(
  factors: QualityFactorScore[],
): QualityCompositeResult {
  const usable = factors.filter((factor) => factor.hasData);
  const includedFactors = usable.map((factor) => factor.factor);
  const excludedFactors = factors
    .filter((factor) => !factor.hasData)
    .map((factor) => factor.factor);

  const coverage = usable.reduce((sum, factor) => sum + factor.baseWeight, 0);

  if (coverage < QUALITY_MIN_COVERAGE) {
    return {
      score: null,
      coverage,
      includedFactors,
      excludedFactors,
      factors,
    };
  }

  const weightedAverage =
    usable.reduce(
      (sum, factor) => sum + clampScore(factor.score) * factor.baseWeight,
      0,
    ) / coverage;

  return {
    score: clampScore(weightedAverage),
    coverage,
    includedFactors,
    excludedFactors,
    factors,
  };
}
