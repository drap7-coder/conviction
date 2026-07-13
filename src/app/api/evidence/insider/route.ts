import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/evidence/insider
 * Returns insider transaction evidence for a ticker.
 *
 * Query params:
 *   ticker (required) — e.g., OXY
 *
 * Returns structured EvidenceEvent objects converted from raw Form 4 data.
 */

import { getStoredTransactions, recordToTx } from "@/lib/sec/persist";
import { insiderToEvidenceEvent } from "@/lib/sec/evidence-converter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const stored = await getStoredTransactions(ticker);

    // Convert stored records back to InsiderTransactions, then to evidence events
    const transactions = stored.map(recordToTx);
    const events = transactions.map((tx) => insiderToEvidenceEvent(tx));

    // Sort by date descending
    events.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      ticker,
      events,
      total: events.length,
      source: stored.length > 0 ? "real" : "none",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[api/evidence/insider] ${ticker}:`, err);
    return NextResponse.json(
      { error: "Failed to retrieve insider evidence", ticker, events: [], total: 0, source: "error" },
      { status: 200 }, // Return 200 with empty data so UI handles gracefully
    );
  }
}