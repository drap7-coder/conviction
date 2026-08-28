"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
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

const DEFAULT_COLORS = ["#0D9488", "#DC2626", "#D97706", "#EA580C", "#64748B", "#475569", "#94A3B8"];

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
  /** Soft gradient fills under each line + taller stroke for portfolio depth. */
  depth = false,
}: {
  series: MacroChainSeries[];
  title?: string;
  subtitle?: string;
  depth?: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
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

  const chartBody =
    data.length > 1 && series.length > 0 ? (
      <ResponsiveContainer width="100%" height="100%">
        {depth ? (
          <AreaChart data={data} margin={{ top: 12, right: 2, bottom: 4, left: 2 }}>
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`macro-fill-${reactId}-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.42} />
                  <stop offset="55%" stopColor={item.color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <YAxis hide domain={[0, 100]} />
            <Tooltip content={<MacroTooltip />} />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.75}
                fill={`url(#macro-fill-${reactId}-${item.key})`}
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
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
        )}
      </ResponsiveContainer>
    ) : (
      <div className="market-chart-empty">Intraday history unavailable.</div>
    );

  return (
    <section
      className={`market-panel market-macro-panel${depth ? " market-macro-panel--depth" : ""}`}
      aria-label={title || "Macro chain"}
    >
      {title.trim() || subtitle.trim() ? (
        <div className="market-panel-header">
          <div>
            {title.trim() ? <h2>{title}</h2> : null}
            {subtitle.trim() ? <p>{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <div className={`market-macro-chart${depth ? " market-macro-chart--depth" : ""}`}>
        {chartBody}
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
