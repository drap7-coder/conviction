"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { PulseData, PulseIndicator, PulseSector } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";

const COLORS = {
  green: "#4ade80",
  red: "#f87171",
  teal: "#2dd4bf",
  yellow: "#facc15",
  orange: "#fb923c",
  blue: "#60a5fa",
};

// Gauge ranges are intentionally centralized so market-risk thresholds are easy to tune.
const VIX_GAUGE = {
  min: 10,
  max: 40,
  zones: [
    { label: "Calm", end: 15, color: "#245b43" },
    { label: "Normal", end: 20, color: COLORS.green },
    { label: "Elevated", end: 25, color: COLORS.yellow },
    { label: "Danger", end: 40, color: COLORS.red },
  ],
};

const TEN_YEAR_GAUGE = {
  min: 2.5,
  max: 6,
  zones: [
    { label: "Normal", end: 4.25, color: COLORS.green },
    { label: "Elevated", end: 5, color: COLORS.yellow },
    { label: "High", end: 6, color: COLORS.red },
  ],
};

const HEATMAP_SPANS = { largeWeight: 15, mediumWeight: 8 };

const INSTRUMENTS = [
  { ticker: "SPY", label: "S&P 500", proxyLabel: "S&P 500 (ETF proxy)" },
  { ticker: "QQQ", label: "Nasdaq", proxyLabel: "Nasdaq (ETF proxy)" },
  { ticker: "^VIX", label: "VIX", proxyLabel: "VIX" },
  { ticker: "USO", label: "Oil", proxyLabel: "Oil (ETF proxy)" },
  { ticker: "^TNX", label: "10Y Yield", proxyLabel: "10Y Yield" },
  { ticker: "UUP", label: "Dollar", proxyLabel: "Dollar (ETF proxy)" },
];

const MACRO_SERIES = [
  { ticker: "SPY", key: "equities", label: "Equities", color: COLORS.green },
  { ticker: "^TNX", key: "yield", label: "10Y Yield", color: COLORS.red },
  { ticker: "^VIX", key: "vix", label: "Volatility", color: COLORS.yellow },
  { ticker: "USO", key: "oil", label: "Oil", color: COLORS.orange },
  { ticker: "UUP", key: "dollar", label: "Dollar", color: COLORS.blue },
] as const;

function fmtPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtPrice(value: number | null, isPercent: boolean): string {
  if (!isFiniteNumber(value)) return "—";
  if (isPercent) return `${value.toFixed(2)}%`;
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value >= 10 ? value.toFixed(2) : value.toFixed(3);
}

function freshnessLabel(status: string): string {
  if (status === "ready") return "LIVE";
  if (status === "proxy") return "15M";
  if (status === "delayed") return "DELAYED";
  if (status === "stale") return "STALE";
  return "—";
}

function normalize(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

function Sparkline({ indicator }: { indicator: PulseIndicator }) {
  const points = indicator.history.slice(-15).map((point) => ({ value: point.close }));
  if (points.length < 2) return <span className="market-no-chart">—</span>;
  const isUp = (indicator.changePercent ?? 0) >= 0;
  return (
    <div className="market-sparkline" aria-label={`${indicator.label} intraday price trend`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="value" stroke={isUp ? COLORS.green : COLORS.red} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Gauge({
  label,
  value,
  suffix = "",
  config,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  config: typeof VIX_GAUGE | typeof TEN_YEAR_GAUGE;
}) {
  const bounded = isFiniteNumber(value) ? Math.min(config.max, Math.max(config.min, value)) : config.min;
  const marker = ((bounded - config.min) / (config.max - config.min)) * 100;
  let previousEnd = config.min;

  return (
    <article className="market-gauge-card">
      <div className="market-card-heading">
        <span>{label}</span><span className="market-live">LIVE</span>
      </div>
      <strong className="market-gauge-value">{isFiniteNumber(value) ? value.toFixed(2) : "—"}{suffix}</strong>
      <div className="market-gauge" aria-label={`${label} risk gauge`}>
        {config.zones.map((zone) => {
          const width = ((zone.end - previousEnd) / (config.max - config.min)) * 100;
          previousEnd = zone.end;
          return <span key={zone.label} title={zone.label} style={{ width: `${width}%`, background: zone.color }} />;
        })}
        {isFiniteNumber(value) && <i className="market-gauge-marker" style={{ left: `${marker}%` }} />}
      </div>
      <div className="market-gauge-labels"><span>{config.zones[0].label}</span><span>{config.zones.at(-1)?.label}</span></div>
    </article>
  );
}

function MacroTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="market-chart-tooltip">
      {payload.map((item) => <span key={item.name} style={{ color: item.color }}>{item.name}: {item.value.toFixed(0)}</span>)}
    </div>
  );
}

function MacroChart({ indicators }: { indicators: PulseIndicator[] }) {
  const data = useMemo(() => {
    const lookup = new Map(indicators.map((item) => [item.ticker, item]));
    const normalized = MACRO_SERIES.map((series) => normalize((lookup.get(series.ticker)?.history ?? []).slice(-15).map((point) => point.close)));
    const length = Math.max(...normalized.map((points) => points.length), 0);
    return Array.from({ length }, (_, index) => {
      const row: Record<string, number> = { point: index };
      MACRO_SERIES.forEach((series, seriesIndex) => {
        const values = normalized[seriesIndex];
        const offset = length - values.length;
        if (index >= offset) row[series.key] = values[index - offset];
      });
      return row;
    });
  }, [indicators]);

  return (
    <section className="market-panel" aria-label="Macro chain">
      <div className="market-panel-header"><div><h2>Macro Chain</h2><p>Last 15 points · normalized 0–100</p></div></div>
      <div className="market-macro-chart">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<MacroTooltip />} />
              {MACRO_SERIES.map((series) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="market-chart-empty">Intraday history unavailable.</div>}
      </div>
      <div className="market-legend">
        {MACRO_SERIES.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}
      </div>
    </section>
  );
}

function tileSpan(weight: number): number {
  if (weight > HEATMAP_SPANS.largeWeight) return 3;
  if (weight > HEATMAP_SPANS.mediumWeight) return 2;
  return 1;
}

function heatColor(change: number | null, maxAbs: number): string {
  if (!isFiniteNumber(change) || maxAbs === 0) return "hsl(220 5% 22%)";
  const magnitude = Math.min(Math.abs(change) / maxAbs, 1);
  const hue = change >= 0 ? 150 : 0;
  const saturation = 44 + magnitude * 30;
  const lightness = 16 + magnitude * 17;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function SectorHeatmap({ sectors, interpretation }: { sectors: PulseSector[]; interpretation: string | null }) {
  const [selected, setSelected] = useState<PulseSector | null>(sectors[0] ?? null);
  const maxAbs = Math.max(...sectors.map((sector) => Math.abs(sector.changePercent ?? 0)), 0);

  return (
    <section className="market-panel market-sector-panel" aria-label="Sector leadership">
      <div className="market-panel-header"><div><h2>Sector Leadership</h2><p>{interpretation ?? "Tile size reflects index weight; color reflects today’s move."}</p></div></div>
      <div className="market-sector-detail" aria-live="polite">
        {selected ? <><span>{selected.name}</span><b className={(selected.changePercent ?? 0) >= 0 ? "positive" : "negative"}>{fmtPct(selected.changePercent)}</b><span>{selected.weight.toFixed(1)}% weight</span><Link href={`/industries/${selected.ticker}`}>Open sector →</Link></> : <span>Hover or tap a sector</span>}
      </div>
      <div className="market-heatmap">
        {sectors.map((sector) => (
          <button
            key={sector.ticker}
            type="button"
            className={`market-heat-tile${selected?.ticker === sector.ticker ? " selected" : ""}`}
            style={{ gridColumn: `span ${tileSpan(sector.weight)} / span ${tileSpan(sector.weight)}`, background: heatColor(sector.changePercent, maxAbs) }}
            onMouseEnter={() => setSelected(sector)}
            onFocus={() => setSelected(sector)}
            onClick={() => setSelected(sector)}
            aria-label={`${sector.name}, ${fmtPct(sector.changePercent)}, ${sector.weight.toFixed(1)} percent index weight`}
          >
            <span>{sector.name}</span><strong>{fmtPct(sector.changePercent)}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function MarketPulsePage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/pulse")
      .then((response) => { if (!response.ok) throw new Error("Market data unavailable"); return response.json() as Promise<PulseData>; })
      .then((payload) => { if (!cancelled) { setData(payload); setStatus("success"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") return <div className="markets-page"><div className="market-empty">Loading market pulse…</div></div>;
  if (status === "error" || !data) return <div className="markets-page"><div className="market-empty">Market data is temporarily unavailable.</div></div>;

  const indicatorMap = new Map(data.indicators.map((indicator) => [indicator.ticker, indicator]));
  const vix = indicatorMap.get("^VIX")?.price ?? null;
  const tenYear = indicatorMap.get("^TNX")?.price ?? null;

  return (
    <main className="markets-page">
      <style>{`
        .markets-page { --market-bg:#0a0a0b; --market-card:#111214; --market-border:#26282c; --market-text:#f4f4f5; --market-muted:#8b8f97; --market-green:#4ade80; --market-red:#f87171; --market-live:#2dd4bf; min-height:100vh; background:var(--market-bg); color:var(--market-text); padding:24px; font-family:var(--font-mono); }
        .market-index-grid,.market-gauge-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-bottom:18px; }
        .market-index-card,.market-gauge-card,.market-panel { background:var(--market-card); border:1px solid var(--market-border); border-radius:12px; }
        .market-index-card { min-height:124px; padding:16px; display:grid; grid-template-columns:minmax(0,1fr) 78px; gap:8px; align-items:center; }
        .market-index-copy { min-width:0; display:flex; flex-direction:column; align-items:flex-start; }
        .market-card-heading { grid-column:1/-1; display:flex; justify-content:space-between; color:var(--market-muted); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; }
        .market-index-label { color:var(--market-muted); font-size:.66rem; letter-spacing:.08em; line-height:1.35; text-transform:uppercase; }
        .market-index-value,.market-gauge-value { margin-top:5px; font-size:1.65rem; line-height:1.05; font-variant-numeric:tabular-nums; }
        .market-index-change { margin-top:7px; font-size:.75rem; font-variant-numeric:tabular-nums; }
        .market-index-change.positive,.positive { color:var(--market-green); }.market-index-change.negative,.negative { color:var(--market-red); }
        .market-fresh,.market-live { color:var(--market-live); font-size:.62rem; letter-spacing:.08em; }
        .market-fresh { margin-top:4px; }.market-fresh.delayed { color:var(--market-muted); }
        .market-sparkline { width:76px; height:42px; }.market-no-chart { color:var(--market-muted); text-align:center; }
        .market-gauge-card { padding:16px; }.market-gauge-value { display:block; margin:10px 0 18px; }
        .market-gauge { position:relative; height:10px; display:flex; overflow:visible; border-radius:999px; background:#26282c; }
        .market-gauge > span:first-child { border-radius:999px 0 0 999px; }.market-gauge > span:nth-last-of-type(1) { border-radius:0 999px 999px 0; }
        .market-gauge-marker { position:absolute; top:-3px; width:4px; height:16px; border-radius:2px; background:#f4f4f5; box-shadow:0 0 0 2px rgba(10,10,11,.65); transform:translateX(-50%); }
        .market-gauge-labels { display:flex; justify-content:space-between; margin-top:7px; color:var(--market-muted); font-size:.52rem; text-transform:uppercase; }
        .market-panel { padding:20px; margin-bottom:18px; }.market-panel-header h2 { margin:0; font-size:.78rem; letter-spacing:.09em; text-transform:uppercase; }.market-panel-header p { margin:6px 0 0; color:var(--market-muted); font-size:.66rem; line-height:1.45; }
        .market-macro-chart { height:190px; margin:16px -8px 5px; }.market-chart-empty { height:100%; display:grid; place-items:center; color:var(--market-muted); font-size:.7rem; }
        .market-chart-tooltip { display:flex; flex-direction:column; gap:3px; padding:8px; border:1px solid var(--market-border); border-radius:6px; background:#0a0a0be8; font-size:.58rem; }
        .market-legend { display:flex; flex-wrap:wrap; gap:8px 14px; color:var(--market-muted); font-size:.58rem; }.market-legend span { display:flex; align-items:center; gap:5px; }.market-legend i { width:8px; height:8px; border-radius:2px; }
        .market-sector-detail { min-height:28px; display:flex; align-items:center; flex-wrap:wrap; gap:7px 12px; margin:13px 0 9px; color:var(--market-muted); font-size:.66rem; }.market-sector-detail > span:first-child { color:var(--market-text); }.market-sector-detail a { margin-left:auto; color:var(--market-live); text-decoration:none; }
        .market-heatmap { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-auto-flow:dense; gap:6px; }
        .market-heat-tile { min-width:0; min-height:66px; padding:10px; border:1px solid rgba(244,244,245,.09); border-radius:8px; color:var(--market-text); font:inherit; text-align:left; cursor:pointer; transition:filter .15s,border-color .15s,transform .15s; }
        .market-heat-tile:hover,.market-heat-tile:focus-visible { filter:brightness(1.16); outline:none; transform:translateY(-1px); }.market-heat-tile.selected { border-color:rgba(244,244,245,.45); }
        .market-heat-tile span { display:block; overflow:hidden; font-size:.63rem; font-weight:700; line-height:1.2; }.market-heat-tile strong { display:block; margin-top:6px; font-size:.78rem; }
        .market-empty { min-height:40vh; display:grid; place-items:center; color:var(--market-muted); }
        @media (min-width:900px) { .markets-page { max-width:1050px; margin:0 auto; }.market-index-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.market-gauge-grid { max-width:690px; } }
        @media (max-width:399px) { .markets-page { padding:16px 14px 30px; }.market-index-grid,.market-gauge-grid { gap:10px; }.market-index-card { min-height:112px; padding:12px; grid-template-columns:minmax(0,1fr) 58px; }.market-index-value,.market-gauge-value { font-size:1.3rem; }.market-sparkline { width:58px; height:36px; }.market-index-label { font-size:.56rem; }.market-index-change { font-size:.65rem; }.market-panel { padding:16px 14px; }.market-macro-chart { height:165px; }.market-heatmap { grid-template-columns:repeat(4,minmax(0,1fr)); }.market-heat-tile { min-height:62px; padding:8px; }.market-sector-detail a { width:100%; margin-left:0; } }
      `}</style>

      <MacroChart indicators={data.indicators} />
      <section className="market-index-grid" aria-label="Market instruments">
        {INSTRUMENTS.map((config) => {
          const indicator = indicatorMap.get(config.ticker);
          const change = indicator?.changePercent ?? null;
          const positive = (change ?? 0) >= 0;
          return (
            <article key={config.ticker} className="market-index-card">
              <div className="market-index-copy">
                <span className="market-index-label">{indicator?.status === "proxy" ? config.proxyLabel : config.label}</span>
                <strong className="market-index-value">{indicator ? fmtPrice(indicator.price, indicator.isPercentValue) : "—"}</strong>
                <span className={`market-index-change ${positive ? "positive" : "negative"}`}>{change === null ? "—" : `${positive ? "▲" : "▼"} ${fmtPct(change)}`}</span>
                <span className={`market-fresh ${indicator?.status === "ready" ? "" : "delayed"}`}>{freshnessLabel(indicator?.status ?? "")}</span>
              </div>
              {indicator ? <Sparkline indicator={indicator} /> : <span className="market-no-chart">—</span>}
            </article>
          );
        })}
      </section>
      <section className="market-gauge-grid" aria-label="Market danger zones">
        <Gauge label="VIX" value={vix} config={VIX_GAUGE} />
        <Gauge label="10Y Yield" value={tenYear} suffix="%" config={TEN_YEAR_GAUGE} />
      </section>
      <SectorHeatmap sectors={data.sectors} interpretation={data.sectorLeadership.interpretation} />
    </main>
  );
}
