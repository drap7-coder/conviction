/**
 * ── Triage Engine ──
 *
 * Prioritizes watchlist and portfolio names by decision-relevance.
 * No opaque scoring. Based on available conviction, price, and portfolio data.
 */

import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";

// ── Types ──

export type TriageAction = "View evidence" | "Open position" | "Review position";

export interface TriageItem {
  ticker: string;
  companyName: string;
  /** Current price (may be null if unavailable) */
  price: number | null;
  /** Daily percentage change */
  changePercent: number | null;
  /** Dollar impact on portfolio (null if not held or data unavailable) */
  portfolioImpact: number | null;
  /** Priority rank (1 = highest) */
  priority: number;
  /** Plain-language reason for surfacing */
  reason: string;
  /** Suggested action */
  action: TriageAction;
  /** Conviction badge data if available */
  conviction: {
    verdict: string;
    direction: string | null;
    tone: "positive" | "negative" | "contested" | "quiet";
  } | null;
}

export interface TriageResult {
  /** Items requiring attention, sorted by priority (highest first) */
  alerts: TriageItem[];
  /** Whether any items need attention */
  hasAlerts: boolean;
  /** Count of items reviewed and found stable */
  stableCount: number;
  /** Count of items with insufficient data for triage */
  unknownCount: number;
}

// ── Input types ──

export interface TriageWatchlistInput {
  ticker: string;
  companyName: string;
  /** Price data */
  price: number | null;
  changePercent: number | null;
  /** Conviction snapshot (may be null if unavailable) */
  snapshot: ConvictionSnapshot | null;
  /** Portfolio data (may be null if not held) */
  portfolio: {
    held: boolean;
    positionChange: number | null;
  };
}

// ── Triage logic ──

/**
 * Run triage on watchlist/portfolio items.
 * Items are sorted by decision-relevance priority.
 *
 * Priority rules:
 * 1. Weakening conviction + large daily decline
 * 2. Large negative portfolio impact
 * 3. Significant price decline (>5%)
 * 4. Deteriorating conviction evidence
 * 5. Missing evidence or stale data
 * 6. All other items are stable
 */
export function runTriage(items: TriageWatchlistInput[]): TriageResult {
  const alerts: TriageItem[] = [];
  let stableCount = 0;
  let unknownCount = 0;

  const seen = new Set<string>();

  for (const item of items) {
    // Determine priority score
    let priority = 999; // default: stable
    let reason: string | null = null;
    let action: TriageAction = "View evidence";

    const convictionDeteriorating =
      item.snapshot?.evidence.direction === "deteriorating";

    // Check price decline
    const largeDecline = item.changePercent !== null && item.changePercent < -5;
    const moderateDecline = item.changePercent !== null && item.changePercent < -2;

    // Check portfolio impact
    const largePortfolioImpact =
      item.portfolio.held &&
      item.portfolio.positionChange !== null &&
      Math.abs(item.portfolio.positionChange) > 500;

    // ── Priority 1: Weakening conviction + decline ──
    if (convictionDeteriorating && (largeDecline || moderateDecline)) {
      priority = 1;
      reason = `Conviction is deteriorating${largeDecline ? ` with a ${item.changePercent!.toFixed(1)}% decline.` : "."}`;
      action = "View evidence";
    }

    // ── Priority 2: Large portfolio impact ──
    if (priority > 2 && largePortfolioImpact) {
      priority = 2;
      reason = `Portfolio impact of $${Math.abs(item.portfolio.positionChange!).toFixed(0)} today.`;
      action = "Open position";
    }

    // ── Priority 3: Significant price decline ──
    if (priority > 3 && largeDecline) {
      priority = 3;
      reason = `Down ${item.changePercent!.toFixed(1)}% today.`;
      action = "Review position";
    }

    // ── Priority 4: Deteriorating conviction (without decline) ──
    if (priority > 4 && convictionDeteriorating) {
      priority = 4;
      reason = "Evidence signals are deteriorating.";
      action = "View evidence";
    }

    // ── Priority 5: Missing or stale ──
    if (priority > 5 && item.snapshot === null) {
      priority = 5;
      reason = "Evidence data is unavailable. Review may be needed.";
      action = "View evidence";
    }

    // ── Classify as alert or stable ──
    if (priority <= 5) {
      // Deduplicate: if we already have an alert for this ticker, skip
      if (seen.has(item.ticker)) continue;
      seen.add(item.ticker);

      alerts.push({
        ticker: item.ticker,
        companyName: item.companyName,
        price: item.price,
        changePercent: item.changePercent,
        portfolioImpact: item.portfolio.held ? item.portfolio.positionChange : null,
        priority,
        reason: reason ?? "Review needed.",
        action,
        conviction: item.snapshot
          ? {
              verdict: item.snapshot.evidence.verdict,
              direction: item.snapshot.evidence.direction === "improving"
                ? "Improving"
                : item.snapshot.evidence.direction === "deteriorating"
                  ? "Deteriorating"
                  : null,
              tone: item.snapshot.evidence.verdict === "strong" || item.snapshot.evidence.verdict === "positive"
                ? "positive"
                : item.snapshot.evidence.verdict === "negative" || item.snapshot.evidence.verdict === "weak"
                  ? "negative"
                  : item.snapshot.evidence.verdict === "mixed"
                    ? "contested"
                    : "quiet",
            }
          : null,
      });
    } else if (item.snapshot === null && item.price === null) {
      unknownCount++;
    } else {
      stableCount++;
    }
  }

  // Sort alerts by priority (ascending)
  alerts.sort((a, b) => a.priority - b.priority);

  return {
    alerts,
    hasAlerts: alerts.length > 0,
    stableCount,
    unknownCount,
  };
}
