"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import { fmtDollarPrice, fmtPercent, fmtSignedDollar } from "@/lib/display/format";
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
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";

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

function rowAriaLabel(market: PulseGlobalMarket, showExtended: boolean): string {
  const last = fmtDollarPrice(market.price);
  const change = `${fmtSignedDollar(market.regularChange ?? null)} ${fmtPercent(market.regularChangePercent ?? market.changePercent, 2)}`;
  if (
    showExtended
    && (market.sessionLabel === "Pre-Market" || market.sessionLabel === "After Hours")
  ) {
    const extended = market.extendedNoTrades
      ? "No trades"
      : `${fmtDollarPrice(market.extendedPrice ?? null)} ${fmtSignedDollar(market.extendedChange ?? null)} ${fmtPercent(market.extendedChangePercent ?? null, 2)}`;
    return `${market.name}, ${last}, ${change}, ${market.sessionLabel} ${extended}`;
  }
  return `${market.name}, ${last}, ${change}`;
}

export function MarketScoreboard({
  title,
  rows,
  sessionLabel = null,
  showSessionMoves = false,
  headerAction = null,
  footer = null,
}: {
  title: string;
  rows: PulseGlobalMarket[];
  sessionLabel?: string | null;
  /** When true, render the Pre/AH line under regular session change (TV-style). */
  showSessionMoves?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
}) {
  if (rows.length === 0 && !footer) return null;

  return (
    <section
      className={`market-heatmap-shell pulse-index-board${showSessionMoves ? " pulse-index-board--sessions" : ""}`}
      aria-label={`${title} scoreboard`}
    >
      <div className="market-heatmap-copy">
        <div className="market-panel-header pulse-index-board-head">
          <h2>
            <i className="pulse-day-status pulse-day-status--mark" aria-hidden="true" />
            {title}
            {sessionLabel ? (
              <span className="pulse-index-session" aria-label={`${sessionLabel} session`}>
                <i className="pulse-index-session-dot" aria-hidden="true" />
                {sessionLabel}
              </span>
            ) : null}
          </h2>
          {headerAction ? <div className="pulse-index-board-action">{headerAction}</div> : null}
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="surface-well pulse-index-well">
          <ol className="pulse-index-rows">
            {rows.map((market) => {
              const spark = (market.history ?? []).map((point) => point.close);
              const href = companyDetailHref(market.ticker);
              const regularPct = market.regularChangePercent ?? market.changePercent;
              const extendedLabel =
                showSessionMoves
                && (market.sessionLabel === "Pre-Market" || market.sessionLabel === "After Hours")
                  ? market.sessionLabel
                  : null;
              const label = rowAriaLabel(market, Boolean(extendedLabel));
              const body: ReactNode = (
                <>
                  <span className="pulse-index-name">
                    <strong>{market.name}</strong>
                    <small>{market.ticker}</small>
                  </span>
                  <IndexSpark values={spark} changePercent={regularPct} />
                  <SessionQuoteStack
                    lastPrice={market.price}
                    change={market.regularChange ?? null}
                    changePercent={regularPct}
                    extendedLabel={extendedLabel}
                    extendedPrice={market.extendedPrice ?? null}
                    extendedChange={market.extendedChange ?? null}
                    extendedChangePercent={market.extendedChangePercent ?? null}
                    extendedNoTrades={Boolean(market.extendedNoTrades)}
                  />
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
        </div>
      ) : null}
      {footer}
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
      showSessionMoves
    />
  );
}

export function CommodityScoreboard({
  markets,
}: {
  markets: PulseGlobalMarket[];
}) {
  return (
    <MarketScoreboard
      title="Commodities"
      rows={scoreboardCommodities(markets)}
      showSessionMoves
    />
  );
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

export function InternationalScoreboard({
  markets,
}: {
  markets: PulseGlobalMarket[];
}) {
  return <MarketScoreboard title="International" rows={markets} />;
}
