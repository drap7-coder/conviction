/**
 * Converts SEC InsiderTransaction records into Conviction EvidenceEvent format.
 * Only AI explanation is non-deterministic — everything else is rule-based.
 */

import type { InsiderTransaction } from "./types";
import { isDirectionalTransaction } from "./types";
import { calculateMateriality } from "./materiality";
import type { EvidenceEvent, ReasonCode, EmergingIdea } from "@/lib/evidence/types";

/**
 * Convert an InsiderTransaction to an EvidenceEvent for the conviction UI.
 */
export function insiderToEvidenceEvent(
  tx: InsiderTransaction,
  aiExplanation?: string,
): EvidenceEvent {
  const materiality = calculateMateriality(tx);
  const isDirectional = isDirectionalTransaction(tx.transactionClass);
  const isBuy = tx.transactionClass === "open-market-purchase";

  // Determine direction
  const direction = isDirectional
    ? isBuy ? "positive" as const : "negative" as const
    : "neutral" as const;

  // Determine event type
  const type = isDirectional
    ? isBuy ? "insider-buy" as const : "insider-sell" as const
    : "insider-buy" as const; // Non-directional still appears as insider event

  // Build title
  const actionLabel = getActionLabel(tx);
  const valueStr = tx.totalValue
    ? tx.totalValue >= 1_000_000
      ? `$${(tx.totalValue / 1_000_000).toFixed(1)}M`
      : `$${(tx.totalValue / 1_000).toFixed(0)}K`
    : `${tx.shares.toLocaleString()} shares`;

  const title = `${actionLabel} — ${tx.insiderName} ${direction === "positive" ? "acquired" : direction === "negative" ? "disposed" : "transacted"} ${valueStr}`;

  // Build summary
  const roleStr = tx.insiderRole ? ` (${tx.insiderRole})` : "";
  const ownershipStr = tx.sharesOwnedAfter
    ? `. Holds ${tx.sharesOwnedAfter.toLocaleString()} shares after.`
    : "";
  const summary = `${tx.insiderName}${roleStr} in ${tx.ticker}${ownershipStr}`;

  // Calculate disclosure delay
  const delayMs = new Date(tx.filingDate).getTime() - new Date(tx.transactionDate).getTime();
  const disclosureDelay = Math.max(0, Math.round(delayMs / (1000 * 60 * 60 * 24)));

  // Evidence strength comes from materiality
  const strength = materiality.score * (isDirectional ? 1.0 : 0.3);

  // Contradiction: an insider sell is contradictory if most evidence is positive
  // (True contradiction detection requires company-level context)
  const isContradiction = direction === "negative" && isDirectional;

  // Default AI explanation if none provided
  const explanation = aiExplanation || generateDefaultExplanation(tx, materiality);

  return {
    id: tx.id,
    ticker: tx.ticker,
    type: tx.transactionClass === "open-market-sale" ? "insider-sell" as any : "insider-buy" as any,
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
      transactionClass: tx.transactionClass,
      shares: tx.shares,
      totalValue: tx.totalValue,
      sharesOwnedAfter: tx.sharesOwnedAfter,
    },
  };
}

/**
 * Generate a deterministic default explanation when AI is unavailable.
 * This ensures the system works without any AI dependency.
 */
function generateDefaultExplanation(
  tx: InsiderTransaction,
  materiality: ReturnType<typeof calculateMateriality>,
): string {
  const parts: string[] = [];

  if (isDirectionalTransaction(tx.transactionClass)) {
    if (tx.transactionClass === "open-market-purchase") {
      parts.push(`${tx.insiderName} purchased ${tx.shares.toLocaleString()} shares at market price.`);
    } else {
      parts.push(`${tx.insiderName} sold ${tx.shares.toLocaleString()} shares on the open market.`);
    }
  } else {
    parts.push(`${tx.insiderName} reported a ${tx.transactionClass.replace(/-/g, " ")} transaction.`);
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

function getActionLabel(tx: InsiderTransaction): string {
  switch (tx.transactionClass) {
    case "open-market-purchase": return "Open-market buy";
    case "open-market-sale": return "Open-market sale";
    case "grant": return "Grant received";
    case "exercise": return "Option exercise";
    case "tax-withholding": return "Tax withholding";
    case "automatic-plan-sale": return "Plan sale";
    case "disposition": return "Disposition";
    case "gift": return "Gift";
    default: return "Insider transaction";
  }
}

/**
 * Check if a company qualifies for emerging evidence based on insider activity.
 * Returns reason codes if it does.
 */
export function getEmergingReasonCodes(
  transactions: InsiderTransaction[],
  ticker: string,
  companyName: string,
): { qualify: boolean; reasonCodes: ReasonCode[] } {
  if (transactions.length === 0) return { qualify: false, reasonCodes: [] };

  const reasonCodes: ReasonCode[] = [];
  const directional = transactions.filter((t) => isDirectionalTransaction(t.transactionClass));
  const purchases = directional.filter((t) => t.transactionClass === "open-market-purchase");
  const sales = directional.filter((t) => t.transactionClass === "open-market-sale");

  // Clustered insider buying
  const uniqueBuyers = new Set(purchases.map((p) => p.insiderName));
  if (uniqueBuyers.size >= 2 && purchases.length >= 3) {
    const avgStrength = purchases.reduce((s, p) => s + calculateMateriality(p).score, 0) / purchases.length;
    reasonCodes.push({
      code: "clustered-insider",
      label: "Clustered insider buying",
      positive: true,
      strength: Math.min(1, avgStrength + 0.2),
    });
  }

  // Unusually large purchase
  for (const purchase of purchases) {
    const materiality = calculateMateriality(purchase);
    if (materiality.score >= 0.7) {
      reasonCodes.push({
        code: "large-insider-purchase",
        label: `Large insider purchase (${purchase.insiderName})`,
        positive: true,
        strength: materiality.score,
      });
      break;
    }
  }

  // Multiple insiders buying
  if (uniqueBuyers.size >= 2 && reasonCodes.length === 0) {
    reasonCodes.push({
      code: "multiple-insiders",
      label: "Multiple insiders accumulating",
      positive: true,
      strength: Math.min(0.8, uniqueBuyers.size * 0.25),
    });
  }

  // Heavy insider selling (cautionary)
  const uniqueSellers = new Set(sales.map((s) => s.insiderName));
  if (uniqueSellers.size >= 2 && sales.length >= purchases.length * 2) {
    reasonCodes.push({
      code: "clustered-insider-selling",
      label: "Clustered insider selling",
      positive: false,
      strength: Math.min(0.8, sales.length * 0.15),
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

  // Pick the highest materiality directional purchase as the top event
  const purchases = transactions
    .filter((t) => t.transactionClass === "open-market-purchase")
    .sort((a, b) => calculateMateriality(b).score - calculateMateriality(a).score);

  const topTx = purchases[0] || transactions[0];
  const topEvent = insiderToEvidenceEvent(topTx);

  return {
    ticker,
    name,
    sector,
    reasonCodes,
    topEvent,
  };
}