/**
 * Normalize Form 4 insider conviction into a CategoryScore.
 *
 * Only open-market purchases count. Insider sales (liquidity / tax / 10b5-1)
 * are ignored — they are not treated as a bearish conviction signal.
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

/** Purchases only — sales never enter the Conviction Score. */
function purchaseTransactions(
  transactions: InsiderTransaction[],
): InsiderTransaction[] {
  return transactions.filter((tx) => tx.transactionType === "purchase");
}

/**
 * Map purchase-driven engine netScore onto [0, +100].
 * Negatives should not appear once sales are filtered out.
 */
export function mapInsiderNetScore(netScore: number): number {
  if (netScore <= 0) return 0;
  return clampSignedScore(Math.tanh(netScore / 80) * 100);
}

export function toInsiderCategoryScore(
  ticker: string,
  input: InsiderCategoryInput,
  now = new Date(),
): CategoryScore {
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const failed = input.status === "timeout" || input.status === "error";
  const purchases = purchaseTransactions(input.transactions ?? []);
  const conviction = calculateConviction(purchases);
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
          : "No open-market insider purchases in the scoring window (sales ignored)."),
      scoringVersion: SCORING_VERSION,
    };
  }

  const score = mapInsiderNetScore(conviction.netScore);
  const sourceDate = latestSourceDate(purchases);
  const isStale = isSourceStale(sourceDate, now);
  const purchased = conviction.totalPurchased;
  const explanation = `Insider open-market buying (${conviction.contributingTransactions} filings · $${Math.round(purchased).toLocaleString()} bought).`;

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
