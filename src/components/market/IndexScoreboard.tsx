"use client";

import type { ReactNode } from "react";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import {
  scoreboardCommodities,
  scoreboardIndexes,
} from "@/lib/market/index-scoreboard";
import { MarketDataGrid } from "@/components/market/MarketDataGrid";

/**
 * Unified Pulse / Home scoreboard shell — high-density MarketDataGrid rows
 * with inline sparklines beside names. Movers keep the dual-print stack.
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
  const boardTone = title === "Major indexes" ? "indexes"
    : title === "Commodities" ? "commodities"
      : title === "U.S. sectors" ? "sectors"
        : title === "Crypto" ? "crypto"
          : title === "International" ? "international"
            : "neutral";
  const boardDescription = boardTone === "indexes" ? "The broad U.S. market"
    : boardTone === "commodities" ? "Inflation, demand and defense"
      : boardTone === "sectors" ? "Where money is rotating"
        : boardTone === "crypto" ? "Always-on risk appetite"
          : boardTone === "international" ? "The world beyond U.S. stocks"
            : null;

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
            <div>
              <h2>{title}</h2>
              {boardDescription ? <p>{boardDescription}</p> : null}
            </div>
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
      title="Major indexes"
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
      title="Commodities"
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
      title="U.S. sectors"
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
  return <MarketScoreboard title="International" rows={markets} />;
}
