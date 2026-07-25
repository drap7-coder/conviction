"use client";

import Link from "next/link";
import { useState } from "react";

export interface StockHeatmapItem {
  ticker: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
}

interface StockHeatmapProps {
  title: string;
  subtitle: string;
  items: StockHeatmapItem[];
}

function fmtPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${value.toFixed(value >= 10 ? 2 : 3)}`;
}

function fmtMarketCap(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Market cap unavailable";
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T market cap`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(0)}B market cap`;
  return `${(value / 1e6).toFixed(0)}M market cap`;
}

function tileSpan(marketCap: number | null, maxMarketCap: number): number {
  if (marketCap === null || maxMarketCap <= 0) return 1;
  const ratio = marketCap / maxMarketCap;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.12) return 2;
  return 1;
}

function heatColor(change: number | null, maxAbs: number): string {
  if (change === null || !Number.isFinite(change) || maxAbs === 0) return "hsl(220 5% 22%)";
  const magnitude = Math.min(Math.abs(change) / maxAbs, 1);
  const hue = change >= 0 ? 150 : 0;
  return `hsl(${hue} ${44 + magnitude * 30}% ${16 + magnitude * 17}%)`;
}

export function StockHeatmap({ title, subtitle, items }: StockHeatmapProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  if (items.length === 0) return null;

  const selected = items.find((item) => item.ticker === selectedTicker) ?? items[0];
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.changePercent ?? 0)), 0);
  const maxMarketCap = Math.max(...items.map((item) => item.marketCap ?? 0), 0);

  return (
    <section className="stock-heat-panel" aria-label={title}>
      <style>{`
        .stock-heat-panel { margin:0 0 20px; padding:20px; background:#111214; border:1px solid #26282c; border-radius:12px; color:#f4f4f5; font-family:var(--font-mono); }
        .stock-heat-title { margin:0; font-size:.78rem; letter-spacing:.09em; text-transform:uppercase; }
        .stock-heat-subtitle { margin:6px 0 0; color:#8b8f97; font-size:.66rem; line-height:1.45; }
        .stock-heat-detail { min-height:28px; display:flex; align-items:center; flex-wrap:wrap; gap:7px 12px; margin:13px 0 9px; color:#8b8f97; font-size:.66rem; }
        .stock-heat-detail > span:first-child { color:#f4f4f5; }.stock-heat-detail b.positive { color:#4ade80; }.stock-heat-detail b.negative { color:#f87171; }
        .stock-heat-detail a { margin-left:auto; color:#2dd4bf; text-decoration:none; }
        .stock-heat-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-auto-flow:dense; gap:6px; }
        .stock-heat-tile { min-width:0; min-height:66px; padding:10px; border:1px solid rgba(244,244,245,.09); border-radius:8px; color:#f4f4f5; font:inherit; text-align:left; cursor:pointer; transition:filter .15s,border-color .15s,transform .15s; }
        .stock-heat-tile:hover,.stock-heat-tile:focus-visible { filter:brightness(1.16); outline:none; transform:translateY(-1px); }.stock-heat-tile.selected { border-color:rgba(244,244,245,.5); }
        .stock-heat-tile span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.63rem; font-weight:700; }.stock-heat-tile strong { display:block; margin-top:6px; font-size:.78rem; }
        @media (max-width:399px) { .stock-heat-panel { padding:16px 14px; }.stock-heat-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }.stock-heat-tile { min-height:62px; padding:8px; }.stock-heat-detail a { width:100%; margin-left:0; } }
      `}</style>
      <h2 className="stock-heat-title">{title}</h2>
      <p className="stock-heat-subtitle">{subtitle}</p>
      <div className="stock-heat-detail" aria-live="polite">
        <span>{selected.name}</span>
        <b className={(selected.changePercent ?? 0) >= 0 ? "positive" : "negative"}>{fmtPct(selected.changePercent)}</b>
        <span>{selected.ticker} · {fmtPrice(selected.price)} · {fmtMarketCap(selected.marketCap)}</span>
        <Link href={`/companies/${selected.ticker}`}>Open company →</Link>
      </div>
      <div className="stock-heat-grid">
        {items.map((item) => {
          const span = tileSpan(item.marketCap, maxMarketCap);
          return (
            <button
              key={item.ticker}
              type="button"
              className={`stock-heat-tile${selected.ticker === item.ticker ? " selected" : ""}`}
              style={{ gridColumn: `span ${span} / span ${span}`, background: heatColor(item.changePercent, maxAbs) }}
              onMouseEnter={() => setSelectedTicker(item.ticker)}
              onFocus={() => setSelectedTicker(item.ticker)}
              onClick={() => setSelectedTicker(item.ticker)}
              aria-label={`${item.name}, ${item.ticker}, ${fmtPct(item.changePercent)}`}
            >
              <span>{item.ticker}</span>
              <strong>{fmtPct(item.changePercent)}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
