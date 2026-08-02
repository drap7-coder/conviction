/**
 * Score institutional 13F activity into a 0–100 conviction ring.
 * Green = accumulating, amber = holding, red = distributing.
 *
 * Moves are dollar-weighted and style-tilted (durable > other > trading)
 * so Berkshire-sized books are not equal to tiny trading books.
 */

import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { summarizeInstitutionalEvidence } from "@/lib/sec/institutional";
import type { GaugeTone } from "@/components/GaugeRing";
import {
  institutionalDollarWeight,
  managerStyleMultiplier,
} from "@/lib/conviction/score/manager-style";

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

const STATUS_DELTA: Record<InstitutionalAccumulation["status"], number> = {
  New: 14,
  Increased: 9,
  Unchanged: 0,
  Reduced: -9,
  Exited: -14,
};

function rowFlowWeight(row: InstitutionalAccumulation): number {
  return institutionalDollarWeight(row) * managerStyleMultiplier(row.manager);
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
  const weights = results.map(rowFlowWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  let score = 50;
  results.forEach((result, index) => {
    // Preserve average per-manager contribution when weights are equal.
    const relative = (weights[index]! / totalWeight) * results.length;
    score += (STATUS_DELTA[result.status] ?? 0) * relative;
  });

  // Soft tilt from aggregate share change magnitude.
  const magnitude = Math.min(Math.abs(summary.aggregateShareChange) / 1_000_000, 8);
  if (summary.aggregateShareChange > 0) score += magnitude;
  if (summary.aggregateShareChange < 0) score -= magnitude;

  score = Math.round(Math.max(0, Math.min(100, score)));
  const filingQuarter = results[0]?.filingQuarter ?? null;
  const added = summary.increased.length;
  const reduced = summary.reduced.length + summary.exited.length;
  const newPositions = summary.newPositions.length;

  const addingCount = summary.positiveCount;
  const cuttingCount = summary.negativeCount;

  if (score >= 60) {
    return {
      score,
      tone: "green",
      label: "Accumulating",
      detail: `${addingCount} tracked manager${addingCount === 1 ? "" : "s"} adding or opening.`,
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
      detail: `${cuttingCount} tracked manager${cuttingCount === 1 ? "" : "s"} trimming or exiting.`,
      added,
      reduced,
      newPositions,
      filingQuarter,
    };
  }

  // Holding band — but mixed adds/cuts should not read as "steady".
  let holdingDetail = "Tracked managers are mostly holding steady.";
  if (addingCount > 0 && cuttingCount > 0) {
    holdingDetail = `${addingCount} adding or opening, ${cuttingCount} trimming or exiting.`;
  } else if (addingCount > 0) {
    holdingDetail = `${addingCount} tracked manager${addingCount === 1 ? "" : "s"} adding, but the book is still near holding.`;
  } else if (cuttingCount > 0) {
    holdingDetail = `${cuttingCount} tracked manager${cuttingCount === 1 ? "" : "s"} trimming, but the book is still near holding.`;
  }

  return {
    score,
    tone: "amber",
    label: "Holding",
    detail: holdingDetail,
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
