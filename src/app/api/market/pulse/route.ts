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
  macroRegime: MacroRegime;
  sectorLeadership: SectorLeadership;
  triage: TriageResult;
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
    };
  });
  sectors.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const sectorLeadership = classifySectorLeadership(sectors);

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
    watchlist: watchlistItems,
    macroRegime,
    sectorLeadership,
    triage,
    fetchedAt: new Date().toISOString(),
  });
}