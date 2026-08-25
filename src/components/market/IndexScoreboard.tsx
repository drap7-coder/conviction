"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import { fmtDollarPrice, isFiniteNumber } from "@/lib/display/format";
import { heatChipColors } from "@/lib/display/heat-color";
import {
  buildSparklineGeometry,
  sparklineStroke,
  sparklineToneFromChange,
} from "@/lib/display/sparkline";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import {
  scoreboardCommodities,
  scoreboardIndexes,
} from "@/lib/market/index-scoreboard";
import type { InkTone } from "@/lib/display/ink-tone";

function fmtPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function groupDayTone(markets: PulseGlobalMarket[]): InkTone {
  const values = markets
    .map((market) => market.changePercent)
    .filter((value): value is number => isFiniteNumber(value));
  if (values.length === 0) return "quiet";
  const up = values.filter((value) => value > 0.05).length;
  const down = values.filter((value) => value < -0.05).length;
  if (up > 0 && down > 0) return "amber";
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean > 0.05) return "up";
  if (mean < -0.05) return "down";
  return "quiet";
}

function groupDayStatusLabel(tone: InkTone): string {
  if (tone === "up") return "Up on the day";
  if (tone === "down") return "Down on the day";
  if (tone === "amber") return "Mixed on the day";
  return "Flat on the day";
}

function IndexSpark({
  values,
  changePercent,
}: {
  values: number[];
  changePercent: number | null;
}) {
  const tone = sparklineToneFromChange(changePercent);
  const geometry = useMemo(
    () => (values.length >= 2 ? buildSparklineGeometry(values, 72, 22) : null),
    [values],
  );
  if (!geometry) return <span className="pulse-index-spark is-empty" aria-hidden="true" />;

  return (
    <svg
      className="pulse-index-spark"
      viewBox="0 0 72 22"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={geometry.path}
        fill="none"
        stroke={sparklineStroke(tone)}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function MarketScoreboard({
  title,
  rows,
  sessionLabel = null,
}: {
  title: string;
  rows: PulseGlobalMarket[];
  sessionLabel?: string | null;
}) {
  if (rows.length === 0) return null;
  const dayTone = groupDayTone(rows);

  return (
    <section
      className="market-heatmap-shell pulse-index-board"
      aria-label={`${title} scoreboard`}
    >
      <div className="market-heatmap-copy">
        <div className="market-panel-header pulse-index-board-head">
          <h2>
            <i
              className={`pulse-day-status pulse-day-status--${dayTone}`}
              aria-label={groupDayStatusLabel(dayTone)}
              title={groupDayStatusLabel(dayTone)}
            />
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
      <ol className="pulse-index-rows">
        {rows.map((market) => {
          const chip = heatChipColors(market.changePercent);
          const spark = (market.history ?? []).map((point) => point.close);
          const href = companyDetailHref(market.ticker);
          const label = `${market.name}, ${fmtDollarPrice(market.price)}, ${fmtPct(market.changePercent)}`;
          const body: ReactNode = (
            <>
              <span className="pulse-index-name">
                <strong>{market.name}</strong>
                <small>{market.ticker}</small>
              </span>
              <IndexSpark values={spark} changePercent={market.changePercent} />
              <span className="pulse-index-price tnum">{fmtDollarPrice(market.price)}</span>
              <strong
                className="pulse-index-pct tnum"
                style={{ background: chip.background, color: chip.color }}
              >
                {fmtPct(market.changePercent)}
              </strong>
            </>
          );
          return (
            <li key={market.ticker}>
              {href ? (
                <Link href={href} className="pulse-index-row" aria-label={label}>
                  {body}
                </Link>
              ) : (
                <div className="pulse-index-row" aria-label={label}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function IndexScoreboard({
  markets,
  sessionLabel = null,
}: {
  markets: PulseGlobalMarket[];
  sessionLabel?: string | null;
}) {
  return (
    <MarketScoreboard
      title="Major Indexes"
      rows={scoreboardIndexes(markets)}
      sessionLabel={sessionLabel}
    />
  );
}

export function CommodityScoreboard({
  markets,
}: {
  markets: PulseGlobalMarket[];
}) {
  return <MarketScoreboard title="Commodities" rows={scoreboardCommodities(markets)} />;
}

export function SectorScoreboard({
  markets,
  sessionLabel = null,
}: {
  markets: PulseGlobalMarket[];
  sessionLabel?: string | null;
}) {
  return (
    <MarketScoreboard
      title="Sectors"
      rows={markets}
      sessionLabel={sessionLabel}
    />
  );
}
