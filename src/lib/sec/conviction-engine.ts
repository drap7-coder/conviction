/**
 * Conviction engine — calculates insider conviction signal from Form 4 transactions.
 *
 * Only economically meaningful transactions affect the score:
 * - Open-market purchases: +100 per $100K, role-multiplied
 * - Open-market sales: -40 per $100K, role-multiplied
 * - Grants, exercises, tax withholding: ignored (routine compensation)
 */

import type { InsiderTransaction } from "./types";
import { isDirectionalType } from "./types";
import { TX_WEIGHTS, ROLE_MULTIPLIERS, CONVICTION_WINDOW_DAYS, MIN_VALUE_THRESHOLD } from "./conviction-config";

export interface ConvictionScore {
  /** Net conviction score (positive = bullish, negative = bearish) */
  netScore: number;
  /** Human-readable label */
  label: "bullish" | "bearish" | "neutral" | "no_signal";
  /** Total dollar value of open-market purchases in the window */
  totalPurchased: number;
  /** Total dollar value of open-market sales in the window */
  totalSold: number;
  /** Net shares purchased (purchase shares - sale shares) */
  netShares: number;
  /** Number of meaningful transactions */
  meaningfulCount: number;
  /** Breakdown by transaction type within the scoring window */
  breakdown: ConvictionBreakdownItem[];
  /** Transactions that contributed to the score */
  contributingTransactions: number;
}

export interface ConvictionBreakdownItem {
  type: string;
  label: string;
  count: number;
  totalShares: number;
  totalValue: number | null;
  score: number;
}

/**
 * Calculate conviction score for a company's insider transactions.
 * Only considers transactions within the conviction window.
 */
export function calculateConviction(transactions: InsiderTransaction[]): ConvictionScore {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CONVICTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Filter to scoring window
  const windowed = transactions.filter(
    (t) => t.transactionDate >= cutoffStr && isDirectionalType(t.transactionType),
  );

  if (windowed.length === 0) {
    return {
      netScore: 0,
      label: "no_signal",
      totalPurchased: 0,
      totalSold: 0,
      netShares: 0,
      meaningfulCount: 0,
      breakdown: [],
      contributingTransactions: 0,
    };
  }

  const breakdown: ConvictionBreakdownItem[] = [];
  let totalPurchased = 0;
  let totalSold = 0;
  let netShares = 0;
  let netScore = 0;
  let contributingCount = 0;

  // Group by type
  const byType = new Map<string, InsiderTransaction[]>();
  for (const tx of windowed) {
    const key = tx.transactionType;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(tx);
  }

  for (const [type, txs] of byType) {
    const weight = TX_WEIGHTS[type as keyof typeof TX_WEIGHTS] || TX_WEIGHTS.other;
    let totalShares = 0;
    let totalValue = 0;
    let score = 0;

    for (const tx of txs) {
      totalShares += tx.shares;

      // Apply minimum value threshold for directional transactions
      if (weight.meaningful && (tx.totalValue ?? 0) < MIN_VALUE_THRESHOLD) {
        continue;
      }

      const roleMultiplier = getRoleMultiplier(tx);
      const txScore = (tx.totalValue ?? tx.shares * 100) / 100_000 * weight.base * roleMultiplier;
      score += txScore;
      contributingCount++;

      if (tx.transactionType === "purchase") {
        totalPurchased += tx.totalValue ?? tx.shares * 100;
        netShares += tx.shares;
      } else {
        totalSold += tx.totalValue ?? tx.shares * 100;
        netShares -= tx.shares;
      }
    }

    netScore += score;

    breakdown.push({
      type,
      label: weight.label,
      count: txs.length,
      totalShares,
      totalValue: totalValue > 0 ? totalValue : null,
      score: Math.round(score),
    });
  }

  // Sort breakdown: highest scoring first
  breakdown.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const label = netScore >= 50 ? "bullish" : netScore <= -50 ? "bearish" : "neutral";

  return {
    netScore: Math.round(netScore * 10) / 10,
    label,
    totalPurchased: Math.round(totalPurchased * 100) / 100,
    totalSold: Math.round(totalSold * 100) / 100,
    netShares,
    meaningfulCount: windowed.length,
    breakdown,
    contributingTransactions: contributingCount,
  };
}

/**
 * Get the role multiplier for an insider transaction.
 */
function getRoleMultiplier(tx: InsiderTransaction): number {
  // Check role title patterns first (most specific)
  for (const rule of ROLE_MULTIPLIERS.roleTitleMatch ?? []) {
    if (tx.insiderRole && rule.pattern.test(tx.insiderRole)) {
      return rule.multiplier;
    }
  }

  if (tx.isDirector && tx.isOfficer) {
    return 2.0; // Director + officer (e.g., CEO is also director)
  }
  if (tx.isDirector) return ROLE_MULTIPLIERS.isDirector ?? 1.0;
  if (tx.isOfficer) return ROLE_MULTIPLIERS.isOfficer ?? 0.8;
  return 0.5; // 10% owner or other
}

/**
 * Calculate net insider shares (purchases - sales) within the window.
 */
export function calculateNetInsiderShares(transactions: InsiderTransaction[]): number {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CONVICTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let net = 0;
  for (const tx of transactions) {
    if (tx.transactionDate < cutoffStr) continue;
    if (tx.transactionType === "purchase") net += tx.shares;
    else if (tx.transactionType === "sale") net -= tx.shares;
  }
  return net;
}

/**
 * Get a summary counts string for display.
 */
export function summarizeTransactions(transactions: InsiderTransaction[]): {
  purchases: number;
  sales: number;
  grants: number;
  options: number;
  others: number;
} {
  const summary = { purchases: 0, sales: 0, grants: 0, options: 0, others: 0 };
  for (const tx of transactions) {
    switch (tx.transactionType) {
      case "purchase": summary.purchases++; break;
      case "sale": summary.sales++; break;
      case "grant": summary.grants++; break;
      case "option_exercise": summary.options++; break;
      default: summary.others++;
    }
  }
  return summary;
}