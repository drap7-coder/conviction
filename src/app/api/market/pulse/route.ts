import { NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { getWatchlist } from "@/lib/watchlist/persist";
import { SECTORS } from "@/lib/market/industries";
import {
  classifyMacroRegime,
  type IndicatorSnapshot,
  type MacroRegime,
} from "@/lib/market/macro-regime";
import {
  classifySectorLeadership,
  type SectorLeadership,
} from "@/lib/market/sector-classification";
import { runTriage, type TriageWatchlistInput, type TriageResult } from "@/lib/market/triage";
import {
  fetchMarketNarrativePulse,
  MARKET_NARRATIVE_THEMES,
  type MarketNarrativePulse,
} from "@/lib/market/market-narratives";

export const dynamic = "force-dynamic";

export type DataStatus = "ready" | "proxy" | "delayed" | "stale" | "unsupported" | "error";

const INDICATORS: Array<{
  ticker: string;
  label: string;
  status: DataStatus;
  isPercentValue?: boolean;
}> = [
  { ticker: "SPY", label: "S&P 500", status: "proxy" },
  { ticker: "QQQ", label: "Nasdaq", status: "proxy" },
  { ticker: "^VIX", label: "VIX", status: "ready" },
  { ticker: "USO", label: "Oil", status: "proxy" },
  { ticker: "^TNX", label: "10Y Yield", status: "ready", isPercentValue: true },
  { ticker: "UUP", label: "Dollar", status: "proxy" },
];

const GLOBAL_MARKETS = [
  // Broad market / size proxies — sector ETFs stay on the Sectors tab.
  { ticker: "DIA", name: "Dow Jones Industrial Average", weight: 14, category: "Major Index" },
  { ticker: "SPY", name: "S&P 500", weight: 30, category: "Major Index" },
  { ticker: "QQQ", name: "Nasdaq 100", weight: 18, category: "Major Index" },
  { ticker: "IWM", name: "Russell 2000", weight: 9, category: "Major Index" },
  { ticker: "MDY", name: "S&P MidCap 400", weight: 6, category: "Major Index" },
  { ticker: "RSP", name: "S&P 500 Equal Weight", weight: 8.5, category: "Major Index" },
  // Style / factor sleeves (dividend, real estate, transports).
  { ticker: "SCHD", name: "U.S. Dividend 100", weight: 10, category: "Themes" },
  { ticker: "VNQ", name: "U.S. Real Estate", weight: 8, category: "Themes" },
  { ticker: "IYT", name: "Transportation", weight: 7, category: "Themes" },
  { ticker: "USO", name: "Crude Oil", weight: 8, category: "Commodity" },
  { ticker: "GLD", name: "Gold", weight: 7, category: "Commodity" },
  { ticker: "SLV", name: "Silver", weight: 5, category: "Commodity" },
  { ticker: "UUP", name: "U.S. Dollar", weight: 6, category: "Commodity" },
  { ticker: "BTC-USD", name: "Bitcoin", weight: 12, category: "Crypto" },
  { ticker: "ETH-USD", name: "Ethereum", weight: 10, category: "Crypto" },
  { ticker: "SOL-USD", name: "Solana", weight: 8, category: "Crypto" },
  // Keep International to six countries so the heatmap stays scannable.
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
  weight: number;
}

export interface PulseGlobalMarket {
  ticker: string;
  name: string;
  changePercent: number | null;
  price: number | null;
  weight: number;
  category: string;
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
  macroRegime: MacroRegime;
  sectorLeadership: SectorLeadership;
  triage: TriageResult;
  marketNarratives: MarketNarrativePulse;
  /** Pre-Market / After Hours when any tracked US quote is in extended hours. */
  sessionLabel: string | null;
  fetchedAt: string;
}

export async function GET() {
  const watchlist = await getWatchlist();
  const watchlistTickers = watchlist
    .filter((e) => e.status === "active")
    .map((e) => e.ticker);

  const sectorTickers = SECTORS.map((s) => s.ticker);
  const narrativeTickers = Array.from(new Set(
    MARKET_NARRATIVE_THEMES.flatMap((theme) => theme.assets.map((asset) => asset.ticker)),
  ));
  const allTickers = [
    ...INDICATORS.map((i) => i.ticker),
    ...sectorTickers,
    ...GLOBAL_MARKETS.map((market) => market.ticker),
    ...watchlistTickers,
    ...narrativeTickers,
  ];
  const quotes = await fetchStockQuotes(allTickers);
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));
  const liveFor = (ticker: string) => {
    const quote = quoteMap.get(ticker);
    return quote ? getLivePrice(quote) : null;
  };
  let sessionLabel: string | null = null;
  for (const quote of quotes) {
    const label = getLivePrice(quote).label;
    if (label) {
      sessionLabel = label;
      break;
    }
  }

  // ── Indicators ──
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

  // ── Macro regime ──
  const indicatorSnapshots: IndicatorSnapshot[] = indicators.map((i) => ({
    ticker: i.ticker,
    label: i.label,
    price: i.price,
    change: i.change,
    changePercent: i.changePercent,
    isPercentValue: i.isPercentValue,
    status: i.status,
  }));
  const macroRegime = classifyMacroRegime(indicatorSnapshots);

  // ── Sectors (sorted by performance) ──
  const sectors: PulseSector[] = SECTORS.map((sector) => {
    const live = liveFor(sector.ticker);
    const q = quoteMap.get(sector.ticker);
    return {
      ticker: sector.ticker,
      name: sector.name,
      changePercent: live?.changePercent ?? q?.changePercent ?? null,
      weight: SECTOR_WEIGHTS[sector.ticker] ?? 0,
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const sectorLeadership = classifySectorLeadership(sectors);

  const globalMarkets: PulseGlobalMarket[] = GLOBAL_MARKETS.map((market) => {
    const live = liveFor(market.ticker);
    const quote = quoteMap.get(market.ticker);
    return {
      ...market,
      price: live?.price ?? quote?.price ?? null,
      changePercent: live?.changePercent ?? quote?.changePercent ?? null,
    };
  });
  // Keep definition order within each category section on Pulse.
  // Do not resort the full list by session move.

  // ── Broad market narratives (Yahoo + Google News RSS) ──
  const marketNarratives = await fetchMarketNarrativePulse(
    new Map(narrativeTickers.map((ticker) => [
      ticker,
      liveFor(ticker)?.changePercent ?? quoteMap.get(ticker)?.changePercent ?? null,
    ])),
  );

  // ── Triage ──
  const triageItems: TriageWatchlistInput[] = watchlistTickers.map((ticker) => {
    const q = quoteMap.get(ticker);
    const live = liveFor(ticker);
    const entry = watchlist.find((e) => e.ticker === ticker);
    return {
      ticker,
      companyName: entry?.companyName ?? ticker,
      price: live?.price ?? q?.price ?? null,
      changePercent: live?.changePercent ?? q?.changePercent ?? null,
      snapshot: null, // conviction snapshots require per-ticker server-side fetch
      portfolio: {
        held: false,
        positionChange: null,
      },
    };
  });
  const triage = runTriage(triageItems);

  return NextResponse.json({
    indicators,
    sectors,
    globalMarkets,
    macroRegime,
    sectorLeadership,
    triage,
    marketNarratives,
    sessionLabel,
    fetchedAt: new Date().toISOString(),
  });
}
