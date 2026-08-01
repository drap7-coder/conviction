/**
 * Normalize Form 4 insider conviction into a CategoryScore.
 * Uses the existing calculateConviction engine — open-market buys/sells only.
 */

import { calculateConviction } from "@/lib/sec/conviction-engine";
import type { InsiderTransaction } from "@/lib/sec/types";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

export interface InsiderCategoryInput {
  transactions: InsiderTransaction[];
  status?: string | null;
  fetchedAt?: string | null;
  message?: string | null;
}

function latestSourceDate(transactions: InsiderTransaction[]): string | null {
  const dates = transactions
    .map((tx) => tx.transactionDate || tx.filingDate)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => b.localeCompare(a));
  return dates[0] ?? null;
}

/**
 * Map engine netScore onto [-100, +100].
 * Engine units are roughly "points per $100K" with role multipliers —
 * tanh keeps mega Form 4 clusters from saturating every name at ±100.
 */
export function mapInsiderNetScore(netScore: number): number {
  return clampSignedScore(Math.tanh(netScore / 80) * 100);
}

export function toInsiderCategoryScore(
  ticker: string,
  input: InsiderCategoryInput,
  now = new Date(),
): CategoryScore {
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const failed = input.status === "timeout" || input.status === "error";
  const transactions = input.transactions ?? [];
  const conviction = calculateConviction(transactions);
  const hasSignal = !failed && conviction.contributingTransactions > 0;

  if (!hasSignal) {
    return {
      ticker: ticker.toUpperCase(),
      category: "insider",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.insider,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        input.message
        ?? (failed
          ? "Insider Form 4 filings could not be loaded."
          : "No meaningful open-market Form 4 activity in the scoring window."),
      scoringVersion: SCORING_VERSION,
    };
  }

  const score = mapInsiderNetScore(conviction.netScore);
  const sourceDate = latestSourceDate(transactions);
  const isStale = isSourceStale(sourceDate, now);
  const purchased = conviction.totalPurchased;
  const sold = conviction.totalSold;
  const explanation =
    conviction.label === "bullish"
      ? `Insider open-market buying (${conviction.contributingTransactions} filings · $${Math.round(purchased).toLocaleString()} bought).`
      : conviction.label === "bearish"
        ? `Insider open-market selling (${conviction.contributingTransactions} filings · $${Math.round(sold).toLocaleString()} sold).`
        : `Mixed insider Form 4 flow (net ${conviction.netScore > 0 ? "+" : ""}${conviction.netScore}).`;

  return {
    ticker: ticker.toUpperCase(),
    category: "insider",
    score,
    baseWeight: CATEGORY_WEIGHTS.insider,
    hasData: true,
    isStale,
    sourceDate,
    updatedAt,
    explanation: isStale
      ? `${explanation} Evidence is stale and excluded from the composite.`
      : explanation,
    scoringVersion: SCORING_VERSION,
  };
}
