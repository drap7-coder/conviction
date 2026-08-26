"use client";

import { useMemo } from "react";
import type { SectorAllocation } from "@/lib/portfolio/types";
import { getSectorColor } from "@/lib/display/sector-colors";

/**
 * Ranked exposure mix — stocks use sectors; funds use asset-class sleeves.
 * This avoids pretending a broad ETF belongs to one company sector.
 */

interface SectorMixBarsProps {
  sectors: SectorAllocation[];
}

export default function SectorMixBars({ sectors }: SectorMixBarsProps) {
  const rows = useMemo(() => {
    return [...sectors]
      .filter((sector) => sector.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .map((sector) => ({
        name: sector.sector,
        weight: sector.weight,
        color: getSectorColor(sector.sector),
        count: sector.positionCount,
      }));
  }, [sectors]);

  if (rows.length === 0) return null;

  return (
    <ul className="pf-sector-bars" aria-label="Portfolio exposure mix">
      {rows.map((row) => (
        <li key={row.name} className="pf-sector-mix-row">
          <div className="pf-sector-mix-meta">
            <span className="pf-sector-mix-name">
              <span
                className="pf-sector-mix-dot"
                style={{ background: row.color }}
                aria-hidden="true"
              />
              {row.name}
            </span>
            <span className="pf-sector-mix-pct">{row.weight.toFixed(0)}%</span>
          </div>
          <div className="pf-sector-mix-track" aria-hidden="true">
            <div
              className="pf-sector-mix-fill"
              style={{
                width: `${Math.max(Math.min(row.weight, 100), 1.5)}%`,
                background: row.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
