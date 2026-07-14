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
    .slice(0, 30) ?? [];

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "tickers query parameter is required" },
      { status: 400 },
    );
  }

  const quotes = await fetchStockQuotes(tickers);
  return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
}
