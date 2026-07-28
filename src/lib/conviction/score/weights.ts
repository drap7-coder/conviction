import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.1.0";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category.
 * Social removed from V1 — remaining weights renormalized to sum = 1.00
 */
export const CATEGORY_WEIGHTS = {
  institutional: 0.29,
  earnings: 0.29,
  technicals: 0.24,
  short_interest: 0.12,
  political: 0.06,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
