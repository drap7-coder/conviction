import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/evidence/refresh
 * Fetches new insider transactions for a specific ticker or all watchlist tickers.
 *
 * All limits are bounded by sync-config.ts to stay within free-tier constraints:
 * - Maximum 10 companies per sync
 * - Maximum 30 filings per company
 * - Maximum 100 records per sync
 * - Maximum 55s runtime (within Vercel Hobby's 60s limit)
 * - Each ticker processed sequentially to avoid hammering SEC
 *
 * Returns new events and sync diagnostic info.
 */

import { fetchInsiderTransactions } from "@/lib/sec/client";
import { FIXTURE_TICKERS } from "@/lib/evidence/fixtures";
import {
  setLastFetchTime,
  getAllDedupKeys,
  storeTransactions,
  txToRecord,
} from "@/lib/sec/persist";
import { SYNC_CONFIG, checkSyncBounds } from "@/lib/sync/sync-config";
import { recordSync } from "@/lib/sync/sync-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for processing all tickers

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ticker: string | undefined = body.ticker;
  const tickersToProcess = ticker
    ? [ticker.toUpperCase()]
    : FIXTURE_TICKERS;

  // Apply bounded limits
  const boundsCheck = checkSyncBounds({
    companyCount: tickersToProcess.length,
    filingCount: SYNC_CONFIG.MAX_FILINGS_PER_COMPANY,
    recordCount: SYNC_CONFIG.MAX_RECORDS_PER_SYNC,
  });

  if (!boundsCheck.ok) {
    return NextResponse.json(
      { success: false, error: boundsCheck.reason, tickersToProcess },
      { status: 429 },
    );
  }

  const results: Record<string, {
    newEvents: number;
    totalEvents: number;
    errors: string[];
    fetchedAt: string;
  }> = {};

  let allNewEventsCount = 0;
  let totalErrors = 0;
  const startTime = Date.now();

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

    // Check max runtime — bail if approaching Vercel timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS * 1000) {
      results["_timeout"] = {
        newEvents: 0,
        totalEvents: 0,
        errors: [`Sync approaching ${SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS}s limit after ${t}`],
        fetchedAt: new Date().toISOString(),
      };
      break;
    }
  }

  const elapsedMs = Date.now() - startTime;

  // Record the sync in the sync log for the admin dashboard
  for (const [t, r] of Object.entries(results)) {
    if (t === "_timeout") continue;
    recordSync({
      timestamp: new Date().toISOString(),
      source: "sec-edgar",
      ticker: t,
      durationMs: elapsedMs,
      newRecords: r.newEvents,
      totalRecords: r.totalEvents,
      errors: r.errors.length,
      errorMessages: r.errors,
    });
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      totalNewEvents: allNewEventsCount,
      totalErrors,
      tickersProcessed: tickersToProcess.length,
      durationMs: elapsedMs,
    },
    _limits: {
      maxCompaniesPerSync: SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
      maxDurationSeconds: SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS,
      syncFrequency: "daily (Vercel Hobby constraint)",
    },
  });
}