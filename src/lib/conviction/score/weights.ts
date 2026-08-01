import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.5.2";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category (sum = 1.00).
 * Size regimes may reweight these before the composite average.
 * Quality factors remain a separate half of the 65/35 blend.
 *
 * technicals + short_interest = 0.50 so mega-caps without Form 4 buys
 * (and often without fresh 13F) still clear MIN_COVERAGE — insider is
 * purchases-only and must not be required for a score to appear.
 */
export const CATEGORY_WEIGHTS = {
  institutional: 0.34,
  insider: 0.16,
  technicals: 0.36,
  short_interest: 0.14,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
