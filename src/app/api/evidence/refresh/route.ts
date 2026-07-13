import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/evidence/refresh
 * Fetches new insider transactions for a specific ticker or all watchlist tickers.
 *
 * Reads from the persisted watchlist. If no ticker is specified, syncs the
 * least-recently-synced active tickers first, up to MAX_COMPANIES_PER_SYNC.
 *
 * All limits bounded by sync-config.ts:
 * - Maximum 10 companies per sync
 * - Maximum 30 filings per company
 * - Maximum 100 records per sync
 * - Maximum 55s runtime
 * - Sequential SEC requests with existing delay
 */

import { fetchInsiderTransactions } from "@/lib/sec/client";
import {
  setLastFetchTime,
  getAllDedupKeys,
  storeTransactions,
  txToRecord,
} from "@/lib/sec/persist";
import { SYNC_CONFIG, checkSyncBounds } from "@/lib/sync/sync-config";
import { recordSync } from "@/lib/sync/sync-log";
import { getWatchlistSortedBySyncPriority, updateWatchlistSync } from "@/lib/watchlist/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ticker: string | undefined = body.ticker;

  const startTime = Date.now();
  const results: Record<string, {
    newEvents: number;
    totalEvents: number;
    errors: string[];
    fetchedAt: string;
  }> = {};

  let allNewEventsCount = 0;
  let totalErrors = 0;

  if (ticker) {
    // Sync a single ticker
    const tickersToProcess = [ticker.toUpperCase()];

    const boundsCheck = checkSyncBounds({
      companyCount: 1,
      filingCount: SYNC_CONFIG.MAX_FILINGS_PER_COMPANY,
      recordCount: SYNC_CONFIG.MAX_RECORDS_PER_SYNC,
    });

    if (!boundsCheck.ok) {
      return NextResponse.json(
        { success: false, error: boundsCheck.reason },
        { status: 429 },
      );
    }

    const dedupKeys = await getAllDedupKeys();
    const result = await fetchInsiderTransactions(tickersToProcess[0], dedupKeys);

    const newRecords = result.newTransactions.map(txToRecord);
    const newDedupKeys = result.newTransactions.map((tx) => tx.id);

    if (newRecords.length > 0) {
      await storeTransactions(tickersToProcess[0], newRecords, newDedupKeys);
    }
    await setLastFetchTime(tickersToProcess[0], result.fetchedAt);
    await updateWatchlistSync(
      tickersToProcess[0],
      result.errors.length > 0 ? "error" : "active",
    );

    results[tickersToProcess[0]] = {
      newEvents: result.newTransactions.length,
      totalEvents: result.allTransactions.length,
      errors: result.errors,
      fetchedAt: result.fetchedAt,
    };
    allNewEventsCount += result.newTransactions.length;
    totalErrors += result.errors.length;

    const elapsedMs = Date.now() - startTime;
    recordSync({
      timestamp: new Date().toISOString(),
      source: "sec-edgar",
      ticker: tickersToProcess[0],
      durationMs: elapsedMs,
      newRecords: result.newTransactions.length,
      totalRecords: result.allTransactions.length,
      errors: result.errors.length,
      errorMessages: result.errors,
    });

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalNewEvents: allNewEventsCount,
        totalErrors,
        tickersProcessed: 1,
        durationMs: elapsedMs,
      },
      _limits: {
        maxCompaniesPerSync: SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
        maxDurationSeconds: SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS,
        syncFrequency: "daily (Vercel Hobby constraint)",
      },
    });
  }

  // Full sync — read from saved watchlist, LRU ordering
  const sortedEntries = await getWatchlistSortedBySyncPriority();
  const tickersToProcess = sortedEntries
    .slice(0, SYNC_CONFIG.MAX_COMPANIES_PER_SYNC)
    .map((e) => e.ticker);

  if (tickersToProcess.length === 0) {
    return NextResponse.json({
      success: true,
      results: {},
      summary: { totalNewEvents: 0, totalErrors: 0, tickersProcessed: 0, durationMs: 0 },
      note: "No active tickers in watchlist to sync",
    });
  }

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

  for (const t of tickersToProcess) {
    const dedupKeys = await getAllDedupKeys();
    const result = await fetchInsiderTransactions(t, dedupKeys);

    const newRecords = result.newTransactions.map(txToRecord);
    const newDedupKeys = result.newTransactions.map((tx) => tx.id);

    if (newRecords.length > 0) {
      await storeTransactions(t, newRecords, newDedupKeys);
    }
    await setLastFetchTime(t, result.fetchedAt);
    await updateWatchlistSync(t, result.errors.length > 0 ? "error" : "active");

    results[t] = {
      newEvents: result.newTransactions.length,
      totalEvents: result.allTransactions.length,
      errors: result.errors,
      fetchedAt: result.fetchedAt,
    };

    allNewEventsCount += result.newTransactions.length;
    totalErrors += result.errors.length;

    // Check max runtime
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

  // Record sync log for each ticker
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
      lruOrder: tickersToProcess,
    },
    _limits: {
      maxCompaniesPerSync: SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
      maxDurationSeconds: SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS,
      syncFrequency: "daily (Vercel Hobby constraint)",
    },
  });
}