/**
 * Normalize earnings-momentum evidence into a CategoryScore.
 * Passes through the existing signed score (-100..+100) unchanged.
 */

import type { EarningsEvidence } from "@/lib/earnings/types";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

export function toEarningsCategoryScore(
  evidence: EarningsEvidence,
  now = new Date(),
): CategoryScore {
  const updatedAt = now.toISOString();
  const hasData =
    evidence.status !== "unavailable"
    && evidence.score !== null
    && Number.isFinite(evidence.score);

  if (!hasData) {
    return {
      ticker: evidence.ticker.toUpperCase(),
      category: "earnings",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.earnings,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        evidence.message
        ?? "Earnings evidence is unavailable and is not included in the score.",
      scoringVersion: SCORING_VERSION,
    };
  }

  const score = clampSignedScore(evidence.score!);
  const sourceDate = evidence.asOf;
  const isStale = isSourceStale(sourceDate, now);
  const historyPart =
    evidence.historyScore !== null ? `history ${evidence.historyScore}` : "history n/a";
  const revisionPart =
    evidence.revisionScore !== null ? `revisions ${evidence.revisionScore}` : "revisions n/a";

  return {
    ticker: evidence.ticker.toUpperCase(),
    category: "earnings",
    score,
    baseWeight: CATEGORY_WEIGHTS.earnings,
    hasData: true,
    isStale,
    sourceDate,
    updatedAt,
    explanation: isStale
      ? `${evidence.momentum}; ${historyPart}, ${revisionPart}. Evidence is stale and excluded from the composite.`
      : `${evidence.momentum}; ${historyPart}, ${revisionPart}.`,
    scoringVersion: SCORING_VERSION,
  };
}
