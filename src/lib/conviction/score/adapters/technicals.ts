/**
 * Normalize price/technical state into a CategoryScore.
 *
 * Structure (above/below SMA50/SMA200) dominates. 52-week range position,
 * SMA200 distance, and short-term momentum refine the score so clearly
 * bullish charts (above both averages near highs) land near +100.
 */

import {
  deriveTechnicalState,
  type StockHistoryPoint,
  type TechnicalState,
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

/** Trend structure from SMA relations — primary technical signal. */
function structureScore(tech: TechnicalState): number | null {
  if (tech.label === "Insufficient Data") return null;
  if (tech.sma50Relation === null && tech.sma200Relation === null) return null;

  if (tech.smaCrossRelation === "golden-cross") return 100;
  if (tech.smaCrossRelation === "death-cross") return -100;

  if (tech.sma50Relation === "above" && tech.sma200Relation === "above") return 100;
  if (tech.sma50Relation === "below" && tech.sma200Relation === "below") return -100;
  if (tech.sma50Relation === "above" && tech.sma200Relation === "below") return 35;
  if (tech.sma50Relation === "below" && tech.sma200Relation === "above") return -35;

  // Only one average available — lean on that relation.
  if (tech.sma200Relation === null && tech.sma50Relation === "above") return 55;
  if (tech.sma200Relation === null && tech.sma50Relation === "below") return -55;
  if (tech.sma50Relation === null && tech.sma200Relation === "above") return 55;
  if (tech.sma50Relation === null && tech.sma200Relation === "below") return -55;

  return 0;
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

  const weighted: Array<{ weight: number; value: number }> = [];
  const structure = structureScore(tech);
  if (structure !== null) {
    weighted.push({ weight: 0.45, value: structure });
  }
  if (tech.fiftyTwoWeekPercentile !== null) {
    weighted.push({
      weight: 0.25,
      value: clampSignedScore((tech.fiftyTwoWeekPercentile - 50) * 2),
    });
  }
  if (tech.sma200Delta !== null) {
    weighted.push({
      weight: 0.2,
      value: clampSignedScore(tech.sma200Delta * 4),
    });
  } else if (tech.sma50Delta !== null) {
    weighted.push({
      weight: 0.2,
      value: clampSignedScore(tech.sma50Delta * 4),
    });
  }
  if (tech.shortTermTrend !== null) {
    weighted.push({
      weight: 0.1,
      value: clampSignedScore(tech.shortTermTrend * 8),
    });
  }

  const sourceDate =
    points.length > 0
      ? points[points.length - 1]?.date ?? null
      : null;

  if (weighted.length === 0 || tech.label === "Insufficient Data") {
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

  const totalWeight = weighted.reduce((sum, part) => sum + part.weight, 0);
  const score = clampSignedScore(
    weighted.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
  );
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
