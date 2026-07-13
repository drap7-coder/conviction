import { NextResponse } from "next/server";
import { getStoredTransactions, getAllTrackedTickers, getAllDedupKeys } from "@/lib/sec/persist";
import { getSyncLog } from "@/lib/sync/sync-log";
import { SYNC_CONFIG } from "@/lib/sync/sync-config";

/**
 * GET /api/admin/resources
 * Lightweight resource dashboard reporting:
 * - Database row counts by ticker
 * - Approximate stored payload size
 * - Sync execution history
 * - External requests (inferred from sync log)
 * - Inserted vs duplicate records
 * - Average sync duration
 * - Failures and retries
 *
 * No authentication — this is a local/admin tool for the MVP.
 * In production, add a simple API key check.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = await getAllTrackedTickers();
  const syncLog = getSyncLog();

  // Compute per-ticker statistics
  const byTicker: Record<string, {
    storedTransactions: number;
    lastFetch: string | null;
  }> = {};

  let totalStoredRows = 0;
  let totalPayloadBytes = 0;

  for (const ticker of tickers) {
    const txs = await getStoredTransactions(ticker);
    const count = txs.length;
    totalStoredRows += count;

    // Approximate payload size: each transaction record is ~400 bytes of JSON
    const estBytes = count * 400;
    totalPayloadBytes += estBytes;

    byTicker[ticker] = {
      storedTransactions: count,
      lastFetch: syncLog.entries
        .filter((e) => e.ticker === ticker)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp ?? null,
    };
  }

  // Dedup key stats
  const dedupKeys = await getAllDedupKeys();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    resourceUsage: {
      totalStoredRows,
      totalStoredPayloadBytes: totalPayloadBytes,
      totalStoredPayloadKB: Math.round(totalPayloadBytes / 1024),
      dedupKeys: {
        count: dedupKeys.size,
        maxLimit: SYNC_CONFIG.MAX_DEDUP_KEYS,
        utilizationPercent: Math.round((dedupKeys.size / SYNC_CONFIG.MAX_DEDUP_KEYS) * 100),
      },
      byTicker,
    },
    sync: {
      totalRuns: syncLog.totalRuns,
      lastRun: syncLog.lastRun,
      averageDurationMs: syncLog.averageDurationMs,
      totalNewRecords: syncLog.totalNewRecords,
      totalErrors: syncLog.totalErrors,
      recentEntries: syncLog.entries.slice(-10).reverse().map((e) => ({
        time: e.timestamp,
        source: e.source,
        ticker: e.ticker,
        durationMs: e.durationMs,
        newRecords: e.newRecords,
        errors: e.errors,
      })),
    },
    limits: {
      maxCompaniesPerSync: SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
      maxFilingsPerCompany: SYNC_CONFIG.MAX_FILINGS_PER_COMPANY,
      maxRecordsPerSync: SYNC_CONFIG.MAX_RECORDS_PER_SYNC,
      maxTransactionsPerTicker: SYNC_CONFIG.MAX_TRANSACTIONS_PER_TICKER,
      maxDedupKeys: SYNC_CONFIG.MAX_DEDUP_KEYS,
      maxSyncLogEntries: SYNC_CONFIG.MAX_SYNC_LOG_ENTRIES,
      maxSyncDurationSeconds: SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS,
      maxRetriesPerFetch: SYNC_CONFIG.MAX_RETRIES_PER_FETCH,
      vercelPlan: SYNC_CONFIG.VERCEL_PLAN,
      maxCronFrequency: SYNC_CONFIG.MAX_CRON_FREQUENCY,
      syncFrequencies: SYNC_CONFIG.FREQUENCY,
    },
    infrastructure: {
      database: "none (Vercel KV + local JSON fallback)",
      neon: "not configured",
      postgresql: "not configured",
      redis: "Vercel KV (optional)",
      storagePath: ".conviction/store.json (local)",
    },
    notes: [
      "Page loads read persisted data only — no external provider calls.",
      "Ingestion is incremental: only unseen filing IDs trigger new records.",
      "Dedup keys are pruned to max 5,000 entries.",
      "Transaction records are capped at 100 per ticker (newest).",
      "Sync log entries are capped at 100 (oldest evicted).",
      "No full SEC XML, PDFs, or article bodies are stored.",
      "Vercel Hobby supports native cron at most once per day.",
    ],
  });
}