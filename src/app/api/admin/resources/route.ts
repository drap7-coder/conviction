import { NextResponse } from "next/server";
import { getStoredTransactions, getAllTrackedTickers, getAllDedupKeys } from "@/lib/sec/persist";
import { getSyncLog } from "@/lib/sync/sync-log";
import { SYNC_CONFIG } from "@/lib/sync/sync-config";
import { getWatchlist, isKvEnabled } from "@/lib/watchlist/persist";

/**
 * GET /api/admin/resources
 * Lightweight resource dashboard.
 *
 * Reports:
 * - Database row counts by ticker
 * - Approximate stored payload size
 * - Sync execution history
 * - Watchlist count and entries
 * - KV persistence status (vs local JSON fallback)
 * - Unsupported/error tickers
 * - Limits and infrastructure notes
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = await getAllTrackedTickers();
  const syncLog = getSyncLog();
  const watchlistEntries = await getWatchlist();
  const kvEnabled = isKvEnabled();

  // Per-ticker statistics
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
    const estBytes = count * 400;
    totalPayloadBytes += estBytes;

    byTicker[ticker] = {
      storedTransactions: count,
      lastFetch: syncLog.entries
        .filter((e) => e.ticker === ticker)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp ?? null,
    };
  }

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
    watchlist: {
      count: watchlistEntries.length,
      activeCount: watchlistEntries.filter((e) => e.status === "active").length,
      unsupportedCount: watchlistEntries.filter((e) => e.status === "unsupported").length,
      errorCount: watchlistEntries.filter((e) => e.status === "error").length,
      entries: watchlistEntries.map((e) => ({
        ticker: e.ticker,
        companyName: e.companyName,
        status: e.status,
        statusMessage: e.statusMessage,
        addedAt: e.addedAt,
        lastSyncedAt: e.lastSyncedAt,
      })),
      kvEnabled,
      persistence: kvEnabled ? "kv" : "local-json",
      warning: kvEnabled
        ? undefined
        : "KV not configured — watchlist is stored in local JSON. Set KV_URL and KV_REST_API_URL for production durability.",
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
      kvStatus: kvEnabled ? "connected" : "not configured",
      neon: "not configured",
      postgresql: "not configured",
      redis: "Vercel KV (optional)",
      storagePath: ".conviction/store.json (local)",
      watchlistStorage: kvEnabled ? "Vercel KV (conviction:watchlist)" : "local JSON (.conviction/watchlist.json)",
    },
    notes: [
      "Page loads read persisted data only — no external provider calls.",
      "Ingestion is incremental: only unseen filing IDs trigger new records.",
      "Watchlist is editable at runtime and persisted independently of transaction data.",
      "Dedup keys are pruned to max 5,000 entries.",
      "Transaction records are capped at 100 per ticker (newest).",
      "Sync log entries are capped at 100 (oldest evicted).",
      "No full SEC XML, PDFs, or article bodies are stored.",
      "Vercel Hobby supports native cron at most once per day.",
    ],
  });
}