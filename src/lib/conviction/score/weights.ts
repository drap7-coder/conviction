import type { EvidenceCategory } from "./types";

/** Version of this composite scoring contract. Bump when the formula changes. */
export const SCORING_VERSION = "1.2.0";

/** Minimum weight coverage required before a composite score is returned. */
export const MIN_COVERAGE = 0.5;

/**
 * Fixed base weights for each evidence category.
 * Social and political removed from V1 — remaining weights renormalized to sum = 1.00
 */
export const CATEGORY_WEIGHTS = {
  institutional: 0.31,
  earnings: 0.31,
  technicals: 0.26,
  short_interest: 0.12,
} as const satisfies Record<EvidenceCategory, number>;

export const EVIDENCE_CATEGORIES = Object.keys(
  CATEGORY_WEIGHTS,
) as EvidenceCategory[];
