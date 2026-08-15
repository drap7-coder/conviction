"use client";

import { useMemo } from "react";
import type { SectorAllocation } from "@/lib/portfolio/types";

/**
 * Ranked exposure mix — stocks use sectors; funds use asset-class sleeves.
 * This avoids pretending a broad ETF belongs to one company sector.
 */

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
  Energy: "#FF6B35",
  Industrials: "#00B8D9",
  "Consumer Discretionary": "#7F55E0",
  "Consumer Staples": "#DA62AC",
  Utilities: "#F5CD47",
  "Real Estate": "#A67C52",
  "Communication Services": "#00C7E5",
  Materials: "#F59E0B",
  Unclassified: "#6b7280",
};

function getSectorColor(sectorName: string): string {
  return SECTOR_NAME_COLORS[sectorName] ?? "#6b7280";
}

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
    <ul className="pf-sector-mix" aria-label="Portfolio exposure mix">
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
