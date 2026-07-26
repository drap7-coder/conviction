import { NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/market/quotes";
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
  { ticker: "^MOVE", label: "MOVE Index", status: "ready" },
  { ticker: "UUP", label: "Dollar", status: "proxy" },
];

const GLOBAL_MARKETS = [
  { ticker: "SPY", name: "S&P 500", weight: 30, category: "United States" },
  { ticker: "QQQ", name: "Nasdaq 100", weight: 18, category: "United States" },
  { ticker: "DIA", name: "Dow 30", weight: 14, category: "United States" },
  { ticker: "IWM", name: "Russell 2000", weight: 9, category: "United States" },
  { ticker: "RSP", name: "S&P 500 Equal Weight", weight: 8.5, category: "United States" },
  { ticker: "MDY", name: "S&P MidCap 400", weight: 6, category: "United States" },
  { ticker: "BTC-USD", name: "Bitcoin", weight: 12, category: "Crypto" },
  { ticker: "EWJ", name: "Japan", weight: 14.5, category: "International" },
  { ticker: "MCHI", name: "China", weight: 10.5, category: "International" },
  { ticker: "EWU", name: "United Kingdom", weight: 9.5, category: "International" },
  { ticker: "EWC", name: "Canada", weight: 8.0, category: "International" },
  { ticker: "ETH-USD", name: "Ethereum", weight: 6, category: "Crypto" },
  { ticker: "EWG", name: "Germany", weight: 6.5, category: "International" },
  { ticker: "EWQ", name: "France", weight: 5.5, category: "International" },
  { ticker: "INDA", name: "India", weight: 5.0, category: "International" },
  { ticker: "EWT", name: "Taiwan", weight: 4.8, category: "International" },
  { ticker: "EWA", name: "Australia", weight: 4.5, category: "International" },
  { ticker: "USO", name: "Oil", weight: 4, category: "Macro" },
  { ticker: "UUP", name: "U.S. Dollar", weight: 4, category: "Macro" },
  { ticker: "EWY", name: "South Korea", weight: 3.5, category: "International" },
  { ticker: "EWH", name: "Hong Kong", weight: 3.0, category: "International" },
  { ticker: "EWZ", name: "Brazil", weight: 2.5, category: "International" },
  { ticker: "SOL-USD", name: "Solana", weight: 2, category: "Crypto" },
  { ticker: "EWW", name: "Mexico", weight: 1.0, category: "International" },
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

  // ── Indicators ──
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
    const q = quoteMap.get(sector.ticker);
    return {
      ticker: sector.ticker,
      name: sector.name,
      changePercent: q?.changePercent ?? null,
      weight: SECTOR_WEIGHTS[sector.ticker] ?? 0,
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const sectorLeadership = classifySectorLeadership(sectors);

  const globalMarkets: PulseGlobalMarket[] = GLOBAL_MARKETS.map((market) => {
    const quote = quoteMap.get(market.ticker);
    return {
      ...market,
      price: quote?.price ?? null,
      changePercent: quote?.changePercent ?? null,
    };
  });
  globalMarkets.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  // ── Broad market narratives (free headlines + open chatter) ──
  const marketNarratives = await fetchMarketNarrativePulse(
    new Map(narrativeTickers.map((ticker) => [
      ticker,
      quoteMap.get(ticker)?.changePercent ?? null,
    ])),
  );

  // ── Triage ──
  const triageItems: TriageWatchlistInput[] = watchlistTickers.map((ticker) => {
    const q = quoteMap.get(ticker);
    const entry = watchlist.find((e) => e.ticker === ticker);
    return {
      ticker,
      companyName: entry?.companyName ?? ticker,
      price: q?.price ?? null,
      changePercent: q?.changePercent ?? null,
      snapshot: null, // conviction snapshots require per-ticker server-side fetch
      thesisStatus: entry?.thesis?.status ?? null,
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
    fetchedAt: new Date().toISOString(),
  });
}
