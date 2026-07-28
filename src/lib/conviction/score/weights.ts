import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.0.0";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category.
 * Sum = 1.00
 */
export const CATEGORY_WEIGHTS = {
  institutional: 0.25,
  earnings: 0.25,
  technicals: 0.2,
  short_interest: 0.1,
  political: 0.05,
  social: 0.15,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
