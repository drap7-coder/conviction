/**
 * Converts SEC InsiderTransaction records into Conviction EvidenceEvent format.
 * Only AI explanation is non-deterministic — everything else is rule-based.
 */

import type { InsiderTransaction } from "./types";
import { isDirectionalType, TX_TYPE_LABELS } from "./types";
import { calculateMateriality } from "./materiality";
import { calculateConviction, summarizeTransactions } from "./conviction-engine";
import type { EvidenceEvent, ReasonCode, EmergingIdea } from "@/lib/evidence/types";

/**
 * Convert an InsiderTransaction to an EvidenceEvent for the conviction UI.
 */
export function insiderToEvidenceEvent(
  tx: InsiderTransaction,
  aiExplanation?: string,
): EvidenceEvent {
  const materiality = calculateMateriality(tx);
  const isDirectional = isDirectionalType(tx.transactionType);
  const isBuy = tx.transactionType === "purchase";

  const direction = isDirectional
    ? isBuy ? "positive" as const : "negative" as const
    : "neutral" as const;

  const type = isDirectional
    ? isBuy ? "insider-buy" as const : "insider-sell" as const
    : "insider-buy" as const;

  const actionLabel = TX_TYPE_LABELS[tx.transactionType] || "Insider transaction";
  const valueStr = tx.totalValue
    ? tx.totalValue >= 1_000_000
      ? `$${(tx.totalValue / 1_000_000).toFixed(1)}M`
      : `$${(tx.totalValue / 1_000).toFixed(0)}K`
    : `${tx.shares.toLocaleString()} shares`;

  const title = `${actionLabel} — ${tx.insiderName} ${direction === "positive" ? "acquired" : direction === "negative" ? "disposed" : "transacted"} ${valueStr}`;

  const roleStr = tx.insiderRole ? ` (${tx.insiderRole})` : "";
  const ownershipStr = tx.sharesOwnedAfter
    ? `. Holds ${tx.sharesOwnedAfter.toLocaleString()} shares after.`
    : "";
  const summary = `${tx.insiderName}${roleStr} in ${tx.ticker}${ownershipStr}`;

  const delayMs = new Date(tx.filingDate).getTime() - new Date(tx.transactionDate).getTime();
  const disclosureDelay = Math.max(0, Math.round(delayMs / (1000 * 60 * 60 * 24)));

  const strength = materiality.score * (isDirectional ? 1.0 : 0.3);
  const isContradiction = direction === "negative" && isDirectional;

  const explanation = aiExplanation || generateDefaultExplanation(tx, materiality);

  return {
    id: tx.id,
    ticker: tx.ticker,
    type,
    direction,
    title,
    summary,
    source: "sec-edgar",
    sourceUrl: tx.filingUrl,
    date: tx.transactionDate,
    disclosureDelay,
    size: materiality.score,
    strength,
    isContradiction,
    aiExplanation: explanation,
    metadata: {
      insiderName: tx.insiderName,
      insiderRole: tx.insiderRole,
      transactionClass: tx.transactionType,
      transactionType: tx.transactionType,
      shares: tx.shares,
      totalValue: tx.totalValue,
      sharesOwnedAfter: tx.sharesOwnedAfter,
    },
  };
}

/**
 * Generate a deterministic default explanation when AI is unavailable.
 */
function generateDefaultExplanation(
  tx: InsiderTransaction,
  materiality: ReturnType<typeof calculateMateriality>,
): string {
  const parts: string[] = [];

  if (isDirectionalType(tx.transactionType)) {
    if (tx.transactionType === "purchase") {
      parts.push(`${tx.insiderName} purchased ${tx.shares.toLocaleString()} shares at market price.`);
    } else {
      parts.push(`${tx.insiderName} sold ${tx.shares.toLocaleString()} shares on the open market.`);
    }
  } else {
    parts.push(`${tx.insiderName} reported a ${TX_TYPE_LABELS[tx.transactionType]?.toLowerCase() || "transaction"}.`);
  }

  if (tx.totalValue) {
    parts.push(`Transaction value: $${tx.totalValue.toLocaleString()}.`);
  }

  if (tx.ownershipChange !== null && tx.ownershipChange > 0.1) {
    parts.push(`Represents a ${tx.ownershipChange.toFixed(2)}% change in ownership.`);
  }

  if (tx.insiderRole) {
    parts.push(`Role: ${tx.insiderRole}.`);
  }

  parts.push(`Materiality: ${(materiality.score * 100).toFixed(0)}% (${materiality.label}).`);

  return parts.join(" ");
}

/**
 * Check if a company qualifies for emerging evidence based on insider activity.
 */
export function getEmergingReasonCodes(
  transactions: InsiderTransaction[],
  ticker: string,
  companyName: string,
): { qualify: boolean; reasonCodes: ReasonCode[] } {
  if (transactions.length === 0) return { qualify: false, reasonCodes: [] };

  const conviction = calculateConviction(transactions);
  const reasonCodes: ReasonCode[] = [];

  if (conviction.label === "bullish") {
    reasonCodes.push({
      code: "insider-conviction-bullish",
      label: `Bullish insider conviction (${conviction.netScore > 0 ? "+" : ""}${conviction.netScore})`,
      positive: true,
      strength: Math.min(1, conviction.netScore / 300),
    });
  }

  const purchases = transactions.filter((t) => t.transactionType === "purchase");
  const uniqueBuyers = new Set(purchases.map((p) => p.insiderName));
  if (uniqueBuyers.size >= 2 && purchases.length >= 2) {
    reasonCodes.push({
      code: "clustered-insider",
      label: "Clustered insider buying from SEC Form 4",
      positive: true,
      strength: Math.min(1, conviction.netScore / 200 + 0.2),
    });
  }

  for (const purchase of purchases) {
    const materiality = calculateMateriality(purchase);
    if (materiality.score >= 0.7) {
      reasonCodes.push({
        code: "large-insider-purchase",
        label: `Large purchase by ${purchase.insiderName}`,
        positive: true,
        strength: materiality.score,
      });
      break;
    }
  }

  if (conviction.label === "bearish") {
    reasonCodes.push({
      code: "insider-conviction-bearish",
      label: `Bearish insider conviction (${conviction.netScore})`,
      positive: false,
      strength: Math.min(1, Math.abs(conviction.netScore) / 200),
    });
  }

  return {
    qualify: reasonCodes.some((r) => r.positive),
    reasonCodes,
  };
}

/**
 * Build an EmergingIdea from insider transactions.
 */
export function insiderTransactionsToEmergingIdea(
  transactions: InsiderTransaction[],
  ticker: string,
  name: string,
  sector: string,
): EmergingIdea | null {
  const { qualify, reasonCodes } = getEmergingReasonCodes(transactions, ticker, name);
  if (!qualify || reasonCodes.length === 0) return null;

  const conviction = calculateConviction(transactions);
  const topPurchases = transactions
    .filter((t) => t.transactionType === "purchase")
    .sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0));

  const topTx = topPurchases[0] || transactions[0];
  const topEvent = insiderToEvidenceEvent(topTx);

  topEvent.aiExplanation = `Net insider conviction: ${conviction.netScore > 0 ? "+" : ""}${conviction.netScore} (${conviction.label}). ` +
    `Total purchased: $${(conviction.totalPurchased / 1_000_000).toFixed(1)}M. ` +
    `Total sold: $${(conviction.totalSold / 1_000_000).toFixed(1)}M. ` +
    `Net shares: ${conviction.netShares > 0 ? "+" : ""}${conviction.netShares.toLocaleString()}.`;

  return {
    ticker,
    name,
    sector,
    reasonCodes,
    topEvent,
  };
}