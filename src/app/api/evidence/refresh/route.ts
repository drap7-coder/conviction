import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/evidence/refresh
 * Fetches new insider transactions for a specific ticker or all watchlist tickers.
 * Returns new events and emerging evidence candidates.
 */

import { fetchInsiderTransactions } from "@/lib/sec/client";
import { FIXTURE_TICKERS } from "@/lib/evidence/fixtures";
import {
  setLastFetchTime,
  getAllDedupKeys,
  storeTransactions,
  txToRecord,
} from "@/lib/sec/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for processing all tickers

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ticker: string | undefined = body.ticker;
  const tickersToProcess = ticker
    ? [ticker.toUpperCase()]
    : FIXTURE_TICKERS;

  const results: Record<string, {
    newEvents: number;
    totalEvents: number;
    errors: string[];
    fetchedAt: string;
  }> = {};

  let allNewEventsCount = 0;
  let totalErrors = 0;

  for (const t of tickersToProcess) {
    const dedupKeys = await getAllDedupKeys();
    const result = await fetchInsiderTransactions(t, dedupKeys);

    // Store new transactions
    const newRecords = result.newTransactions.map(txToRecord);
    const newDedupKeys = result.newTransactions.map((tx) => tx.id);

    if (newRecords.length > 0) {
      await storeTransactions(t, newRecords, newDedupKeys);
    }

    // Update last fetch time
    await setLastFetchTime(t, result.fetchedAt);

    results[t] = {
      newEvents: result.newTransactions.length,
      totalEvents: result.allTransactions.length,
      errors: result.errors,
      fetchedAt: result.fetchedAt,
    };

    allNewEventsCount += result.newTransactions.length;
    totalErrors += result.errors.length;
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      totalNewEvents: allNewEventsCount,
      totalErrors,
      tickersProcessed: tickersToProcess.length,
    },
  });
}