"use client";

import { useMemo, useState } from "react";

// ── SVG arc helpers ──

const RADIUS = 40;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = 50;

interface Slice {
  name: string;
  pct: number;
  color: string;
  offset: number;
  dashArray: string;
}

export interface DonutSlice {
  name: string;
  pct: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Size of the SVG in px (default 140) */
  size?: number;
}

export default function DonutChart({ slices: inputSlices, size = 140 }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { slices, largest } = useMemo(() => {
    if (inputSlices.length === 0) return { slices: [], largest: null };

    // Sort by weight descending
    const sorted = [...inputSlices].sort((a, b) => b.pct - a.pct);

    // Top 5 + rest → "Other"
    let result: { name: string; pct: number; color: string }[];
    if (sorted.length <= 5) {
      result = sorted;
    } else {
      const top5 = sorted.slice(0, 5);
      const otherPct = sorted.slice(5).reduce((sum, s) => sum + s.pct, 0);
      result = [...top5];
      if (otherPct > 0) {
        result.push({ name: "Other", pct: otherPct, color: "#6b7280" });
      }
    }

    const largestSlice = result.length > 0 ? result[0] : null;

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

    return { slices, largest: largestSlice };
  }, [inputSlices]);

  if (!largest || slices.length === 0) return null;

  return (
    <div className="pf-donut-wrap">
      <div className="pf-donut-chart" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" aria-label="Donut chart">
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
          <text x={CENTER} y={CENTER - 5} textAnchor="middle" className="pf-donut-center-name">
            {largest.name}
          </text>
          <text x={CENTER} y={CENTER + 9} textAnchor="middle" className="pf-donut-center-pct">
            {Math.round(largest.pct)}%
          </text>
        </svg>
      </div>

      <div className="pf-donut-legend">
        {slices.map((slice, i) => (
          <div
            key={slice.name}
            className={`pf-donut-legend-item${hovered === i ? " pf-donut-legend-item-hover" : ""}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="pf-donut-legend-dot" style={{ background: slice.color }} />
            <span className="pf-donut-legend-name">{slice.name}</span>
            <span className="pf-donut-legend-pct">{Math.round(slice.pct)}%</span>
          </div>
        ))}
      </div>

      {hovered !== null && (
        <div className="pf-donut-tooltip">
          {slices[hovered].name}: {Math.round(slices[hovered].pct)}%
        </div>
      )}
    </div>
  );
}