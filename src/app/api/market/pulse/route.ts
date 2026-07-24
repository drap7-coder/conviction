import { NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { getWatchlist } from "@/lib/watchlist/persist";
import { SECTORS } from "@/lib/market/industries";

export const dynamic = "force-dynamic";

const INDICATOR_TICKERS = ["SPY", "QQQ", "^TNX", "^VIX", "USO", "UUP"];

const INDICATOR_NAMES: Record<string, string> = {
  SPY: "S&P",
  QQQ: "NASDAQ",
  "^TNX": "10Y",
  "^VIX": "VIX",
  USO: "Oil",
  UUP: "Dollar",
};

export interface PulseIndicator {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface PulseSector {
  ticker: string;
  name: string;
  changePercent: number | null;
}

export interface PulseWatchlistItem {
  ticker: string;
  companyName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface PulseData {
  indicators: PulseIndicator[];
  sectors: PulseSector[];
  watchlist: PulseWatchlistItem[];
  fetchedAt: string;
}

export async function GET() {
  const watchlist = await getWatchlist();
  const watchlistTickers = watchlist
    .filter((e) => e.status === "active")
    .map((e) => e.ticker);

  const sectorTickers = SECTORS.map((s) => s.ticker);
  const allTickers = [...INDICATOR_TICKERS, ...sectorTickers, ...watchlistTickers];
  const quotes = await fetchStockQuotes(allTickers);
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

  const indicators: PulseIndicator[] = INDICATOR_TICKERS.map((ticker) => {
    const q = quoteMap.get(ticker);
    return {
      ticker,
      name: INDICATOR_NAMES[ticker] ?? ticker,
      price: q?.price ?? null,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
    };
  });

  const sectors: PulseSector[] = SECTORS.map((sector) => {
    const q = quoteMap.get(sector.ticker);
    return {
      ticker: sector.ticker,
      name: sector.name,
      changePercent: q?.changePercent ?? null,
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  const watchlistItems: PulseWatchlistItem[] = watchlistTickers.map((ticker) => {
    const q = quoteMap.get(ticker);
    const entry = watchlist.find((e) => e.ticker === ticker);
    return {
      ticker,
      companyName: entry?.companyName ?? ticker,
      price: q?.price ?? null,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
    };
  });

  return NextResponse.json({
    indicators,
    sectors,
    watchlist: watchlistItems,
    fetchedAt: new Date().toISOString(),
  });
}