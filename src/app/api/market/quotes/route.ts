import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchStockQuotes } from "@/lib/market/quotes";

/** CDN + data cache: identical ticker sets reuse work across clients. */
export const revalidate = 300;

function normalizeTickers(tickers: string[]): string[] {
  return Array.from(
    new Set(
      tickers
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();
}

const loadQuotes = unstable_cache(
  async (tickersKey: string) => {
    const tickers = tickersKey.split(",").filter(Boolean);
    const chunkSize = 30;
    const quotes = [];
    for (let i = 0; i < tickers.length; i += chunkSize) {
      const chunk = tickers.slice(i, i + chunkSize);
      quotes.push(...(await fetchStockQuotes(chunk)));
    }
    return quotes;
  },
  ["market-quotes-v1"],
  { revalidate: 300 },
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickers = normalizeTickers(
    searchParams.get("tickers")?.split(",") ?? [],
  );

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "tickers query parameter is required" },
      { status: 400 },
    );
  }

  const quotes = await loadQuotes(tickers.join(","));

  return NextResponse.json(
    { quotes, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
