import { labelForScore } from "./labels";
import { MIN_COVERAGE } from "./weights";
import type { CategoryScore, ConvictionScoreResult } from "./types";

/** Category may influence the composite only when data exists and is fresh. */
export function isUsableCategory(category: CategoryScore): boolean {
  return category.hasData && !category.isStale;
}

/**
 * Sum of original base weights for usable categories.
 * Coverage is never renormalized — missing/stale weight stays absent.
 */
export function calculateCoverage(categories: CategoryScore[]): number {
  return categories
    .filter(isUsableCategory)
    .reduce((sum, category) => sum + category.baseWeight, 0);
}

/**
 * Rare multi-source agreement bonus.
 * Requires four usable categories at |score| >= 25 in the same direction.
 */
export function applyAgreementAdjustment(usable: CategoryScore[]): number {
  const positiveCount = usable.filter((category) => category.score >= 25).length;
  const negativeCount = usable.filter((category) => category.score <= -25).length;

  if (positiveCount >= 4) return 5;
  if (negativeCount >= 4) return -5;
  return 0;
}

function clampScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

/**
 * Deterministic composite Conviction Score from normalized category inputs.
 *
 * - Includes only hasData && !isStale
 * - Withholds the score when coverage < 0.50
 * - Renormalizes usable weights for the weighted average
 * - Applies agreement adjustment, then clamps to [-100, +100]
 */
export function calculateConvictionScore(
  categories: CategoryScore[],
): ConvictionScoreResult {
  const usable = categories.filter(isUsableCategory);
  const includedCategories = usable.map((category) => category.category);
  const excludedCategories = categories
    .filter((category) => !isUsableCategory(category))
    .map((category) => category.category);

  const coverage = usable.reduce((sum, category) => sum + category.baseWeight, 0);

  if (coverage < MIN_COVERAGE) {
    return {
      score: null,
      label: "insufficient_evidence",
      coverage,
      agreementAdjustment: 0,
      includedCategories,
      excludedCategories,
    };
  }

  const weightedAverage =
    usable.reduce(
      (sum, category) => sum + clampScore(category.score) * category.baseWeight,
      0,
    ) / coverage;

  const agreementAdjustment = applyAgreementAdjustment(usable);
  const score = clampScore(weightedAverage + agreementAdjustment);

  return {
    score,
    label: labelForScore(score),
    coverage,
    agreementAdjustment,
    includedCategories,
    excludedCategories,
  };
}
