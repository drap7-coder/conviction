/**
 * ── TrendingCard (surface-specific) ──
 *
 * Composed from Phase 1 shared primitives.
 * Distinct from WatchlistCard: includes rank, momentum context,
 * and a different primary supporting fact (why it's trending).
 *
 * Uses the same quote formatting, conviction badge, evidence summary
 * engine, and missing-data behavior as Watchlist.
 */

"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { NewsDriverBrief } from "@/app/components/NewsDriverBrief";
import { SignalBlock } from "@/components/display/SignalBlock";
import { getLivePrice } from "@/lib/market/live-quote";
import { getCardVerdict } from "@/lib/evidence/card-verdict";
import { fmtPrice, fmtPercent, fmtMarketCap, isFiniteNumber } from "@/lib/display/format";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote, StockHistoryPoint } from "@/lib/market/quotes";

// ── Types ──

interface TrendingCardHeadline {
  headline: string;
  url: string | null;
  date: string;
}

interface TrendingCardProps {
  ticker: string;
  companyName: string;
  rank: number;
  activityLabel: string;
  quote: StockQuote;
  sparkline: StockHistoryPoint[];
  headlines: TrendingCardHeadline[];
  newsDriver: NewsDriver | null;
  isTracked: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

// ── Sparkline builder (duplicated from Watchlist.tsx — kept for now) ──

function buildSparklinePath(points: StockHistoryPoint[]) {
  if (points.length < 2) return "";
  const width = 320;
  const height = 96;
  const padding = 6;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;

  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + ((max - point.close) / spread) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

// ── Component ──

export function TrendingCard({
  ticker,
  companyName,
  rank,
  activityLabel,
  quote,
  sparkline,
  headlines,
  newsDriver,
  isTracked,
  isAdding,
  onAdd,
  onRemove,
}: TrendingCardProps) {
  const live = getLivePrice(quote);
  const liveChange = live.change;
  const livePrice = live.price;
  const liveChangePercent = live.changePercent;
  const sessionLabel = live.label;

  const chartPoints = sparkline;
  const fiveDayChange = chartPoints.length >= 2
    ? chartPoints[chartPoints.length - 1].close - chartPoints[0].close
    : null;
  const chartDirection = fiveDayChange === null
    ? "neutral"
    : fiveDayChange > 0
      ? "positive"
      : "negative";

  const verdict = getCardVerdict({
    ticker,
    companyName,
    addedAt: new Date().toISOString(),
    status: "active",
  }, quote);

  const sparklinePath = buildSparklinePath(chartPoints);
  const marketCapText = fmtMarketCap(quote.marketCap);

  const arrow = liveChange !== null
    ? (liveChange > 0 ? "▲" : liveChange < 0 ? "▼" : null)
    : null;
  const arrowClass = liveChange !== null && liveChange > 0 ? "up" : liveChange !== null && liveChange < 0 ? "down" : "";
  const hasExtendedSession = !!sessionLabel && quote.price !== null;

  // ── Kebab menu ──
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        kebabRef.current &&
        !kebabRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setConfirmRemove(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleKebabClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
    setConfirmRemove(false);
  }, []);

  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmRemove(true);
  }, []);

  const handleConfirmRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setConfirmRemove(false);
    onRemove();
  }, [onRemove]);

  const handleCancelRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmRemove(false);
  }, []);

  const handleViewDetails = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <div className="terminal-card-wrap group">
      <Link
        href={`/companies/${ticker}`}
        className={`watchlist-row watchlist-row-${verdict.tone}`}
      >
        <div className="watchlist-row-main">
          <div className="watchlist-row-company">
            <LogoDisplay ticker={ticker} size="card" />
            <div>
              <strong className="watchlist-row-ticker">{ticker}</strong>
              <span className="watchlist-row-name">{companyName}</span>
            </div>
          </div>
          <div className="watchlist-row-move">
            <span className="watchlist-row-period">{sessionLabel ?? "Today"}</span>
            <span className="watchlist-row-move-amounts">
              <strong>
                {arrow ? <span className={`watchlist-row-arrow ${arrowClass}`}>{arrow} </span> : null}
                {livePrice != null
                  ? `$${fmtPrice(livePrice)}`
                  : "—"}
              </strong>
              <span className={"watchlist-row-change " + (isFiniteNumber(liveChange) && liveChange > 0 ? "positive" : isFiniteNumber(liveChange) && liveChange < 0 ? "negative" : "neutral")}>
                {isFiniteNumber(liveChange) && isFiniteNumber(liveChangePercent)
                  ? `${liveChange > 0 ? "+" : liveChange < 0 ? "-" : ""}$${Math.abs(liveChange).toFixed(2)} · ${fmtPercent(liveChangePercent)}`
                  : "—"}
              </span>
            </span>
            {hasExtendedSession && (
              <span className="watchlist-row-session">
                <span className="watchlist-row-session-label">At Close · Today</span>
                <span className="watchlist-row-session-price">${fmtPrice(quote.price)}</span>
                {isFiniteNumber(quote.changePercent) && (
                  <span className={`watchlist-row-session-change ${isFiniteNumber(quote.change) && quote.change! >= 0 ? "positive" : "negative"}`}>
                    {fmtPercent(quote.changePercent)}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* ── State area + kebab ── */}
          <div className="watchlist-row-state-area">
            <span className={`watchlist-row-state watchlist-row-state-${verdict.tone}`}>
              #{rank} {activityLabel}
            </span>
            <div className="watchlist-kebab-wrap">
              <button
                ref={kebabRef}
                className="watchlist-kebab"
                onClick={handleKebabClick}
                aria-label={`Options for ${ticker}`}
                aria-expanded={menuOpen}
              >
                ⋮
              </button>
              {menuOpen && (
                <div ref={menuRef} className="watchlist-kebab-menu" role="menu">
                  {confirmRemove ? (
                    <>
                      <span className="watchlist-kebab-confirm-text">Remove {ticker}?</span>
                      <button
                        className="watchlist-kebab-item watchlist-kebab-item-danger"
                        onClick={handleConfirmRemove}
                        role="menuitem"
                      >
                        Yes, remove
                      </button>
                      <button
                        className="watchlist-kebab-item"
                        onClick={handleCancelRemove}
                        role="menuitem"
                      >
                        Cancel
                      </button>
                    </>
                  ) : isTracked ? (
                    <>
                      <Link
                        href={`/companies/${ticker}`}
                        className="watchlist-kebab-item"
                        onClick={handleViewDetails}
                        role="menuitem"
                      >
                        View details
                      </Link>
                      <button
                        className="watchlist-kebab-item watchlist-kebab-item-danger"
                        onClick={handleRemoveClick}
                        role="menuitem"
                      >
                        Remove from watchlist
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/companies/${ticker}`}
                        className="watchlist-kebab-item"
                        onClick={handleViewDetails}
                        role="menuitem"
                      >
                        View details
                      </Link>
                      <button
                        className="watchlist-kebab-item"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpen(false);
                          onAdd();
                        }}
                        role="menuitem"
                        disabled={isAdding}
                      >
                        {isAdding ? "Adding..." : "Add to watchlist"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {sparklinePath && (
          <div className={`watchlist-row-chart price-chart ${chartDirection}`} aria-label={`${ticker} five-day chart`}>
            <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
              <path className="price-chart-glow" d={sparklinePath} />
              <path className="price-chart-line" d={sparklinePath} />
            </svg>
            <span>5D</span>
          </div>
        )}

        {headlines.length > 0 || newsDriver ? (
          <NewsDriverBrief ticker={ticker} driver={newsDriver} headlines={headlines} compact />
        ) : (
          <SignalBlock
            compact
            conclusion={
              verdict.state === "Strong"
                ? "Institutional conviction is strong"
                : verdict.state === "Weak"
                  ? "Evidence looks weak"
                  : verdict.state === "Mixed"
                    ? "Evidence is mixed"
                    : "Awaiting clearer evidence"
            }
            evidence={verdict.insight}
            whyItMatters={activityLabel}
            dateLabel={verdict.recency}
            source={verdict.source}
            strength={
              verdict.state === "Strong"
                ? "strong"
                : verdict.state === "Weak"
                  ? "weak"
                  : verdict.state === "Mixed"
                    ? "mixed"
                    : "awaiting"
            }
          />
        )}

        <div className="watchlist-row-evidence">
          {isFiniteNumber(quote.marketCap) && (
            <span className="watchlist-row-evidence-item">
              <b>Mkt Cap</b> · {marketCapText}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}