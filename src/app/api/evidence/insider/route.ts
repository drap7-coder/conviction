import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/evidence/insider
 * Returns insider transaction evidence for a ticker.
 *
 * Query params:
 *   ticker (required) — e.g., OXY
 *
 * Returns structured EvidenceEvent objects converted from raw Form 4 data.
 * Fetches fresh from SEC when no stored data is available.
 */

import { getStoredTransactions, recordToTx } from "@/lib/sec/persist";
import { fetchInsiderTransactions } from "@/lib/sec/client";
import { insiderToEvidenceEvent } from "@/lib/sec/evidence-converter";
import { isRequestTimeout } from "@/lib/request-timeout";

import type { EvidenceEvent } from "@/lib/evidence/types";

type InsiderPayload = {
  ticker: string;
  events: EvidenceEvent[];
  total: number;
  source: string;
  fetchedAt: string;
  status: "success" | "empty";
};

// Global in-memory cache (per Vercel instance)
const memoryCache = new Map<string, {
  events: EvidenceEvent[];
  fetchedAt: number;
}>();
const pendingCache = new Map<string, Promise<InsiderPayload>>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const dynamic = "force-dynamic";

async function buildInsiderPayload(ticker: string): Promise<InsiderPayload> {
  // Try stored transactions (from KV or persistence layer)
  const stored = await getStoredTransactions(ticker);

  let transactions = stored.map(recordToTx);
  let source: string;

  if (transactions.length > 0) {
    source = "stored";
  } else {
    // No stored data — fetch fresh from SEC
    const result = await fetchInsiderTransactions(ticker);
    transactions = result.allTransactions;
    source = result.allTransactions.length > 0 ? "real" : "none";
    if (result.errors.length > 0) {
      console.warn(`[api/evidence/insider] ${ticker} fetch errors:`, result.errors);
    }
  }

  // Convert to evidence events
  const events = transactions.map((tx) => insiderToEvidenceEvent(tx));

  // Sort by date descending
  events.sort((a, b) => b.date.localeCompare(a.date));

  const fetchedAt = Date.now();
  memoryCache.set(ticker, { events, fetchedAt });

  return {
    ticker,
    events,
    total: events.length,
    source,
    fetchedAt: new Date(fetchedAt).toISOString(),
    status: events.length > 0 ? "success" : "empty",
  };
}

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
    // Check in-memory cache first
    const cached = memoryCache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        ticker,
        events: cached.events,
        total: cached.events.length,
        source: "cached",
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        status: cached.events.length > 0 ? "success" : "empty",
      });
    }

    const existing = pendingCache.get(ticker);
    if (existing) {
      return NextResponse.json(await existing);
    }

    const pending = buildInsiderPayload(ticker);
    pendingCache.set(ticker, pending);
    try {
      return NextResponse.json(await pending);
    } finally {
      pendingCache.delete(ticker);
    }
  } catch (err) {
    console.error(`[api/evidence/insider] ${ticker}:`, err);
    const timedOut = isRequestTimeout(err);
    return NextResponse.json({
      error: timedOut
        ? "Insider transaction data is temporarily unavailable."
        : "Failed to retrieve insider evidence",
      ticker,
      events: [],
      total: 0,
      source: timedOut ? "timeout" : "error",
      status: timedOut ? "timeout" : "error",
      fetchedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}
