"use client";

import { useMemo } from "react";
import DonutChart from "./DonutChart";

// ── Market cap categories ──

const MEGA_CAP = 200_000_000_000; // $200B+
const LARGE_CAP = 10_000_000_000; // $10B+
const MID_CAP = 2_000_000_000; // $2B+

// Yahoo Finance sometimes doesn't return marketCap for ETFs.
// Fallback map for common tickers the portfolio might hold.
const MARKET_CAP_FALLBACK: Record<string, number> = {
  VOOG: 80_000_000_000, // Vanguard S&P 500 Growth ETF ~$80B AUM
  VOO: 400_000_000_000,
  SPY: 500_000_000_000,
  QQQ: 250_000_000_000,
  VTI: 350_000_000_000,
  IVV: 400_000_000_000,
  VXUS: 80_000_000_000,
  BND: 60_000_000_000,
  XLF: 40_000_000_000,
  XLK: 50_000_000_000,
  XLE: 30_000_000_000,
  XLI: 20_000_000_000,
  XLV: 30_000_000_000,
  XLY: 20_000_000_000,
  XLP: 15_000_000_000,
  XLU: 15_000_000_000,
  XLRE: 10_000_000_000,
  XLC: 15_000_000_000,
  XLB: 10_000_000_000,
  GLD: 70_000_000_000,
  SLV: 12_000_000_000,
  TLT: 30_000_000_000,
  IWM: 60_000_000_000,
  DIA: 30_000_000_000,
  AJG: 60_000_000_000, // Arthur J. Gallagher & Co. ~$60B
};

const CAP_COLORS: Record<string, string> = {
  "Mega Cap": "#818cf8",
  "Large Cap": "#5eead4",
  "Mid Cap": "#fbbf24",
  "Small Cap": "#fb7185",
  Unknown: "#6b7280",
};

function getEffectiveMarketCap(ticker: string, apiMarketCap: number | null): number | null {
  if (apiMarketCap !== null && apiMarketCap > 0) return apiMarketCap;
  return MARKET_CAP_FALLBACK[ticker.toUpperCase()] ?? null;
}

function classifyCap(marketCap: number | null): string {
  if (marketCap === null || marketCap <= 0) return "Unknown";
  if (marketCap >= MEGA_CAP) return "Mega Cap";
  if (marketCap >= LARGE_CAP) return "Large Cap";
  if (marketCap >= MID_CAP) return "Mid Cap";
  return "Small Cap";
}

interface MarketCapDonutProps {
  /** Array of { ticker, marketValue, marketCap } for each position */
  positions: Array<{
    ticker: string;
    marketValue: number | null;
    marketCap: number | null;
  }>;
}

export default function MarketCapDonut({ positions }: MarketCapDonutProps) {
  const slices = useMemo(() => {
    const buckets = new Map<string, number>();
    let total = 0;

    for (const pos of positions) {
      const mv = pos.marketValue ?? 0;
      if (mv <= 0) continue;
      total += mv;
      const effectiveCap = getEffectiveMarketCap(pos.ticker, pos.marketCap);
      const cap = classifyCap(effectiveCap);
      buckets.set(cap, (buckets.get(cap) ?? 0) + mv);
    }

    if (total <= 0) return [];

    const result = Array.from(buckets.entries())
      .map(([name, value]) => ({
        name,
        pct: (value / total) * 100,
        color: CAP_COLORS[name] ?? "#6b7280",
      }))
      .sort((a, b) => b.pct - a.pct);

    return result;
  }, [positions]);

  if (slices.length === 0) return null;

  return <DonutChart slices={slices} />;
}