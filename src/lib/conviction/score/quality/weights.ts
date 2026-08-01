import type { QualityFactorId } from "./types";

/** Quality share of the final blended Conviction Score. */
export const QUALITY_BLEND_WEIGHT = 0.65;

/** Evidence (calculateConvictionScore) share of the final blend. */
export const EVIDENCE_BLEND_WEIGHT = 0.35;

/** Minimum quality-factor weight coverage before qualityComposite is returned. */
export const QUALITY_MIN_COVERAGE = 0.35;

/**
 * Fixed base weights for quality factors (sum = 1.00).
 * These update slowly (annual/quarterly) and answer "is this company good."
 */
export const QUALITY_FACTOR_WEIGHTS = {
  margin_moat: 0.22,
  balance_sheet: 0.2,
  fcf_strength: 0.18,
  earnings_consistency: 0.2,
  ownership_base: 0.12,
  capital_return: 0.08,
} as const satisfies Record<QualityFactorId, number>;

export const QUALITY_FACTORS = Object.keys(
  QUALITY_FACTOR_WEIGHTS,
) as QualityFactorId[];
