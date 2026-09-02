import { fetchInsiderTransactions } from "@/lib/sec/client";
import {
  setLastFetchTime,
  getAllDedupKeys,
  storeTransactions,
  txToRecord,
} from "@/lib/sec/persist";
import { SYNC_CONFIG, checkSyncBounds } from "@/lib/sync/sync-config";
import { recordSync } from "@/lib/sync/sync-log";
import { buildDailySyncQueue, updateSyncUniverseStatus } from "@/lib/evidence/sync-universe";

export type FullEvidenceSyncTickerResult = {
  newEvents: number;
  totalEvents: number;
  errors: string[];
  fetchedAt: string;
};

export type FullEvidenceSyncResult = {
  success: true;
  results: Record<string, FullEvidenceSyncTickerResult>;
  summary: {
    totalNewEvents: number;
    totalErrors: number;
    tickersProcessed: number;
    durationMs: number;
    lruOrder?: string[];
  };
  note?: string;
  _limits: {
    maxCompaniesPerSync: number;
    maxDurationSeconds: number;
    syncFrequency: string;
  };
};

/**
 * Full watchlist / ops-universe evidence sync (LRU queue).
 * Used by cron daily-sync in-process and by POST /api/evidence/refresh with no ticker.
 * Persists insider filings only — conviction score / transition fan-out is retired.
 */
export async function runFullEvidenceSync(): Promise<FullEvidenceSyncResult> {
  const startTime = Date.now();
  const results: Record<string, FullEvidenceSyncTickerResult> = {};
  let allNewEventsCount = 0;
  let totalErrors = 0;

  const sortedEntries = await buildDailySyncQueue();
  const tickersToProcess = sortedEntries.map((e) => e.ticker);

  if (tickersToProcess.length === 0) {
    return {
      success: true,
      results: {},
      summary: { totalNewEvents: 0, totalErrors: 0, tickersProcessed: 0, durationMs: 0 },
      note: "No active tickers in the sync queue",
      _limits: {
        maxCompaniesPerSync: SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
        maxDurationSeconds: SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS,
        syncFrequency: "daily (Vercel Hobby constraint)",
      },
    };
  }

  const boundsCheck = checkSyncBounds({
    companyCount: tickersToProcess.length,
    filingCount: SYNC_CONFIG.MAX_FILINGS_PER_COMPANY,
    recordCount: SYNC_CONFIG.MAX_RECORDS_PER_SYNC,
  });

  if (!boundsCheck.ok) {
    const error = new Error(boundsCheck.reason ?? "Sync bounds exceeded");
    (error as Error & { status: number; tickersToProcess: string[] }).status = 429;
    (error as Error & { tickersToProcess: string[] }).tickersToProcess = tickersToProcess;
    throw error;
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
    await updateSyncUniverseStatus(t, result.errors.length > 0 ? "error" : "active");

    results[t] = {
      newEvents: result.newTransactions.length,
      totalEvents: result.allTransactions.length,
      errors: result.errors,
      fetchedAt: result.fetchedAt,
    };

    allNewEventsCount += result.newTransactions.length;
    totalErrors += result.errors.length;

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

  return {
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
  };
}
