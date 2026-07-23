"use client";

import { useMemo } from "react";
import DonutChart from "./DonutChart";

// ── Market cap categories ──

const MEGA_CAP = 200_000_000_000; // $200B+
const LARGE_CAP = 10_000_000_000; // $10B+
const MID_CAP = 2_000_000_000; // $2B+

const CAP_COLORS: Record<string, string> = {
  "Mega Cap": "#818cf8",
  "Large Cap": "#5eead4",
  "Mid Cap": "#fbbf24",
  "Small Cap": "#fb7185",
  Unknown: "#6b7280",
};

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
      const cap = classifyCap(pos.marketCap);
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