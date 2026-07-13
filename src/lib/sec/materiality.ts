/**
 * Materiality calculation for insider transactions.
 * All deterministic — no AI used for scoring.
 */

import type { InsiderTransaction } from "./types";
import { isDirectionalType } from "./types";

export interface MaterialityScore {
  score: number; // 0-1
  label: "high" | "medium" | "low";
  factors: MaterialityFactor[];
}

export interface MaterialityFactor {
  name: string;
  contribution: number; // 0-1
  description: string;
}

/**
 * Calculate materiality score for a single insider transaction.
 *
 * Factors:
 * 1. Transaction value (larger = more material)
 * 2. Insider role (CEO/CFO > director > officer > other)
 * 3. Open-market vs non-market (open-market carries more signal)
 * 4. Ownership change percentage (larger percentage = more material)
 * 5. Filing freshness (faster disclosure = more genuine)
 */
export function calculateMateriality(tx: InsiderTransaction): MaterialityScore {
  const factors: MaterialityFactor[] = [];
  let totalScore = 0;

  // 1. Transaction value factor (max contribution: 0.3)
  const valueScore = calculateValueScore(tx.totalValue ?? tx.shares * 100);
  factors.push({
    name: "transaction-value",
    contribution: valueScore * 0.3,
    description: valueScore > 0.7
      ? `Large transaction value (${formatValue(tx.totalValue)})`
      : `Moderate transaction value (${formatValue(tx.totalValue)})`,
  });
  totalScore += valueScore * 0.3;

  // 2. Insider role factor (max contribution: 0.2)
  const roleScore = calculateRoleScore(tx);
  factors.push({
    name: "insider-role",
    contribution: roleScore * 0.2,
    description: tx.isDirector
      ? "Director transaction"
      : tx.isOfficer
        ? `Officer transaction${tx.insiderRole ? ` (${tx.insiderRole})` : ""}`
        : "Non-executive transaction",
  });
  totalScore += roleScore * 0.2;

  // 3. Market transaction factor (max contribution: 0.25)
  const marketScore = isDirectionalType(tx.transactionType) ? 1.0 : 0.15;
  factors.push({
    name: "market-transaction",
    contribution: marketScore * 0.25,
    description: isDirectionalType(tx.transactionType)
      ? "Open-market transaction (high signal)"
      : "Non-market transaction (grant/award/exercise)",
  });
  totalScore += marketScore * 0.25;

  // 4. Ownership change factor (max contribution: 0.1)
  const changeScore = tx.ownershipChange !== null
    ? Math.min(1.0, tx.ownershipChange / 10)
    : 0.05;
  factors.push({
    name: "ownership-change",
    contribution: changeScore * 0.1,
    description: tx.ownershipChange !== null
      ? `${tx.ownershipChange.toFixed(2)}% ownership change`
      : "Ownership change unavailable",
  });
  totalScore += changeScore * 0.1;

  // 5. Filing freshness factor (max contribution: 0.1)
  const delayDays = calculateDelay(tx.transactionDate, tx.filingDate);
  const freshnessScore = Math.max(0, 1 - delayDays / 30);
  factors.push({
    name: "filing-freshness",
    contribution: freshnessScore * 0.1,
    description: `Filed ${delayDays} day${delayDays !== 1 ? "s" : ""} after transaction`,
  });
  totalScore += freshnessScore * 0.1;

  // Normalize to 0-1
  totalScore = Math.min(1, Math.max(0, totalScore));

  const label = totalScore >= 0.6 ? "high" : totalScore >= 0.3 ? "medium" : "low";

  return { score: totalScore, label, factors };
}

function calculateValueScore(value: number | null): number {
  if (!value || value <= 0) return 0;
  return Math.min(1.0, Math.log10(Math.max(10000, value) / 10000) / 3);
}

function calculateRoleScore(tx: InsiderTransaction): number {
  if (tx.insiderRole?.toLowerCase().includes("ceo") ||
      tx.insiderRole?.toLowerCase().includes("president") ||
      tx.insiderRole?.toLowerCase().includes("chief")) {
    return 1.0;
  }
  if (tx.isDirector) return 0.8;
  if (tx.isOfficer) return 0.6;
  if (tx.isTenPercentOwner) return 0.4;
  return 0.2;
}

function calculateDelay(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatValue(value: number | null): string {
  if (!value) return "unknown";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Detect clustered insider buying for emerging evidence.
 */
export function detectClusteredBuying(
  transactions: InsiderTransaction[],
  windowDays: number = 30,
): boolean {
  const purchases = transactions.filter(
    (t) => t.transactionType === "purchase",
  );
  if (purchases.length < 2) return false;

  const uniqueInsiders = new Set(purchases.map((p) => p.insiderName));
  if (uniqueInsiders.size < 2) {
    const dates = purchases.map((p) => new Date(p.transactionDate).getTime());
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);
    return (latest - earliest) / (1000 * 60 * 60 * 24) <= windowDays;
  }
  return true;
}

/**
 * Calculate total insider conviction score for a company.
 * Legacy: prefer calculateConviction from conviction-engine.ts.
 */
export function calculateInsiderConviction(
  transactions: InsiderTransaction[],
): number {
  if (transactions.length === 0) return 0;

  const directional = transactions.filter(
    (t) => isDirectionalType(t.transactionType),
  );
  if (directional.length === 0) return 0;

  const purchases = directional.filter((t) => t.transactionType === "purchase");
  const buyRatio = purchases.length / directional.length;

  const materialityScores = purchases.map((p) => calculateMateriality(p).score);
  const avgMateriality = materialityScores.length > 0
    ? materialityScores.reduce((a, b) => a + b, 0) / materialityScores.length
    : 0;

  const uniqueInsiders = new Set(directional.map((t) => t.insiderName)).size;

  return (buyRatio * 0.5 + avgMateriality * 0.3 + Math.min(1, uniqueInsiders / 3) * 0.2);
}