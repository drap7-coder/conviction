import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { resolveHomeIndexLiveQuote } from "@/lib/market/home-index-quote";
import { easternSessionCacheKey, getExtendedSessionQuote, getLivePrice } from "@/lib/market/live-quote";
import { SECTORS } from "@/lib/market/industries";

/**
 * Pulse Markets / Crypto / Intl payload.
 * Kept lean: gauges + scoreboards only. No watchlist fan-out, macro essays,
 * or News RSS — those live elsewhere and burned Active CPU when bundled here.
 */
export const revalidate = 300;

export type DataStatus = "ready" | "proxy" | "delayed" | "stale" | "unsupported" | "error";

/** VIX + 10Y only — `PulseMacroGauges` ignores everything else. */
const INDICATORS: Array<{
  ticker: string;
  label: string;
  status: DataStatus;
  isPercentValue?: boolean;
}> = [
  { ticker: "^VIX", label: "VIX", status: "ready" },
  { ticker: "^TNX", label: "10Y Yield", status: "ready", isPercentValue: true },
];

/**
 * Scoreboard universe. DIA / cash SPX (+ SPY proxy) / QQQ / IWM for indexes
 * (no MDY/RSP). Crypto excludes Solana. International stays six countries.
 *
 * Cash ^GSPC has no Yahoo pre/AH print — fetch SPY as `proxyTicker` and surface
 * the row as display ticker SPX with an implied extended level.
 */
const GLOBAL_MARKETS = [
  { ticker: "DIA", name: "Dow Jones Industrial Average", weight: 14, category: "Major Index" },
  {
    ticker: "^GSPC",
    displayTicker: "SPX",
    proxyTicker: "SPY",
    name: "S&P 500",
    weight: 30,
    category: "Major Index",
  },
  { ticker: "QQQ", name: "Nasdaq 100", weight: 18, category: "Major Index" },
  { ticker: "IWM", name: "Russell 2000", weight: 9, category: "Major Index" },
  { ticker: "USO", name: "Crude Oil", weight: 8, category: "Commodity" },
  { ticker: "GLD", name: "Gold", weight: 7, category: "Commodity" },
  { ticker: "SLV", name: "Silver", weight: 5, category: "Commodity" },
  { ticker: "UNG", name: "Natural Gas", weight: 6, category: "Commodity" },
  { ticker: "BTC-USD", name: "Bitcoin", weight: 12, category: "Crypto" },
  { ticker: "ETH-USD", name: "Ethereum", weight: 10, category: "Crypto" },
  { ticker: "XRP-USD", name: "XRP", weight: 8, category: "Crypto" },
  { ticker: "DOGE-USD", name: "Dogecoin", weight: 6, category: "Crypto" },
  { ticker: "ADA-USD", name: "Cardano", weight: 5, category: "Crypto" },
  { ticker: "EWJ", name: "Japan", weight: 16, category: "International" },
  { ticker: "MCHI", name: "China", weight: 14, category: "International" },
  { ticker: "EWU", name: "United Kingdom", weight: 12, category: "International" },
  { ticker: "INDA", name: "India", weight: 11, category: "International" },
  { ticker: "EWT", name: "Taiwan", weight: 10, category: "International" },
  { ticker: "EWG", name: "Germany", weight: 9, category: "International" },
] as const;

export interface PulseIndicator {
  ticker: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  status: DataStatus;
  isPercentValue: boolean;
  history: Array<{ date: string; close: number }>;
}

export interface PulseSector {
  ticker: string;
  name: string;
  changePercent: number | null;
  /** Regular-session $ change (TV-style quote stacks). */
  change?: number | null;
  price: number | null;
  weight: number;
  history: Array<{ date: string; close: number }>;
  regularPrice?: number | null;
  regularChange?: number | null;
  regularChangePercent?: number | null;
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  sessionLabel?: string | null;
}

export interface PulseGlobalMarket {
  ticker: string;
  name: string;
  /** Live session % when extended; otherwise regular %. Kept for breadth/sort consumers. */
  changePercent: number | null;
  /** Display last: regular close in extended hours, live price when the market is open. */
  price: number | null;
  weight: number;
  category: string;
  history: Array<{ date: string; close: number }>;
  /** Regular-session close (always the RTH print). */
  regularPrice?: number | null;
  /** Regular-session day $ change. */
  regularChange?: number | null;
  /** Regular-session day %. */
  regularChangePercent?: number | null;
  /** Pre/AH last when a print exists; null means No trades in that window. */
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  /** True when the ET clock is pre/AH but Yahoo has no extended print yet. */
  extendedNoTrades?: boolean;
  /** Per-row Pre-Market / After Hours label when the clock is in that window. */
  sessionLabel?: string | null;
}

const SECTOR_WEIGHTS: Record<string, number> = {
  XLK: 29.8,
  XLF: 14.2,
  XLV: 11.1,
  XLY: 10.3,
  XLC: 9.4,
  XLI: 8.7,
  XLP: 5.6,
  XLE: 3.1,
  XLU: 2.5,
  XLRE: 2.1,
  XLB: 2.0,
};

export interface PulseData {
  indicators: PulseIndicator[];
  sectors: PulseSector[];
  globalMarkets: PulseGlobalMarket[];
  /** Pre-Market / After Hours when any tracked US quote is in extended hours. */
  sessionLabel: string | null;
  fetchedAt: string;
}

async function buildPulsePayload(): Promise<Omit<PulseData, "fetchedAt">> {
  const sectorTickers = SECTORS.map((s) => s.ticker);
  const allTickers = [
    ...INDICATORS.map((i) => i.ticker),
    ...sectorTickers,
    ...GLOBAL_MARKETS.flatMap((market) =>
      "proxyTicker" in market && market.proxyTicker
        ? [market.ticker, market.proxyTicker]
        : [market.ticker],
    ),
  ];
  const quotes = await fetchStockQuotes(allTickers);
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));
  const liveFor = (ticker: string) => {
    const quote = quoteMap.get(ticker.toUpperCase());
    return quote ? getLivePrice(quote) : null;
  };

  let sessionLabel: string | null = null;
  // Prefer US listed pulse names so crypto / intl clocks don’t smear Pre-Market onto the badge.
  for (const market of GLOBAL_MARKETS) {
    const quote = quoteMap.get(market.ticker.toUpperCase());
    const proxy =
      "proxyTicker" in market && market.proxyTicker
        ? quoteMap.get(market.proxyTicker.toUpperCase())
        : null;
    if (!quote) continue;
    const label =
      resolveHomeIndexLiveQuote(quote, proxy).label
      ?? getExtendedSessionQuote(quote).sessionLabel
      ?? getLivePrice(quote).label;
    if (label) {
      sessionLabel = label;
      break;
    }
  }
  if (!sessionLabel) {
    for (const quote of quotes) {
      const label = getLivePrice(quote).label;
      if (label) {
        sessionLabel = label;
        break;
      }
    }
  }

  const indicators: PulseIndicator[] = INDICATORS.map((indicator) => {
    const q = quoteMap.get(indicator.ticker);
    const live = liveFor(indicator.ticker);
    return {
      ticker: indicator.ticker,
      label: indicator.label,
      status: indicator.status,
      isPercentValue: indicator.isPercentValue ?? false,
      price: live?.price ?? q?.price ?? null,
      change: live?.change ?? q?.change ?? null,
      changePercent: live?.changePercent ?? q?.changePercent ?? null,
      history: q?.sparkline.slice(-15) ?? [],
    };
  });

  const sectors: PulseSector[] = SECTORS.map((sector) => {
    const live = liveFor(sector.ticker);
    const q = quoteMap.get(sector.ticker);
    const extended = q ? getExtendedSessionQuote(q) : null;
    const inExtended = Boolean(extended?.sessionLabel);
    return {
      ticker: sector.ticker,
      name: sector.name,
      changePercent: inExtended ? (extended?.changePercent ?? null) : (q?.changePercent ?? null),
      change: inExtended ? (extended?.change ?? null) : (q?.change ?? null),
      price: inExtended ? (extended?.price ?? q?.price ?? null) : (q?.price ?? null),
      weight: SECTOR_WEIGHTS[sector.ticker] ?? 0,
      history: q?.sparkline.slice(-15) ?? [],
      regularPrice: q?.price ?? null,
      regularChange: q?.change ?? null,
      regularChangePercent: q?.changePercent ?? null,
      extendedPrice: extended?.price ?? null,
      extendedChange: extended?.change ?? null,
      extendedChangePercent: extended?.changePercent ?? null,
      extendedNoTrades: extended?.noTrades ?? false,
      sessionLabel: extended?.sessionLabel ?? null,
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  const globalMarkets: PulseGlobalMarket[] = GLOBAL_MARKETS.map((market) => {
    const quote = quoteMap.get(market.ticker.toUpperCase());
    const proxy =
      "proxyTicker" in market && market.proxyTicker
        ? quoteMap.get(market.proxyTicker.toUpperCase())
        : null;
    const live = quote ? resolveHomeIndexLiveQuote(quote, proxy) : liveFor(market.ticker);
    const nativeExtended = quote ? getExtendedSessionQuote(quote) : null;
    const sessionFromLive = live?.label ?? null;
    const inExtended = Boolean(sessionFromLive || nativeExtended?.sessionLabel);
    const displayTicker =
      "displayTicker" in market && market.displayTicker ? market.displayTicker : market.ticker;
    const historySource =
      sessionFromLive && proxy && proxy.sparkline.length >= 2 ? proxy : quote;

    return {
      ticker: displayTicker,
      name: market.name,
      weight: market.weight,
      category: market.category,
      // RTH close stays in `price` during extended so the grid can promote live last.
      price: inExtended
        ? (quote?.price ?? null)
        : (live?.price ?? quote?.price ?? null),
      changePercent: inExtended
        ? (quote?.changePercent ?? null)
        : (live?.changePercent ?? quote?.changePercent ?? null),
      history: historySource?.sparkline.slice(-15) ?? [],
      regularPrice: quote?.price ?? null,
      regularChange: quote?.change ?? null,
      regularChangePercent: quote?.changePercent ?? null,
      extendedPrice: inExtended ? (live?.price ?? nativeExtended?.price ?? null) : null,
      extendedChange: inExtended ? (live?.change ?? nativeExtended?.change ?? null) : null,
      extendedChangePercent: inExtended
        ? (live?.changePercent ?? nativeExtended?.changePercent ?? null)
        : null,
      extendedNoTrades: inExtended
        ? (live?.price == null && (nativeExtended?.noTrades ?? true))
        : false,
      sessionLabel: sessionFromLive ?? nativeExtended?.sessionLabel ?? null,
    };
  });

  return {
    indicators,
    sectors,
    globalMarkets,
    sessionLabel,
  };
}

const loadPulse = unstable_cache(
  async (_sessionKey: string) => buildPulsePayload(),
  ["market-pulse-v4"],
  { revalidate: 300 },
);

export async function GET() {
  const payload = await loadPulse(easternSessionCacheKey());

  return NextResponse.json(
    {
      ...payload,
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
