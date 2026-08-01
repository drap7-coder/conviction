"use client";

import { HeatTile } from "@/components/HeatTile";
import {
  HEAT_EXTREME_THRESHOLD,
  HEAT_STRONG_THRESHOLD,
  HEAT_TEAL,
  HEAT_TEAL_MID,
  HEAT_TEAL_SOFT,
  HEAT_RED_SOFT_BG,
  HEAT_RED_MID,
  HEAT_RED_STRONG,
  HEAT_NEUTRAL,
} from "@/lib/display/heat-color";

export interface StockHeatmapItem {
  ticker: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  sizeValue?: number | null;
  sizeLabel?: string;
}

interface StockHeatmapProps {
  title: string;
  subtitle: string;
  items: StockHeatmapItem[];
  loading?: boolean;
  /** Live session chip — "Pre-Market" / "After Hours" when extended hours are active */
  sessionLabel?: string | null;
}

function tileSpan(marketCap: number | null, maxMarketCap: number): number {
  if (marketCap === null || maxMarketCap <= 0) return 1;
  const ratio = marketCap / maxMarketCap;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.12) return 2;
  return 1;
}

const HEATMAP_STYLES = `
  .stock-heat-panel { margin:0 0 20px; padding:20px; background:var(--card); border:1px solid var(--border); border-radius:12px; color:var(--ink); font-family:var(--font-mono); box-shadow:var(--shadow-sm); }
  .stock-heat-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .stock-heat-title { margin:0; font-size:.78rem; letter-spacing:.09em; text-transform:uppercase; }
  .stock-heat-subtitle { margin:6px 0 12px; color:var(--muted); font-size:.66rem; line-height:1.45; }
  .stock-heat-move-legend { display:flex; flex-wrap:wrap; gap:10px 14px; margin:0 0 12px; color:var(--muted); font-size:.58rem; letter-spacing:.04em; text-transform:uppercase; }
  .stock-heat-move-legend span { display:inline-flex; align-items:center; gap:6px; }
  .stock-heat-swatch { width:10px; height:10px; border-radius:2px; border:1px solid color-mix(in srgb, var(--ink) 10%, transparent); }
  .stock-heat-session {
    display:inline-flex; align-items:center; gap:6px;
    padding:4px 9px; border-radius:999px;
    background:var(--amber-dim); color:var(--amber);
    font-size:.62rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
    white-space:nowrap;
  }
  .stock-heat-session-dot {
    width:6px; height:6px; border-radius:50%; background:currentColor;
    box-shadow:0 0 0 0 color-mix(in srgb, var(--amber) 55%, transparent);
    animation:stock-heat-session-pulse 1.6s ease-out infinite;
  }
  @keyframes stock-heat-session-pulse {
    0% { transform:scale(1); box-shadow:0 0 0 0 color-mix(in srgb, var(--amber) 55%, transparent); opacity:1; }
    70% { transform:scale(1.15); box-shadow:0 0 0 7px transparent; opacity:.85; }
    100% { transform:scale(1); box-shadow:0 0 0 0 transparent; opacity:1; }
  }
  @media (prefers-reduced-motion:reduce) {
    .stock-heat-session-dot { animation:none; }
  }
  .stock-heat-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-auto-flow:dense; gap:8px; }
  @media (max-width:767px) {
    .stock-heat-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .stock-heat-grid > .heat-tile { grid-column:span 1 / span 1 !important; }
  }
  @media (max-width:399px) {
    .stock-heat-panel { padding:16px 14px; }
  }
`;

export function StockHeatmap({
  title,
  subtitle,
  items,
  loading = false,
  sessionLabel = null,
}: StockHeatmapProps) {
  const showSessionBadge = Boolean(sessionLabel);

  if (loading && items.length === 0) {
    return (
      <section className="stock-heat-panel stock-heat-loading" aria-label={title} aria-description={subtitle} aria-busy="true">
        <style>{`
          ${HEATMAP_STYLES}
          .stock-heat-loading-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
          .stock-heat-loading-tile { height:7rem; border:1px solid color-mix(in srgb, var(--ink) 8%, transparent); border-radius:12px; background:linear-gradient(110deg,#262626 18%,#404040 42%,#262626 66%); background-size:220% 100%; animation:stock-heat-shimmer 1.35s linear infinite; }
          .stock-heat-loading-tile:nth-child(1),.stock-heat-loading-tile:nth-child(4) { grid-column:span 2; }
          @keyframes stock-heat-shimmer { to { background-position:-220% 0; } }
          @media (prefers-reduced-motion:reduce) { .stock-heat-loading-tile { animation:none; } }
          @media (max-width:767px) { .stock-heat-loading-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.stock-heat-loading-tile { grid-column:span 1 !important; } }
          @media (max-width:399px) { .stock-heat-loading-tile { height:6.5rem; } }
        `}</style>
        <div className="stock-heat-heading">
          <h2 className="stock-heat-title">{title}</h2>
        </div>
        <p className="stock-heat-subtitle">{subtitle}</p>
        <div className="stock-heat-loading-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} className="stock-heat-loading-tile" />)}
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;

  const maxSizeValue = Math.max(...items.map((item) => item.sizeValue ?? item.marketCap ?? 0), 0);

  return (
    <section className="stock-heat-panel" aria-label={title} aria-description={subtitle}>
      <style>{HEATMAP_STYLES}</style>
      <div className="stock-heat-heading">
        <h2 className="stock-heat-title">{title}</h2>
        {showSessionBadge ? (
          <span className="stock-heat-session" aria-label={`${sessionLabel} session`}>
            <i className="stock-heat-session-dot" aria-hidden="true" />
            {sessionLabel}
          </span>
        ) : null}
      </div>
      <p className="stock-heat-subtitle">{subtitle}</p>
      <div className="stock-heat-move-legend" aria-label="Session move color legend">
        <span><i className="stock-heat-swatch" style={{ background: HEAT_NEUTRAL }} /> Flat</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL_SOFT }} /> Mild up</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL_MID }} /> Strong up (≥{HEAT_STRONG_THRESHOLD}%)</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL }} /> Extreme up (≥{HEAT_EXTREME_THRESHOLD}%)</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_SOFT_BG }} /> Mild down</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_MID }} /> Strong down</span>
        <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_STRONG }} /> Extreme down</span>
      </div>
      <div className="stock-heat-grid">
        {items.map((item) => {
          const span = tileSpan(item.sizeValue ?? item.marketCap, maxSizeValue);
          return (
            <HeatTile
              key={item.ticker}
              label={item.ticker}
              changePercent={item.changePercent}
              href={`/companies/${encodeURIComponent(item.ticker)}`}
              ariaLabel={`${item.name}, ${item.ticker}, ${item.changePercent === null ? "—" : `${item.changePercent > 0 ? "+" : ""}${item.changePercent.toFixed(1)}%`}`}
              style={{ gridColumn: `span ${span} / span ${span}` }}
            />
          );
        })}
      </div>
    </section>
  );
}
