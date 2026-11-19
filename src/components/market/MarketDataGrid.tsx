"use client";

import Link from "next/link";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import {
  fmtDollarPrice,
  fmtPercent,
  fmtSignedDollar,
  isFiniteNumber,
} from "@/lib/display/format";
import {
  buildSparklineGeometry,
  sparklineStroke,
  sparklineToneFromChange,
  sparklineValuesFromQuote,
} from "@/lib/display/sparkline";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import { sessionQuoteTone } from "@/components/market/SessionQuoteStack";

export type MarketGridSessionPill = "PM" | "AH" | null;

const SPARK_W = 160;
const SPARK_H = 54;
const SPARK_PAD = 3;

export function marketGridSessionPill(
  sessionLabel: string | null | undefined,
): MarketGridSessionPill {
  if (sessionLabel === "Pre-Market") return "PM";
  if (sessionLabel === "After Hours") return "AH";
  return null;
}

function toneClass(change: number | null | undefined): string {
  return `is-${sessionQuoteTone(change)}`;
}

/** Previous close: RTH print in extended hours; otherwise last − regular $ change. */
export function marketGridPreviousClose(market: PulseGlobalMarket): number | null {
  const pill = marketGridSessionPill(market.sessionLabel);
  if (pill) {
    const rth = market.regularPrice ?? market.price;
    return isFiniteNumber(rth) ? rth : null;
  }
  if (isFiniteNumber(market.price) && isFiniteNumber(market.regularChange)) {
    return market.price - market.regularChange;
  }
  return isFiniteNumber(market.regularPrice) ? market.regularPrice : null;
}

function rowLabel(market: PulseGlobalMarket, showSession: boolean): string {
  const pill = showSession ? marketGridSessionPill(market.sessionLabel) : null;
  const prev = marketGridPreviousClose(market);
  if (pill) {
    const extended = market.extendedNoTrades
      ? "No trades"
      : `${fmtDollarPrice(market.extendedPrice ?? null)} ${fmtSignedDollar(market.extendedChange ?? null)} ${fmtPercent(market.extendedChangePercent ?? null, 2)}`;
    return `${market.name} ${market.ticker}, ${pill} ${extended}, previous close ${fmtDollarPrice(prev)}`;
  }
  const last = fmtDollarPrice(market.price);
  const change = `${fmtSignedDollar(market.regularChange ?? null)} ${fmtPercent(market.regularChangePercent ?? market.changePercent, 2)}`;
  return `${market.name} ${market.ticker}, ${last}, ${change}, previous close ${fmtDollarPrice(prev)}`;
}

function MarketGridSpark({
  history,
  changePercent,
  price,
  previousClose,
}: {
  history: PulseGlobalMarket["history"];
  changePercent: number | null;
  price: number | null;
  previousClose: number | null;
}) {
  const values = sparklineValuesFromQuote({
    sparkline: history,
    price,
    previousClose,
    limit: 28,
  });
  const geometry = values.length >= 2 ? buildSparklineGeometry(values, SPARK_W, SPARK_H, SPARK_PAD) : null;
  const tone = sparklineToneFromChange(changePercent);
  if (!geometry) {
    return <span className="market-data-grid-spark is-empty" aria-hidden="true" />;
  }
  return (
    <svg
      className={`market-data-grid-spark is-${tone}`}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      width={SPARK_W}
      height={SPARK_H}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M${SPARK_PAD} ${SPARK_H / 2} H${SPARK_W - SPARK_PAD}`}
        className="market-data-grid-spark-guide"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`${geometry.path} L${SPARK_W - SPARK_PAD} ${SPARK_H - SPARK_PAD} L${SPARK_PAD} ${SPARK_H - SPARK_PAD} Z`}
        className="market-data-grid-spark-fill"
        fill={sparklineStroke(tone)}
      />
      <path
        d={geometry.path}
        fill="none"
        stroke={sparklineStroke(tone)}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={geometry.lastX}
        cy={geometry.lastY}
        r="3"
        fill={sparklineStroke(tone)}
        className="market-data-grid-spark-point"
      />
    </svg>
  );
}

/**
 * High-density ops table for Pulse / Home boards.
 * Columns: Name (+ spark) · Last · Net · % · Session pill · Previous close.
 */
export function MarketDataGrid({
  rows,
  showSessionMoves = false,
  caption,
}: {
  rows: PulseGlobalMarket[];
  showSessionMoves?: boolean;
  caption?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="market-data-grid surface-well is-tactical" role="table" aria-label={caption ?? "Market data"}>
      <div className="market-data-grid-row is-head" role="row">
        <span role="columnheader">Name</span>
        <span role="columnheader" className="market-data-grid-spark-head">
          Trend
        </span>
        <span role="columnheader">Last</span>
        <span role="columnheader">Net</span>
        <span role="columnheader">%</span>
        <span role="columnheader">Sess</span>
        <span role="columnheader">Prev</span>
      </div>
      {rows.map((market) => {
        const href = companyDetailHref(market.ticker);
        const pill = showSessionMoves ? marketGridSessionPill(market.sessionLabel) : null;
        const noExtendedTrades = Boolean(pill) && Boolean(market.extendedNoTrades);
        const promote = Boolean(pill) && !noExtendedTrades && isFiniteNumber(market.extendedPrice);
        const last = noExtendedTrades ? null : promote ? market.extendedPrice ?? null : market.price;
        const net = noExtendedTrades ? null : promote ? market.extendedChange ?? null : market.regularChange ?? null;
        const pct = noExtendedTrades ? null : promote
          ? market.extendedChangePercent ?? null
          : market.regularChangePercent ?? market.changePercent;
        const rowTone = toneClass(pct);
        const prev = marketGridPreviousClose(market);
        const label = rowLabel(market, showSessionMoves);
        const cells = (
          <>
            <span role="cell" className="market-data-grid-name">
              <strong>{market.name}</strong>
              <small className="tnum">{market.ticker}</small>
            </span>
            <span role="cell" className="market-data-grid-spark-cell">
              <MarketGridSpark
                history={market.history}
                changePercent={pct}
                price={last}
                previousClose={prev}
              />
            </span>
            <span role="cell" className="market-data-grid-num tnum">
              {fmtDollarPrice(last)}
            </span>
            <span role="cell" className={`market-data-grid-num tnum ${toneClass(net)}`}>
              {fmtSignedDollar(net)}
            </span>
            <span role="cell" className={`market-data-grid-num tnum ${toneClass(pct)}`}>
              {fmtPercent(pct, 2)}
            </span>
            <span role="cell" className="market-data-grid-sess">
              {pill ? (
                <span
                  className={`market-data-grid-pill${market.extendedNoTrades ? " is-quiet" : ""}`}
                  aria-label={pill === "PM" ? "Pre-Market" : "After Hours"}
                >
                  {market.extendedNoTrades ? `No ${pill}` : pill}
                </span>
              ) : (
                <span className="market-data-grid-pill is-idle">—</span>
              )}
            </span>
            <span role="cell" className="market-data-grid-num tnum is-prev">
              {fmtDollarPrice(prev)}
            </span>
          </>
        );
        return href ? (
          <Link
            key={market.ticker}
            href={href}
            className={`market-data-grid-row ${rowTone}`}
            role="row"
            aria-label={label}
          >
            {cells}
          </Link>
        ) : (
          <div key={market.ticker} className={`market-data-grid-row ${rowTone}`} role="row" aria-label={label}>
            {cells}
          </div>
        );
      })}
    </div>
  );
}
