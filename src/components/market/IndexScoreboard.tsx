"use client";

import type { ReactNode } from "react";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import {
  scoreboardCommodities,
  scoreboardIndexes,
} from "@/lib/market/index-scoreboard";
import { MarketDataGrid } from "@/components/market/MarketDataGrid";

/**
 * Unified Pulse scoreboard shell — high-density MarketDataGrid rows.
 * (Spark / quote-stack rows retired on these boards; Movers keep the dual-print stack.)
 */
export function MarketScoreboard({
  title,
  rows,
  sessionLabel = null,
  showSessionMoves = false,
  showLogos = false,
  headerAction = null,
  footer = null,
  hideHeading = false,
}: {
  title: string;
  rows: PulseGlobalMarket[];
  sessionLabel?: string | null;
  /** When true, show PM/AH session pill + previous close columns. */
  showSessionMoves?: boolean;
  /** Retained for CryptoBoard API compat; logos omitted in ops grid density. */
  showLogos?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
  hideHeading?: boolean;
}) {
  if (rows.length === 0 && !footer) return null;
  void showLogos;
  const boardTone = title === "Major Stock Market Indexes" ? "indexes"
    : title === "Commodity Prices Today" ? "commodities"
      : title === "Stock Market Sector Performance" ? "sectors"
        : title === "Cryptocurrency Market Overview" ? "crypto"
          : title === "International Markets" ? "international"
            : "neutral";

  const boardClass = [
    "market-heatmap-shell",
    "pulse-index-board",
    "pulse-index-board--grid",
    showSessionMoves ? "pulse-index-board--sessions" : "",
    `pulse-board-tone-${boardTone}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={boardClass} aria-label={`${title} scoreboard`}>
      <div className={hideHeading ? "sr-only" : "market-heatmap-copy"}>
        <div className="market-panel-header pulse-index-board-head">
          <div className="pulse-index-board-title-row">
            <h2>{title}</h2>
            {sessionLabel ? (
              <span className="pulse-index-session" aria-label={`${sessionLabel} session`}>
                <i className="pulse-index-session-dot" aria-hidden="true" />
                {sessionLabel}
              </span>
            ) : null}
          </div>
          {headerAction ? <div className="pulse-index-board-action">{headerAction}</div> : null}
        </div>
      </div>
      {rows.length > 0 ? (
        <MarketDataGrid
          rows={rows}
          showSessionMoves={showSessionMoves}
          caption={title}
        />
      ) : null}
      {footer}
    </section>
  );
}

export function IndexScoreboard({
  markets,
  sessionLabel = null,
  hideHeading = false,
}: {
  markets: PulseGlobalMarket[];
  sessionLabel?: string | null;
  hideHeading?: boolean;
}) {
  return (
    <MarketScoreboard
      title="Major Stock Market Indexes"
      hideHeading={hideHeading}
      rows={scoreboardIndexes(markets)}
      sessionLabel={sessionLabel}
      showSessionMoves
    />
  );
}

export function CommodityScoreboard({
  markets,
  hideHeading = false,
}: {
  markets: PulseGlobalMarket[];
  hideHeading?: boolean;
}) {
  return (
    <MarketScoreboard
      title="Commodity Prices Today"
      hideHeading={hideHeading}
      rows={scoreboardCommodities(markets)}
      showSessionMoves
    />
  );
}

export function SectorScoreboard({
  markets,
  sessionLabel = null,
  hideHeading = false,
}: {
  markets: PulseGlobalMarket[];
  sessionLabel?: string | null;
  hideHeading?: boolean;
}) {
  return (
    <MarketScoreboard
      title="Stock Market Sector Performance"
      hideHeading={hideHeading}
      rows={markets}
      sessionLabel={sessionLabel}
      showSessionMoves
    />
  );
}

export function InternationalScoreboard({
  markets,
}: {
  markets: PulseGlobalMarket[];
}) {
  return <MarketScoreboard title="International Markets" rows={markets} />;
}
