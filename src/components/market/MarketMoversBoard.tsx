"use client";

import Link from "next/link";
import { isFiniteNumber } from "@/lib/display/format";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import {
  moverBarHeight,
  type MarketMoverRow,
} from "@/lib/market/market-movers";

function fmtPct(value: number): string {
  if (Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function MoverColumn({
  label,
  rows,
  tone,
}: {
  label: string;
  rows: MarketMoverRow[];
  tone: "up" | "down";
}) {
  const maxAbs = rows.reduce(
    (max, row) => Math.max(max, Math.abs(row.changePercent)),
    0,
  );

  return (
    <div className={`pulse-movers-col is-${tone}`}>
      <h3 className="pulse-movers-col-label">{label}</h3>
      {rows.length === 0 ? (
        <p className="pulse-movers-empty">No names in this column.</p>
      ) : (
        <ol className="pulse-movers-list">
          {rows.map((row) => {
            const href = companyDetailHref(row.ticker);
            const height = moverBarHeight(row.changePercent, maxAbs);
            const body = (
              <>
                <span className="pulse-movers-id">
                  <strong>{row.ticker}</strong>
                  <small>{row.name}</small>
                </span>
                <span className="pulse-movers-pct tnum">{fmtPct(row.changePercent)}</span>
                <span className="pulse-movers-bar" aria-hidden="true">
                  <i style={{ height: `${height}%` }} />
                </span>
              </>
            );
            const aria = `${row.ticker} ${row.name}, ${fmtPct(row.changePercent)}`;
            return (
              <li key={row.ticker}>
                {href ? (
                  <Link href={href} className="pulse-movers-row" aria-label={aria}>
                    {body}
                  </Link>
                ) : (
                  <div className="pulse-movers-row" aria-label={aria}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function MarketMoversBoard({
  title = "Market Movers",
  top,
  bottom,
  sessionLabel = null,
}: {
  title?: string;
  top: MarketMoverRow[];
  bottom: MarketMoverRow[];
  sessionLabel?: string | null;
}) {
  if (top.length === 0 && bottom.length === 0) return null;

  return (
    <section className="market-heatmap-shell pulse-movers" aria-label={title}>
      <div className="market-heatmap-copy">
        <div className="market-panel-header pulse-movers-head">
          <h2>
            {title}
            {sessionLabel ? (
              <span className="pulse-index-session" aria-label={`${sessionLabel} session`}>
                <i className="pulse-index-session-dot" aria-hidden="true" />
                {sessionLabel}
              </span>
            ) : null}
          </h2>
        </div>
      </div>
      <div className="pulse-movers-grid">
        <MoverColumn label="Top" rows={top} tone="up" />
        <MoverColumn label="Bottom" rows={bottom} tone="down" />
      </div>
    </section>
  );
}

export function sessionLabelFromQuotes(
  labels: Array<string | null | undefined>,
): string | null {
  return labels.find((label): label is string => Boolean(label)) ?? null;
}

export function hasFiniteMove(changePercent: number | null | undefined): boolean {
  return isFiniteNumber(changePercent) && changePercent !== 0;
}
