import { buildConvictionHeader } from "@/lib/conviction/header";
import { buildConvictionSnapshot, diffConvictionSnapshots, type ConvictionTransition } from "@/lib/conviction/snapshot";
import {
  getConvictionSnapshot,
  recordConvictionTransition,
  saveConvictionSnapshot,
} from "@/lib/conviction/transition-store";
import { insertConvictionEvent, buildEventKey } from "@/lib/conviction/event-store";
import { fetchShortInterestSummary } from "@/lib/market/short-interest";
import { getPoliticalTradesForTicker } from "@/lib/political-trades";
import { getStoredTransactions, recordToTx } from "@/lib/sec/persist";
import { insiderToEvidenceEvent } from "@/lib/sec/evidence-converter";
import { getCorporateDisclosureSummary } from "@/lib/sec/corporate-disclosures";
import { summarizeCorporateEventActivity } from "@/lib/sec/corporate-disclosure-activity";
import { getInstitutionalAccumulationForCompany } from "@/lib/sec/institutional";
import { validateTicker } from "@/lib/watchlist/validate";

export interface ConvictionTransitionRefreshResult {
  ticker: string;
  baselineCreated: boolean;
  transition: ConvictionTransition | null;
  skippedReason?: string;
}

export async function refreshConvictionTransitionForTicker(ticker: string): Promise<ConvictionTransitionRefreshResult> {
  const upperTicker = ticker.toUpperCase();
  const resolved = await validateTicker(upperTicker);
  if (!resolved.valid) {
    return {
      ticker: upperTicker,
      baselineCreated: false,
      transition: null,
      skippedReason: "unsupported ticker",
    };
  }

  try {
    const storedTransactions = await getStoredTransactions(resolved.ticker);
    const insiderEvents = storedTransactions
      .map(recordToTx)
      .map((transaction) => insiderToEvidenceEvent(transaction));

    const [institutional, politicalSummary, shortInterestSummary, disclosureSummary] = await Promise.all([
      getInstitutionalAccumulationForCompany(resolved.ticker, resolved.companyName ?? resolved.ticker),
      getPoliticalTradesForTicker(resolved.ticker),
      fetchShortInterestSummary(resolved.ticker),
      getCorporateDisclosureSummary(resolved.ticker, resolved.cik),
    ]);

    const corporateActivity = summarizeCorporateEventActivity(disclosureSummary.corporateEvents);
    const header = buildConvictionHeader({
      institutionalRows: institutional.results,
      insiderEvents,
      politicalSummary,
      shortInterest: shortInterestSummary.latest,
      corporateActivity,
    });
    const current = buildConvictionSnapshot({
      ticker: resolved.ticker,
      header,
      institutionalRows: institutional.results,
    });
    const previous = await getConvictionSnapshot(resolved.ticker);
    const transition = diffConvictionSnapshots(previous, current);

    await saveConvictionSnapshot(current);
    if (transition) {
      await recordConvictionTransition(transition);
      await recordActivityEventForTransition(resolved, transition);
    }

    // Also record an event for the baseline (first snapshot) so the feed isn't empty
    if (!previous && !transition) {
      await recordBaselineEvent(resolved, current);
    }

    return {
      ticker: resolved.ticker,
      baselineCreated: !previous,
      transition,
    };
  } catch (error) {
    console.warn(`[conviction-refresh] ${upperTicker} skipped:`, error);
    return {
      ticker: upperTicker,
      baselineCreated: false,
      transition: null,
      skippedReason: "evidence refresh failed",
    };
  }
}

/**
 * Generate a global activity event from a conviction transition.
 * Deterministic event_key = ticker + type + evidenceFingerprint.
 */
async function recordActivityEventForTransition(
  resolved: { ticker: string; companyName?: string },
  transition: ConvictionTransition,
): Promise<void> {
  const eventKey = buildEventKey(resolved.ticker, transition.type, transition.evidenceFingerprint);

  let eventType: import("./event-store").ConvictionEventType;
  let severity: import("./event-store").ConvictionEventSeverity;
  let headline: string;

  switch (transition.type) {
    case "status_upgrade":
    case "new_signal_type":
    case "manager_breadth_increase":
      eventType = "conviction_upgrade";
      severity = "high";
      headline = `${resolved.ticker} conviction upgraded: ${transition.reason}`;
      break;
    case "status_downgrade":
      eventType = "conviction_downgrade";
      severity = "high";
      headline = `${resolved.ticker} conviction downgraded: ${transition.reason}`;
      break;
    case "signal_expired":
      eventType = "signal_expired";
      severity = "medium";
      headline = `${resolved.ticker} signal expired: ${transition.reason}`;
      break;
    default:
      eventType = "conviction_upgrade";
      severity = "medium";
      headline = `${resolved.ticker} evidence updated: ${transition.reason}`;
  }

  await insertConvictionEvent({
    event_key: eventKey,
    ticker: resolved.ticker,
    company_name: resolved.companyName ?? resolved.ticker,
    event_type: eventType,
    severity,
    headline,
    description: transition.reason,
    source_url: `/companies/${resolved.ticker}`,
    source: "sec-edgar",
    metadata: {
      previousStatus: transition.previousStatus,
      currentStatus: transition.currentStatus,
      transitionType: transition.type,
      evidenceFingerprint: transition.evidenceFingerprint,
    },
  });
}

/**
 * Record a baseline event when a company is first tracked.
 */
async function recordBaselineEvent(
  resolved: { ticker: string; companyName?: string },
  snapshot: import("./snapshot").ConvictionSnapshot,
): Promise<void> {
  const eventKey = buildEventKey(resolved.ticker, "baseline", snapshot.evidenceFingerprint);

  await insertConvictionEvent({
    event_key: eventKey,
    ticker: resolved.ticker,
    company_name: resolved.companyName ?? resolved.ticker,
    event_type: "new_signal",
    severity: "low",
    headline: `${resolved.ticker} now being tracked — ${snapshot.status} conviction baseline established.`,
    description: `Status: ${snapshot.status}, Confidence: ${snapshot.confidence}, Signals: ${snapshot.supportingSignalTypes.join(", ") || "none"}.`,
    source_url: `/companies/${resolved.ticker}`,
    source: "sec-edgar",
    metadata: {
      status: snapshot.status,
      confidence: snapshot.confidence,
      supportingSignalTypes: snapshot.supportingSignalTypes,
      accumulatingManagerCount: snapshot.accumulatingManagerCount,
      insiderPurchaseCount: snapshot.insiderPurchaseCount,
    },
  });
}
