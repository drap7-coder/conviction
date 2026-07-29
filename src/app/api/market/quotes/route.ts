import { NextRequest, NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/market/quotes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams
    .get("tickers")
    ?.split(",")
    .map((ticker) => ticker.trim())
    .filter(Boolean)
    ?? [];

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "tickers query parameter is required" },
      { status: 400 },
    );
  }

  // The underlying Yahoo fetch is batched per request, but we also need to
  // keep concurrency/rate-limits under control when callers pass large lists
  // (e.g. scaled watchlists/portfolios).
  //
  // `fetchStockQuotes` already deduplicates and normalizes tickers, so this
  // chunking is primarily about bounding outbound fan-out.
  const unique = Array.from(new Set(tickers));
  const chunkSize = 30;
  const quotes = [];

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    // Sequential chunking: predictable load under concurrency.
    const next = await fetchStockQuotes(chunk);
    quotes.push(...next);
  }

  return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
}
