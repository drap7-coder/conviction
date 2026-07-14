import { NextRequest, NextResponse } from "next/server";
import { addToWatchlist, updateWatchlistSync } from "@/lib/watchlist/persist";
import { validateTicker } from "@/lib/watchlist/validate";
import { fetchInsiderTransactions } from "@/lib/sec/client";
import { txToRecord, storeTransactions, setLastFetchTime, getAllDedupKeys } from "@/lib/sec/persist";
import { recordSync } from "@/lib/sync/sync-log";
import { SYNC_CONFIG, checkSyncBounds } from "@/lib/sync/sync-config";

/**
 * POST /api/watchlist
 * Add a ticker or company name to the watchlist.
 *
 * Validates the ticker, persists it, and runs a bounded single-company
 * initial sync to fetch its SEC Form 4 data.
 *
 * Body: { ticker: string }
 * Body: { company: string }  (alternative field)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const input = (body.ticker || body.company || "").trim();

  if (!input) {
    return NextResponse.json(
      { success: false, error: "Enter a ticker or company name" },
      { status: 400 },
    );
  }

  // Validate and resolve ticker
  const validation = await validateTicker(input);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error, ticker: validation.ticker },
      { status: 400 },
    );
  }

  const { ticker, companyName, cik, isForeignIssuer } = validation;
  if (!companyName) {
    return NextResponse.json(
      { success: false, error: "Could not resolve company name", ticker },
      { status: 400 },
    );
  }

  // Add to watchlist
  const status = isForeignIssuer ? "unsupported" : "active";
  const statusMessage = isForeignIssuer
    ? `${companyName} is a foreign issuer and does not file SEC Form 4. Added for reference only.`
    : undefined;

  const result = await addToWatchlist({
    ticker,
    companyName,
    cik,
    addedAt: new Date().toISOString(),
    status,
    statusMessage,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, entries: result.entries },
      { status: 409 },
    );
  }

  // Bounded initial sync for active (supported) tickers only
  if (!isForeignIssuer) {
    try {
      const startTime = Date.now();
      const dedupKeys = await getAllDedupKeys();
      const fetchResult = await fetchInsiderTransactions(ticker, dedupKeys);

      const newRecords = fetchResult.newTransactions.map(txToRecord);
      const newDedupKeys = fetchResult.newTransactions.map((tx) => tx.id);

      if (newRecords.length > 0) {
        await storeTransactions(ticker, newRecords, newDedupKeys);
      }
      await setLastFetchTime(ticker, fetchResult.fetchedAt);
      await updateWatchlistSync(
        ticker,
        fetchResult.errors.length > 0 ? "error" : "active",
        fetchResult.errors.length > 0
          ? `Initial sync completed with ${fetchResult.errors.length} error(s)`
          : undefined,
      );

      const elapsedMs = Date.now() - startTime;
      recordSync({
        timestamp: new Date().toISOString(),
        source: "sec-edgar",
        ticker,
        durationMs: elapsedMs,
        newRecords: fetchResult.newTransactions.length,
        totalRecords: fetchResult.allTransactions.length,
        errors: fetchResult.errors.length,
        errorMessages: fetchResult.errors,
      });

      return NextResponse.json({
        success: true,
        added: { ticker, companyName, cik, status },
        entries: result.entries,
        initialSync: {
          newTransactions: fetchResult.newTransactions.length,
          totalTransactions: fetchResult.allTransactions.length,
          errors: fetchResult.errors,
          durationMs: elapsedMs,
        },
        _limits: {
          maxFilingsPerCompany: SYNC_CONFIG.MAX_FILINGS_PER_COMPANY,
        },
      });
    } catch (syncErr) {
      // Sync failure shouldn't prevent the ticker from being added
      const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
      await updateWatchlistSync(ticker, "error", `Initial sync failed: ${message}`);

      return NextResponse.json({
        success: true,
        added: { ticker, companyName, cik, status },
        entries: result.entries,
        initialSync: {
          newTransactions: 0,
          totalTransactions: 0,
          errors: [message],
          failed: true,
        },
      });
    }
  } else {
    // Foreign issuer — mark synced immediately (no SEC data expected)
    await updateWatchlistSync(ticker, "unsupported", statusMessage);
  }

  return NextResponse.json({
    success: true,
    added: { ticker, companyName, cik, status },
    entries: result.entries,
    initialSync: isForeignIssuer
      ? { skipped: true, reason: "Foreign issuer — does not file SEC Form 4" }
      : undefined,
  });
}