import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.4.0";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category.
 * Institutional 13F split into hedge funds vs investment funds.
 * Weights sum = 1.00
 */
export const CATEGORY_WEIGHTS = {
  hedge_funds: 0.25,
  investment_funds: 0.20,
  technicals: 0.38,
  short_interest: 0.17,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
