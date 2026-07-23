"use client";

import { useMemo } from "react";
import DonutChart from "./DonutChart";
import type { SectorAllocation } from "@/lib/portfolio/types";

// ── Sector name → color ──

const SECTOR_NAME_COLORS: Record<string, string> = {
  Technology: "#0052CC",
  Financials: "#00875A",
  "Health Care": "#E0115F",
  Energy: "#FF6B35",
  Industrials: "#00B8D9",
  "Consumer Discretionary": "#7F55E0",
  "Consumer Staples": "#DA62AC",
  Utilities: "#F5CD47",
  "Real Estate": "#A67C52",
  "Communication Services": "#00C7E5",
  Materials: "#F59E0B",
  Other: "#6b7280",
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

    const sorted = [...sectors].sort((a, b) => b.weight - a.weight);

    let result: { name: string; pct: number; color: string }[];
    if (sorted.length <= 5) {
      result = sorted.map((s) => ({
        name: s.sector,
        pct: s.weight,
        color: getSectorColor(s.sector),
      }));
    } else {
      const top5 = sorted.slice(0, 5);
      const otherPct = sorted.slice(5).reduce((sum, s) => sum + s.weight, 0);
      result = top5.map((s) => ({
        name: s.sector,
        pct: s.weight,
        color: getSectorColor(s.sector),
      }));
      if (otherPct > 0) {
        result.push({ name: "Other", pct: otherPct, color: "#6b7280" });
      }
    }

    return result;
  }, [sectors]);

  if (slices.length === 0) return null;

  return <DonutChart slices={slices} />;
}