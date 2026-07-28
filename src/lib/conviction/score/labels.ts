import type { ConvictionScoreLabel } from "./types";

/**
 * Map a composite score (or null) to a display label.
 *
 * Boundaries (inclusive):
 *   +60…+100  strong_positive
 *   +25…+59   positive
 *   -24…+24   mixed
 *   -25…-59   negative
 *   -60…-100  strong_negative
 *   null      insufficient_evidence
 */
export function labelForScore(score: number | null): ConvictionScoreLabel {
  if (score === null) return "insufficient_evidence";
  if (score >= 60) return "strong_positive";
  if (score >= 25) return "positive";
  if (score >= -24) return "mixed";
  if (score >= -59) return "negative";
  return "strong_negative";
}
