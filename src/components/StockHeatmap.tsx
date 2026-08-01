"use client";

import type { ReactNode } from "react";
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
  /** What’s driving the move — shown on tile hover. */
  driverText?: string | null;
}

interface StockHeatmapProps {
  title: string;
  subtitle: string;
  items: StockHeatmapItem[];
  loading?: boolean;
  /** Live session chip — "Pre-Market" / "After Hours" when extended hours are active */
  sessionLabel?: string | null;
  /** Context feed nested under the tiles inside the white shell (e.g. What’s changing). */
  footer?: ReactNode;
}

function tileSpan(marketCap: number | null, maxMarketCap: number): number {
  if (marketCap === null || maxMarketCap <= 0) return 1;
  const ratio = marketCap / maxMarketCap;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.12) return 2;
  return 1;
}

function HeatmapCopy({
  title,
  subtitle,
  sessionLabel,
  showLegend = false,
}: {
  title: string;
  subtitle: string;
  sessionLabel?: string | null;
  showLegend?: boolean;
}) {
  return (
    <div className="stock-heat-copy">
      <div className="stock-heat-heading">
        <h2 className="stock-heat-title">{title}</h2>
        {sessionLabel ? (
          <span className="stock-heat-session ink-chip ink-chip--amber" aria-label={`${sessionLabel} session`}>
            <i className="stock-heat-session-dot" aria-hidden="true" />
            {sessionLabel}
          </span>
        ) : null}
      </div>
      {subtitle.trim() ? <p className="stock-heat-subtitle">{subtitle}</p> : null}
      {showLegend ? (
        <div className="stock-heat-move-legend" aria-label="Session move color legend">
          <span><i className="stock-heat-swatch" style={{ background: HEAT_NEUTRAL }} /> Flat</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL_SOFT }} /> Mild up</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL_MID }} /> Strong up (≥{HEAT_STRONG_THRESHOLD}%)</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_TEAL }} /> Extreme up (≥{HEAT_EXTREME_THRESHOLD}%)</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_SOFT_BG }} /> Mild down</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_MID }} /> Strong down</span>
          <span><i className="stock-heat-swatch" style={{ background: HEAT_RED_STRONG }} /> Extreme down</span>
        </div>
      ) : null}
    </div>
  );
}

export function StockHeatmap({
  title,
  subtitle,
  items,
  loading = false,
  sessionLabel = null,
  footer = null,
}: StockHeatmapProps) {
  const footerSlot = footer ? (
    <div className="stock-heat-footer">{footer}</div>
  ) : null;

  if (loading && items.length === 0) {
    return (
      <section className="stock-heat-panel stock-heat-loading" aria-label={title} aria-description={subtitle} aria-busy="true">
        <HeatmapCopy title={title} subtitle={subtitle} sessionLabel={sessionLabel} />
        <div className="stock-heat-loading-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} className="stock-heat-loading-tile" />)}
        </div>
        {footerSlot}
      </section>
    );
  }
  if (items.length === 0) {
    if (!footerSlot) return null;
    return (
      <section className="stock-heat-panel" aria-label={title} aria-description={subtitle}>
        <HeatmapCopy title={title} subtitle={subtitle} sessionLabel={sessionLabel} />
        {footerSlot}
      </section>
    );
  }

  const maxSizeValue = Math.max(...items.map((item) => item.sizeValue ?? item.marketCap ?? 0), 0);

  return (
    <section className="stock-heat-panel" aria-label={title} aria-description={subtitle}>
      <HeatmapCopy title={title} subtitle={subtitle} sessionLabel={sessionLabel} />
      <div className="stock-heat-grid">
        {items.map((item) => {
          const span = tileSpan(item.sizeValue ?? item.marketCap, maxSizeValue);
          return (
            <HeatTile
              key={item.ticker}
              label={item.ticker}
              changePercent={item.changePercent}
              href={`/companies/${encodeURIComponent(item.ticker)}`}
              driverText={item.driverText}
              ariaLabel={`${item.name}, ${item.ticker}, ${item.changePercent === null ? "—" : `${item.changePercent > 0 ? "+" : ""}${item.changePercent.toFixed(1)}%`}`}
              style={{ gridColumn: `span ${span} / span ${span}` }}
            />
          );
        })}
      </div>
      {footerSlot}
    </section>
  );
}
