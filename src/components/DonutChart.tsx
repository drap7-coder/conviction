"use client";

import { useMemo, useState } from "react";

const VIEW = 100;
const CENTER = 50;
const OUTER_R = 42;
const INNER_R = 26;

export interface DonutSlice {
  name: string;
  pct: number;
  color: string;
}

interface PreparedSlice {
  name: string;
  pct: number;
  color: string;
  path: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Size of the SVG face in px (default 140) */
  size?: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Annular sector path (donut wedge) from startDeg → endDeg (clockwise from top). */
function donutWedgePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = Math.max(Math.min(endDeg - startDeg, 359.999), 0.001);
  const end = startDeg + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, outerR, startDeg);
  const o1 = polar(cx, cy, outerR, end);
  const i1 = polar(cx, cy, innerR, end);
  const i0 = polar(cx, cy, innerR, startDeg);
  return [
    `M ${o0.x.toFixed(3)} ${o0.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x.toFixed(3)} ${i0.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({ slices: inputSlices, size = 140 }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { slices, largest } = useMemo(() => {
    if (inputSlices.length === 0) return { slices: [] as PreparedSlice[], largest: null };

    const sorted = [...inputSlices].sort((a, b) => b.pct - a.pct);

    let result: DonutSlice[];
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

    const largestSlice = result[0] ?? null;
    let cursor = 0;
    const prepared: PreparedSlice[] = result.map((seg) => {
      const start = cursor;
      const sweep = (seg.pct / 100) * 360;
      cursor += sweep;
      return {
        name: seg.name,
        pct: seg.pct,
        color: seg.color,
        path: donutWedgePath(CENTER, CENTER, OUTER_R, INNER_R, start, start + sweep),
      };
    });

    return { slices: prepared, largest: largestSlice };
  }, [inputSlices]);

  if (!largest || slices.length === 0) return null;

  const active = hovered !== null ? slices[hovered] : largest;

  return (
    <div className="pf-donut-wrap pf-donut-wrap--flat">
      <div className="pf-donut-stage" style={{ ["--pf-donut-size" as string]: `${size}px` }}>
        <div className="pf-donut-chart">
          <svg className="pf-donut-face" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-label="Sector mix chart">
            {slices.map((slice, i) => (
              <path
                key={slice.name}
                d={slice.path}
                fill={slice.color}
                className={`pf-donut-slice${hovered === i ? " pf-donut-slice-hover" : ""}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={INNER_R - 0.4}
              className="pf-donut-well"
              pointerEvents="none"
            />
          </svg>
        </div>
      </div>
      <div className="pf-donut-readout" aria-hidden="true">
        <strong>{active.name}</strong>
        <span>{Math.round(active.pct)}%</span>
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

      {hovered !== null ? (
        <div className="pf-donut-tooltip">
          {slices[hovered].name}: {Math.round(slices[hovered].pct)}%
        </div>
      ) : null}
    </div>
  );
}
