"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export type MacroChainSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

const DEFAULT_COLORS = ["#0a7a52", "#c81e4a", "#b45309", "#c2410c", "#2563eb", "#0f766e", "#7c3aed"];

function normalize(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

function MacroTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-chart-tooltip">
      {payload.map((item) => (
        <span key={item.name} style={{ color: item.color }}>
          {item.name}: {item.value.toFixed(0)}
        </span>
      ))}
    </div>
  );
}

export function buildMacroSeriesFromQuotes(
  items: Array<{ ticker: string; label?: string; values: number[] }>,
  limit = 5,
): MacroChainSeries[] {
  return items
    .filter((item) => item.values.length >= 2)
    .slice(0, limit)
    .map((item, index) => ({
      key: item.ticker.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: item.label ?? item.ticker,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      values: item.values.slice(-15),
    }));
}

export function MacroChainChart({
  series,
  title = "Macro Chain",
  subtitle = "Last 15 points · normalized 0–100",
}: {
  series: MacroChainSeries[];
  title?: string;
  subtitle?: string;
}) {
  const data = useMemo(() => {
    const normalized = series.map((item) => normalize(item.values));
    const length = Math.max(...normalized.map((points) => points.length), 0);
    return Array.from({ length }, (_, index) => {
      const row: Record<string, number> = { point: index };
      series.forEach((item, seriesIndex) => {
        const values = normalized[seriesIndex];
        const offset = length - values.length;
        if (index >= offset) row[item.key] = values[index - offset];
      });
      return row;
    });
  }, [series]);

  return (
    <section className="market-panel market-macro-panel" aria-label={title}>
      <div className="market-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="market-macro-chart">
        {data.length > 1 && series.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<MacroTooltip />} />
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="market-chart-empty">Intraday history unavailable.</div>
        )}
      </div>
      {series.length > 0 ? (
        <div className="market-legend">
          {series.map((item) => (
            <span key={item.key}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
