/**
 * Reliance 0–100: how much one idea has to be right.
 *
 * High = concentrated. Reuses the same marks as computeConcentration /
 * computeRiskFlags (12 elevated / 20 single-name / 35 sector / 60 top-three).
 * Not Conviction Score (per-ticker). Not resilience. Not inverted into a health grade.
 */

import {
  rankedHoldings,
  shortExposureLabel,
  type BookHolding,
} from "@/lib/portfolio/sleeves";

export type RelianceTone = "balanced" | "watch" | "concentrated" | "neutral";

export type RelianceResult = {
  score: number;
  largest: { ticker: string; weight: number } | null;
  largestSleeve: { label: string; weight: number } | null;
  topThreeWeight: number;
  line: string;
  summary: string;
  tone: RelianceTone;
};

export function computeReliance(holdings: BookHolding[]): RelianceResult {
  const ranked = rankedHoldings(holdings);
  if (ranked.length === 0) {
    return {
      score: 0,
      largest: null,
      largestSleeve: null,
      topThreeWeight: 0,
      line: "Reliance —",
      summary: "Weights resolve when quotes land.",
      tone: "neutral",
    };
  }

  const largest = { ticker: ranked[0].ticker, weight: ranked[0].weight };
  const topThreeWeight = ranked.slice(0, 3).reduce((sum, row) => sum + row.weight, 0);

  const sleeves = new Map<string, number>();
  for (const row of ranked) {
    if (!row.exposure) continue;
    sleeves.set(row.exposure, (sleeves.get(row.exposure) ?? 0) + row.weight);
  }
  const largestSleeve = [...sleeves.entries()]
    .map(([label, weight]) => ({ label, weight }))
    .sort((a, b) => b.weight - a.weight)[0] ?? null;

  const score = relianceScore({
    largestWeight: largest.weight,
    largestSleeveWeight: largestSleeve?.weight ?? 0,
    topThreeWeight,
    elevated: ranked.some((row) => row.weight > 12),
  });

  const sleeveBit = largestSleeve
    ? ` · ${shortExposureLabel(largestSleeve.label)} ${largestSleeve.weight.toFixed(0)}%`
    : "";
  const line = `Reliance ${score} · ${largest.ticker} ${largest.weight.toFixed(0)}%${sleeveBit}`;
  const swing = `A 20% move swings the book ~${(largest.weight * 0.2).toFixed(1)}%.`;
  const tone: RelianceTone = score >= 70 ? "concentrated" : score >= 45 ? "watch" : "balanced";

  return {
    score,
    largest,
    largestSleeve,
    topThreeWeight,
    line,
    summary: `${line}. ${swing}`,
    tone,
  };
}

/**
 * Piecewise blend around the risk-flag marks.
 * Hitting 20% / 35% / 60% scores; going past them keeps adding — never inverted.
 */
export function relianceScore(input: {
  largestWeight: number;
  largestSleeveWeight: number;
  topThreeWeight: number;
  elevated: boolean;
}): number {
  const namePts = 28 * Math.min(1, input.largestWeight / 20);
  const nameOver = 16 * Math.max(0, (input.largestWeight - 20) / 80);
  const elevatedPts = input.elevated ? 10 * Math.min(1, input.largestWeight / 12) : 0;
  const sectorPts = 22 * Math.min(1, input.largestSleeveWeight / 35);
  const sectorOver = 12 * Math.max(0, (input.largestSleeveWeight - 35) / 65);
  const clusterPts = 8 * Math.min(1, input.topThreeWeight / 60);
  const clusterOver = 4 * Math.max(0, (input.topThreeWeight - 60) / 40);

  return clamp(0, 100, Math.round(
    namePts + nameOver + elevatedPts + sectorPts + sectorOver + clusterPts + clusterOver,
  ));
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}
