import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.3.0";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category.
 * Social, political, and earnings removed — remaining weights renormalized to sum = 1.00
 */
export const CATEGORY_WEIGHTS = {
  institutional: 0.45,
  technicals: 0.38,
  short_interest: 0.17,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
