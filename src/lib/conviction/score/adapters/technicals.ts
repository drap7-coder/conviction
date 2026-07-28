/**
 * Normalize price/technical state into a CategoryScore.
 * Combines short-term trend, SMA-50 distance, and 52-week range position
 * using the same signed clamps already used in the canonical model.
 */

import {
  deriveTechnicalState,
  type StockHistoryPoint,
} from "@/lib/market/technical-state";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

/** Price history goes stale faster than filings. */
const TECHNICAL_STALE_DAYS = 7;

export interface TechnicalCategoryInput {
  points: StockHistoryPoint[];
  currentPrice?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  fetchedAt?: string | null;
}

export function toTechnicalsCategoryScore(
  ticker: string,
  input: TechnicalCategoryInput,
  now = new Date(),
): CategoryScore {
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const points = Array.isArray(input.points) ? input.points : [];
  const tech = deriveTechnicalState(
    points,
    input.currentPrice ?? null,
    input.fiftyTwoWeekHigh ?? null,
    input.fiftyTwoWeekLow ?? null,
  );

  const parts: number[] = [];
  if (tech.shortTermTrend !== null) {
    parts.push(clampSignedScore(tech.shortTermTrend * 3));
  }
  if (tech.sma50Delta !== null) {
    parts.push(clampSignedScore(tech.sma50Delta * 2));
  }
  if (tech.fiftyTwoWeekPercentile !== null) {
    parts.push(clampSignedScore((tech.fiftyTwoWeekPercentile - 50) * 2));
  }

  const sourceDate =
    points.length > 0
      ? points[points.length - 1]?.date ?? null
      : null;

  if (parts.length === 0 || tech.label === "Insufficient Data") {
    return {
      ticker: ticker.toUpperCase(),
      category: "technicals",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.technicals,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation: "Not enough trading history for a technical score.",
      scoringVersion: SCORING_VERSION,
    };
  }

  const score = clampSignedScore(parts.reduce((sum, part) => sum + part, 0) / parts.length);
  const isStale = isSourceStale(sourceDate, now, TECHNICAL_STALE_DAYS);

  return {
    ticker: ticker.toUpperCase(),
    category: "technicals",
    score,
    baseWeight: CATEGORY_WEIGHTS.technicals,
    hasData: true,
    isStale,
    sourceDate,
    updatedAt,
    explanation: isStale
      ? `${tech.interpretation} Evidence is stale and excluded from the composite.`
      : tech.interpretation,
    scoringVersion: SCORING_VERSION,
  };
}
