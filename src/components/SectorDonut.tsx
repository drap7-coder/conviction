"use client";

import { useMemo } from "react";
import DonutChart from "./DonutChart";
import type { SectorAllocation } from "@/lib/portfolio/types";
import { getSectorColor } from "@/lib/display/sector-colors";

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

  return <DonutChart slices={slices} size={228} />;
}
