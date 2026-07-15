import { buildConvictionHeader } from "@/lib/conviction/header";
import { buildConvictionSnapshot, diffConvictionSnapshots, type ConvictionTransition } from "@/lib/conviction/snapshot";
import {
  getConvictionSnapshot,
  recordConvictionTransition,
  saveConvictionSnapshot,
} from "@/lib/conviction/transition-store";
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
    if (transition) await recordConvictionTransition(transition);

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
