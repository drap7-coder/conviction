import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/evidence/refresh
 * Fetches new insider transactions for a specific ticker or all watchlist tickers.
 *
 * Reads from the ops sync universe (plus popular Neon member tickers on full sync).
 * If no ticker is specified, syncs the least-recently-synced actives first,
 * up to MAX_COMPANIES_PER_SYNC.
 *
 * Auth:
 * - Full sync (no ticker): requires `Authorization: Bearer <CRON_SECRET>`
 * - Single ticker: available for company-page refresh, rate-capped
 *   (per-ticker cooldown + per-IP burst). Cron Bearer bypasses caps.
 *
 * All limits bounded by sync-config.ts:
 * - Maximum 10 companies per sync
 * - Maximum 30 filings per company
 * - Maximum 100 records per sync
 * - Maximum 55s runtime
 * - Sequential SEC requests with existing delay
 * - Single-ticker cooldown + IP burst caps
 */

import { fetchInsiderTransactions } from "@/lib/sec/client";
import {
  setLastFetchTime,
  getLastFetchTime,
  getAllDedupKeys,
  storeTransactions,
  txToRecord,
} from "@/lib/sec/persist";
import { SYNC_CONFIG, checkSyncBounds } from "@/lib/sync/sync-config";
import { recordSync } from "@/lib/sync/sync-log";
import { updateSyncUniverseStatus } from "@/lib/evidence/sync-universe";
import { runFullEvidenceSync } from "@/lib/evidence/full-sync";
import { requireCronSecret, isValidCronBearer } from "@/lib/api/cron-auth";
import {
  checkSingleTickerCooldown,
  checkSingleTickerIpLimit,
  clientIpFromRequest,
} from "@/lib/api/refresh-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function rateLimitedResponse(retryAfterSec: number, error: string) {
  return NextResponse.json(
    { success: false, error, retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ticker: string | undefined = typeof body.ticker === "string" ? body.ticker.trim() : undefined;
  const cronAuthorized = isValidCronBearer(request);

  // Full watchlist sync is cron/ops only. Single-ticker refresh stays open for
  // company-page guests but is rate-capped unless the cron bearer is present.
  if (!ticker) {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    try {
      const data = await runFullEvidenceSync();
      return NextResponse.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status =
        typeof err === "object" && err && "status" in err && typeof (err as { status: unknown }).status === "number"
          ? (err as { status: number }).status
          : 500;
      const tickersToProcess =
        typeof err === "object" && err && "tickersToProcess" in err
          ? (err as { tickersToProcess?: string[] }).tickersToProcess
          : undefined;
      return NextResponse.json(
        { success: false, error: message, ...(tickersToProcess ? { tickersToProcess } : {}) },
        { status },
      );
    }
  }

  const startTime = Date.now();
  const results: Record<string, {
    newEvents: number;
    totalEvents: number;
    errors: string[];
    fetchedAt: string;
  }> = {};

  let allNewEventsCount = 0;
  let totalErrors = 0;

  // Sync a single ticker
  const tickersToProcess = [ticker.toUpperCase()];

  if (!cronAuthorized) {
    const ipLimit = checkSingleTickerIpLimit(clientIpFromRequest(request.headers));
    if (!ipLimit.ok) {
      return rateLimitedResponse(
        ipLimit.retryAfterSec,
        "Too many evidence refreshes from this client. Try again shortly.",
      );
    }

    const lastFetch = await getLastFetchTime(tickersToProcess[0]);
    const cooldown = checkSingleTickerCooldown(lastFetch);
    if (!cooldown.ok) {
      return rateLimitedResponse(
        cooldown.retryAfterSec,
        `Evidence for ${tickersToProcess[0]} was refreshed recently. Try again in ${cooldown.retryAfterSec}s.`,
      );
    }
  }

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
  await updateSyncUniverseStatus(
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
      singleTickerCooldownSeconds: SYNC_CONFIG.SINGLE_TICKER_COOLDOWN_SECONDS,
      singleTickerIpMax: SYNC_CONFIG.SINGLE_TICKER_IP_MAX,
      syncFrequency: "daily (Vercel Hobby constraint)",
    },
  });
}
