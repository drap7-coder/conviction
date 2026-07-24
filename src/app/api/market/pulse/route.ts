import { NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { getWatchlist } from "@/lib/watchlist/persist";
import { SECTORS } from "@/lib/market/industries";

export const dynamic = "force-dynamic";

export type DataStatus = "ready" | "proxy" | "delayed" | "stale" | "unsupported" | "error";

const INDICATORS: Array<{
  ticker: string;
  label: string;
  status: DataStatus;
  /** When true, the value is a percentage (e.g. yield) and should be displayed with a % suffix */
  isPercentValue?: boolean;
}> = [
  { ticker: "SPY", label: "S&P 500", status: "proxy" },
  { ticker: "QQQ", label: "Nasdaq", status: "proxy" },
  { ticker: "^VIX", label: "VIX", status: "ready" },
  { ticker: "USO", label: "Oil", status: "proxy" },
  { ticker: "^TNX", label: "10Y Yield", status: "ready", isPercentValue: true },
  { ticker: "UUP", label: "Dollar", status: "proxy" },
];

export interface PulseIndicator {
  ticker: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  status: DataStatus;
  isPercentValue: boolean;
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
  const allTickers = [
    ...INDICATORS.map((i) => i.ticker),
    ...sectorTickers,
    ...watchlistTickers,
  ];
  const quotes = await fetchStockQuotes(allTickers);
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

  // ── Indicators with normalized type and status ──
  const indicators: PulseIndicator[] = INDICATORS.map((indicator) => {
    const q = quoteMap.get(indicator.ticker);
    return {
      ticker: indicator.ticker,
      label: indicator.label,
      status: indicator.status,
      isPercentValue: indicator.isPercentValue ?? false,
      price: q?.price ?? null,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
    };
  });

  // ── Sectors (sorted by performance) ──
  const sectors: PulseSector[] = SECTORS.map((sector) => {
    const q = quoteMap.get(sector.ticker);
    return {
      ticker: sector.ticker,
      name: sector.name,
      changePercent: q?.changePercent ?? null,
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  // ── Watchlist ──
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