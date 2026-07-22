"use client";

import { useMemo, useState } from "react";
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
};

function getSectorColor(sectorName: string): string {
  return SECTOR_NAME_COLORS[sectorName] ?? "#6b7280";
}

// ── SVG arc helpers ──

const RADIUS = 40;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = 50;

interface Slice {
  name: string;
  pct: number;
  color: string;
  offset: number; // cumulative dashoffset
  dashArray: string;
}

interface SectorDonutProps {
  sectors: SectorAllocation[];
}

export default function SectorDonut({ sectors }: SectorDonutProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { slices, largest } = useMemo(() => {
    if (sectors.length === 0) return { slices: [], largest: null };

    // Sort by weight descending
    const sorted = [...sectors].sort((a, b) => b.weight - a.weight);

    // Top 5 + rest → "Other"
    let result: { name: string; pct: number; color: string }[];
    if (sorted.length <= 5) {
      // If 5 or fewer, keep all (no "Other")
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

    const largestSector = result.length > 0 ? result[0] : null;

    // Build SVG slice data
    let cumulative = 0;
    const slices: Slice[] = result.map((seg) => {
      const frac = seg.pct / 100;
      const dashLen = CIRCUMFERENCE * frac;
      const slice: Slice = {
        name: seg.name,
        pct: seg.pct,
        color: seg.color,
        offset: -cumulative,
        dashArray: `${Math.max(dashLen, 0.5)} ${CIRCUMFERENCE - Math.max(dashLen, 0.5)}`,
      };
      cumulative += dashLen;
      return slice;
    });

    return { slices, largest: largestSector };
  }, [sectors]);

  if (!largest || slices.length === 0) return null;

  return (
    <div className="pf-donut-wrap">
      {/* ── SVG Donut ── */}
      <div className="pf-donut-chart">
        <svg viewBox="0 0 100 100" aria-label="Sector allocation donut chart">
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {slices.map((slice, i) => (
              <circle
                key={slice.name}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={slice.dashArray}
                strokeDashoffset={slice.offset}
                strokeLinecap="round"
                className={`pf-donut-slice${hovered === i ? " pf-donut-slice-hover" : ""}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ transition: "opacity 0.15s, stroke-width 0.15s" }}
              />
            ))}
          </g>
          {/* Center label */}
          <text
            x={CENTER}
            y={CENTER - 5}
            textAnchor="middle"
            className="pf-donut-center-name"
          >
            {largest.name}
          </text>
          <text
            x={CENTER}
            y={CENTER + 9}
            textAnchor="middle"
            className="pf-donut-center-pct"
          >
            {Math.round(largest.pct)}%
          </text>
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="pf-donut-legend">
        {slices.map((slice, i) => (
          <div
            key={slice.name}
            className={`pf-donut-legend-item${hovered === i ? " pf-donut-legend-item-hover" : ""}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="pf-donut-legend-dot"
              style={{ background: slice.color }}
            />
            <span className="pf-donut-legend-name">{slice.name}</span>
            <span className="pf-donut-legend-pct">{Math.round(slice.pct)}%</span>
          </div>
        ))}
      </div>

      {/* ── Hover tooltip ── */}
      {hovered !== null && (
        <div className="pf-donut-tooltip">
          {slices[hovered].name}: {Math.round(slices[hovered].pct)}%
        </div>
      )}
    </div>
  );
}