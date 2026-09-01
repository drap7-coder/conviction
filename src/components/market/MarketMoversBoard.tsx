"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { fmtDollarPrice, fmtPercent, fmtSignedDollar, isFiniteNumber } from "@/lib/display/format";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import { type MarketMoverRow } from "@/lib/market/market-movers";
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";

type MoverTone = "up" | "down" | "amber" | "quiet";

function toneLabel(tone: MoverTone): string {
  if (tone === "up") return "Up on the day";
  if (tone === "down") return "Down on the day";
  if (tone === "amber") return "Highest volume";
  return "Flat on the day";
}

function MoverCard({
  title,
  rows,
  tone,
  emptyLabel,
  sessionLabel = null,
  headerAction = null,
  showWhenEmpty = false,
}: {
  title: string;
  rows: MarketMoverRow[];
  tone: MoverTone;
  emptyLabel: string;
  sessionLabel?: string | null;
  headerAction?: ReactNode;
  showWhenEmpty?: boolean;
}) {
  if (rows.length === 0 && !showWhenEmpty) return null;

  return (
    <section
      className="market-heatmap-shell pulse-index-board pulse-movers-card"
      aria-label={title}
    >
      <div className="market-heatmap-copy">
        <div className="market-panel-header pulse-index-board-head">
          <h2>
            <i
              className={`pulse-day-status pulse-day-status--${tone}`}
              aria-label={toneLabel(tone)}
              title={toneLabel(tone)}
            />
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
      <div className="surface-well pulse-movers-well">
        {rows.length === 0 ? (
          <p className="pulse-movers-empty">{emptyLabel}</p>
        ) : (
          <ol className="pulse-movers-list">
            {rows.map((row) => {
              const href = companyDetailHref(row.ticker);
              const extendedLabel =
                row.sessionLabel === "Pre-Market" || row.sessionLabel === "After Hours"
                  ? row.sessionLabel
                  : null;
              const priorClose = Boolean(row.priorCloseSecondary);
              const changeLabel = `${fmtSignedDollar(row.change ?? null)} ${fmtPercent(row.changePercent, 2)}`;
              const extendedAria = extendedLabel
                ? row.extendedNoTrades
                  ? `${priorClose ? "Prior close" : extendedLabel} No trades`
                  : `${priorClose ? "Prior close" : extendedLabel} ${fmtDollarPrice(row.extendedPrice ?? null)} ${fmtSignedDollar(row.extendedChange ?? null)} ${fmtPercent(row.extendedChangePercent ?? null, 2)}`
                : null;
              const body = (
                <>
                  <span className="pulse-movers-logo" aria-hidden="true">
                    <LogoDisplay ticker={row.ticker} size="detail" />
                  </span>
                  <span className="pulse-movers-id">
                    <strong>{row.ticker}</strong>
                    <small>{row.name}</small>
                  </span>
                  <SessionQuoteStack
                    lastPrice={row.price ?? null}
                    change={row.change ?? null}
                    changePercent={row.changePercent}
                    extendedLabel={extendedLabel}
                    extendedPrice={row.extendedPrice ?? null}
                    extendedChange={row.extendedChange ?? null}
                    extendedChangePercent={row.extendedChangePercent ?? null}
                    extendedNoTrades={Boolean(row.extendedNoTrades)}
                    priorCloseSecondary={priorClose}
                    compact
                  />
                </>
              );
              const aria = [
                row.ticker,
                row.name,
                fmtDollarPrice(row.price ?? null),
                changeLabel,
                extendedAria,
              ].filter(Boolean).join(", ");
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
    </section>
  );
}

export function MarketMoversBoard({
  title = "Market Movers",
  top,
  bottom,
  volume = [],
  sessionLabel = null,
  headerAction = null,
  footer = null,
  showWhenEmpty = false,
  topEmptyLabel = "No names in this column.",
  bottomEmptyLabel = "No names in this column.",
  volumeEmptyLabel = "No volume leaders yet.",
  /** Hide one column when a performance slicer focuses Leaders or Laggards. */
  columns = "both",
  showVolume = false,
}: {
  title?: string;
  top: MarketMoverRow[];
  bottom: MarketMoverRow[];
  volume?: MarketMoverRow[];
  sessionLabel?: string | null;
  headerAction?: ReactNode;
  footer?: ReactNode;
  /** Keep the shell when both columns are empty (e.g. watchlist waiting on quotes). */
  showWhenEmpty?: boolean;
  topEmptyLabel?: string;
  bottomEmptyLabel?: string;
  volumeEmptyLabel?: string;
  columns?: "both" | "top" | "bottom";
  /** Pulse Movers shows a third Highest volume card. */
  showVolume?: boolean;
}) {
  const showTop = columns !== "bottom";
  const showBottom = columns !== "top";
  const visibleTop = showTop ? top : [];
  const visibleBottom = showBottom ? bottom : [];
  const visibleVolume = showVolume ? volume : [];
  const anyRows = visibleTop.length > 0 || visibleBottom.length > 0 || visibleVolume.length > 0;
  if (!anyRows && !showWhenEmpty && !footer) return null;

  // First visible card carries the shared header action (Edit watchlist, etc.).
  let actionPlaced = false;
  function takeAction() {
    if (actionPlaced || !headerAction) return null;
    actionPlaced = true;
    return headerAction;
  }

  // Session chip only on the lead card so Markets-style boards stay quiet.
  let sessionPlaced = false;
  function takeSession() {
    if (sessionPlaced || !sessionLabel) return null;
    sessionPlaced = true;
    return sessionLabel;
  }

  return (
    <div className="pulse-movers-stack" aria-label={title}>
      {showTop ? (
        <MoverCard
          title={columns === "top" ? "Leaders" : "Gainers"}
          rows={visibleTop}
          tone="up"
          emptyLabel={topEmptyLabel}
          sessionLabel={takeSession()}
          headerAction={takeAction()}
          showWhenEmpty={showWhenEmpty}
        />
      ) : null}
      {showBottom ? (
        <MoverCard
          title={columns === "bottom" ? "Laggards" : "Losers"}
          rows={visibleBottom}
          tone="down"
          emptyLabel={bottomEmptyLabel}
          sessionLabel={takeSession()}
          headerAction={takeAction()}
          showWhenEmpty={showWhenEmpty}
        />
      ) : null}
      {showVolume ? (
        <MoverCard
          title="Highest volume"
          rows={visibleVolume}
          tone="amber"
          emptyLabel={volumeEmptyLabel}
          sessionLabel={takeSession()}
          headerAction={takeAction()}
          showWhenEmpty={false}
        />
      ) : null}
      {footer}
    </div>
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
