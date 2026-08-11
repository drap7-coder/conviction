import { NextResponse } from "next/server";
import { getLivePrice } from "@/lib/market/live-quote";
import {
  fetchMarketNarrativePulse,
  MARKET_NARRATIVE_THEMES,
} from "@/lib/market/market-narratives";
import { fetchStockQuotes } from "@/lib/market/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = Array.from(new Set(
    MARKET_NARRATIVE_THEMES.flatMap((theme) => theme.assets.map((asset) => asset.ticker)),
  ));
  const quotes = await fetchStockQuotes(tickers);
  const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]));
  const moves = new Map(tickers.map((ticker) => {
    const quote = quoteMap.get(ticker);
    const live = quote ? getLivePrice(quote) : null;
    return [ticker, live?.changePercent ?? quote?.changePercent ?? null] as const;
  }));
  const marketNarratives = await fetchMarketNarrativePulse(moves);

  return NextResponse.json({
    marketNarratives,
    fetchedAt: new Date().toISOString(),
  });
}
