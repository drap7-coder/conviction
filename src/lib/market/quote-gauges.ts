/**
 * Score institutional 13F activity into a 0–100 conviction ring.
 * Green = accumulating, amber = holding, red = distributing.
 */

import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { summarizeInstitutionalEvidence } from "@/lib/sec/institutional";
import type { GaugeTone } from "@/components/GaugeRing";

export interface ConvictionRingScore {
  score: number | null;
  tone: GaugeTone;
  label: "Accumulating" | "Holding" | "Distribution" | "Unavailable";
  detail: string;
  added: number;
  reduced: number;
  newPositions: number;
  filingQuarter: string | null;
}

/**
 * Map 13F manager moves to a 0–100 score centered at 50 (holding).
 */
export function scoreInstitutionalConviction(
  results: InstitutionalAccumulation[],
): ConvictionRingScore {
  if (results.length === 0) {
    return {
      score: null,
      tone: "neutral",
      label: "Unavailable",
      detail: "No tracked manager filings for this name yet.",
      added: 0,
      reduced: 0,
      newPositions: 0,
      filingQuarter: null,
    };
  }

  const summary = summarizeInstitutionalEvidence(results);
  let score = 50;

  for (const result of results) {
    if (result.status === "New") score += 14;
    else if (result.status === "Increased") score += 9;
    else if (result.status === "Reduced") score -= 9;
    else if (result.status === "Exited") score -= 14;
  }

  // Soft tilt from aggregate share change magnitude.
  const magnitude = Math.min(Math.abs(summary.aggregateShareChange) / 1_000_000, 8);
  if (summary.aggregateShareChange > 0) score += magnitude;
  if (summary.aggregateShareChange < 0) score -= magnitude;

  score = Math.round(Math.max(0, Math.min(100, score)));
  const filingQuarter = results[0]?.filingQuarter ?? null;
  const added = summary.increased.length;
  const reduced = summary.reduced.length + summary.exited.length;
  const newPositions = summary.newPositions.length;

  if (score >= 60) {
    return {
      score,
      tone: "green",
      label: "Accumulating",
      detail: `${summary.positiveCount} tracked manager${summary.positiveCount === 1 ? "" : "s"} adding or opening.`,
      added,
      reduced,
      newPositions,
      filingQuarter,
    };
  }
  if (score <= 40) {
    return {
      score,
      tone: "red",
      label: "Distribution",
      detail: `${summary.negativeCount} tracked manager${summary.negativeCount === 1 ? "" : "s"} trimming or exiting.`,
      added,
      reduced,
      newPositions,
      filingQuarter,
    };
  }
  return {
    score,
    tone: "amber",
    label: "Holding",
    detail: "Tracked managers are mostly holding steady.",
    added,
    reduced,
    newPositions,
    filingQuarter,
  };
}

/** Position of `price` within [low, high] as 0–100. */
export function rangePosition(
  price: number | null,
  low: number | null,
  high: number | null,
): number | null {
  if (
    price === null ||
    low === null ||
    high === null ||
    !Number.isFinite(price) ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high === low
  ) {
    return null;
  }
  return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
}

/**
 * Volume as a percent of average (100 = at average).
 * Ring fill is clamped 0–100; label can still show higher.
 */
export function volumeVsAverage(
  volume: number | null,
  average: number | null,
): number | null {
  if (
    volume === null ||
    average === null ||
    !Number.isFinite(volume) ||
    !Number.isFinite(average) ||
    average <= 0
  ) {
    return null;
  }
  return (volume / average) * 100;
}
