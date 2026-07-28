/**
 * Shared Conviction Score contract.
 *
 * Every evidence source must normalize into CategoryScore before
 * contributing to calculateConvictionScore. Keep this module free of
 * React, API routes, DB clients, and live data adapters.
 */

export type EvidenceCategory =
  | "institutional"
  | "earnings"
  | "technicals"
  | "short_interest"
  | "political"
  | "social";

export interface CategoryScore {
  ticker: string;
  category: EvidenceCategory;

  /** Signed contribution in [-100, +100]. */
  score: number;
  /** Original model weight (decimal), e.g. 0.25. */
  baseWeight: number;

  /**
   * false — no usable evidence exists for this category.
   * true + isStale false — evidence may influence the composite.
   * true + isStale true — evidence exists but must not influence the score.
   */
  hasData: boolean;
  isStale: boolean;

  sourceDate: string | null;
  updatedAt: string;

  explanation: string;
  scoringVersion: string;
}

export type ConvictionScoreLabel =
  | "strong_positive"
  | "positive"
  | "mixed"
  | "negative"
  | "strong_negative"
  | "insufficient_evidence";

export interface ConvictionScoreResult {
  score: number | null;
  label: ConvictionScoreLabel;
  coverage: number;
  agreementAdjustment: number;
  includedCategories: EvidenceCategory[];
  excludedCategories: EvidenceCategory[];
}
