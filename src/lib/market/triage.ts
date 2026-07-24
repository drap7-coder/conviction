/**
 * ── Triage Engine ──
 *
 * Prioritizes watchlist and portfolio names by decision-relevance.
 * No opaque scoring. Based on available thesis, conviction, and price data.
 */

import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";

// ── Types ──

export type TriageAction = "Review thesis" | "View evidence" | "Open position" | "Update thesis";

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
  /** Thesis status if available */
  thesisStatus: string | null;
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
  /** Thesis status (may be null if unavailable) */
  thesisStatus: string | null;
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
 * 1. Broken thesis (thesis status indicates failure)
 * 2. Weakening conviction + large daily decline
 * 3. Large negative portfolio impact
 * 4. Significant price decline (>5%)
 * 5. Deteriorating conviction evidence
 * 6. Thesis overdue for review
 * 7. Missing evidence or stale data
 * 8. All other items are stable
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
    let action: TriageAction = "Review thesis";

    // Check thesis status
    const thesisBroken =
      item.thesisStatus === "broken";
    const thesisWeakening =
      item.thesisStatus === "weakening";
    const thesisOverdueCheck =
      item.thesisStatus === "review";

    // Check conviction
    const convictionNegative =
      item.snapshot?.evidence.verdict === "negative" ||
      item.snapshot?.evidence.verdict === "weak";

    const convictionImproving =
      item.snapshot?.evidence.direction === "improving";
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

    // ── Priority 1: Broken thesis ──
    if (thesisBroken) {
      priority = 1;
      reason = "Thesis has broken or been invalidated.";
      action = "Review thesis";
    }

    // ── Priority 2: Weakening conviction + decline ──
    if (priority > 2 && convictionDeteriorating && (largeDecline || moderateDecline)) {
      priority = 2;
      reason = `Conviction is deteriorating${largeDecline ? ` with a ${item.changePercent!.toFixed(1)}% decline.` : "."}`;
      action = "View evidence";
    }

    // ── Priority 3: Large portfolio impact ──
    if (priority > 3 && largePortfolioImpact) {
      priority = 3;
      reason = `Portfolio impact of $${Math.abs(item.portfolio.positionChange!).toFixed(0)} today.`;
      action = "Open position";
    }

    // ── Priority 4: Significant price decline ──
    if (priority > 4 && largeDecline) {
      priority = 4;
      reason = `Down ${item.changePercent!.toFixed(1)}% today. Review whether the thesis still holds.`;
      action = "Review thesis";
    }

    // ── Priority 5: Deteriorating conviction (without decline) ──
    if (priority > 5 && convictionDeteriorating) {
      priority = 5;
      reason = "Evidence signals are deteriorating. Review the current thesis.";
      action = "View evidence";
    }

    // ── Priority 6: Thesis overdue ──
    if (priority > 6 && thesisOverdueCheck) {
      priority = 6;
      reason = "Thesis review is overdue.";
      action = "Update thesis";
    }

    // ── Priority 7: Missing or stale ──
    if (priority > 7 && item.snapshot === null) {
      priority = 7;
      reason = "Evidence data is unavailable. Review may be needed.";
      action = "View evidence";
    }

    // ── Classify as alert or stable ──
    if (priority <= 7) {
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
        thesisStatus: item.thesisStatus,
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