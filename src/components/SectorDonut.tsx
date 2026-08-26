"use client";

import { useMemo } from "react";
import DonutChart from "./DonutChart";
import type { SectorAllocation } from "@/lib/portfolio/types";

/** Shared palette for stock sectors + ETF exposure sleeves. */
const SECTOR_NAME_COLORS: Record<string, string> = {
  "U.S. Equity": "#0052CC",
  "International Equity": "#7F55E0",
  "Fixed Income": "#00B8D9",
  Cash: "#00875A",
  Commodities: "#F59E0B",
  Currency: "#A67C52",
  Crypto: "#F97316",
  "Other ETF": "#64748B",
  "Other Fund": "#64748B",
  Index: "#475569",
  Technology: "#0052CC",
  Financials: "#00875A",
  "Health Care": "#E0115F",
  Healthcare: "#E0115F",
  Energy: "#FF6B35",
  Industrials: "#00B8D9",
  "Consumer Discretionary": "#7F55E0",
  "Consumer Cyclical": "#7F55E0",
  "Consumer Staples": "#DA62AC",
  "Consumer Defensive": "#DA62AC",
  Utilities: "#F5CD47",
  "Real Estate": "#A67C52",
  "Communication Services": "#00C7E5",
  Materials: "#F59E0B",
  "Basic Materials": "#F59E0B",
  Other: "#6b7280",
  Unclassified: "#6b7280",
};

function getSectorColor(sectorName: string): string {
  return SECTOR_NAME_COLORS[sectorName] ?? "#6b7280";
}

interface SectorDonutProps {
  sectors: SectorAllocation[];
}

export default function SectorDonut({ sectors }: SectorDonutProps) {
  const slices = useMemo(() => {
    if (sectors.length === 0) return [];

    return [...sectors]
      .filter((sector) => sector.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .map((sector) => ({
        name: sector.sector,
        pct: sector.weight,
        color: getSectorColor(sector.sector),
      }));
  }, [sectors]);

  if (slices.length === 0) return null;

  return <DonutChart slices={slices} size={188} />;
}
