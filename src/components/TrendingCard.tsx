/**
 * ── TrendingCard ──
 *
 * Compact ring-list row matching Watchlist: ticker, live session move,
 * At close secondary in extended hours, conviction ring, and a one-line
 * move driver. Trending-specific: activity rank/label + add/remove watchlist.
 */

"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import { isFiniteNumber } from "@/lib/display/format";
import { changeToneClass } from "@/lib/display/heat-color";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote, StockHistoryPoint } from "@/lib/market/quotes";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";

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
  /** Shared composite score from /api/conviction/score — sole ring source. */
  convictionScore?: ConvictionScoreView | null;
  /** True while the shared score request is still in flight. */
  scoreLoading?: boolean;
  isTracked: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function formatPrice(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatPercent(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ringFromComposite(score: ConvictionScoreView | null): {
  tone: GaugeTone;
  label: string;
  value: number | null;
} {
  if (!score) return { tone: "neutral", label: "Awaiting", value: null };
  return {
    tone: score.tone,
    label: score.ringLabel,
    value: score.displayScore,
  };
}

function driverLine(
  newsDriver: NewsDriver | null,
  headlines: TrendingCardHeadline[],
): string | null {
  if (newsDriver?.label) return newsDriver.label;
  if (headlines[0]?.headline) return headlines[0].headline;
  return null;
}

export function TrendingCard({
  ticker,
  companyName,
  rank,
  activityLabel,
  quote,
  headlines,
  newsDriver,
  convictionScore = null,
  scoreLoading = false,
  isTracked,
  isAdding,
  onAdd,
  onRemove,
}: TrendingCardProps) {
  const live = getLivePrice(quote);
  const sessionLabel = live.label;
  const hasExtendedSession = Boolean(sessionLabel && quote.price !== null);

  const changeClass = changeToneClass(live.changePercent);
  const closeChangeClass = changeToneClass(quote.changePercent);
  const moveTone = inkToneFromSemantic(
    changeClass === "positive"
      ? "positive"
      : changeClass === "negative" || changeClass === "negative-mild"
        ? "negative"
        : "quiet",
  );

  // Shared composite only — never fall back to getCardVerdict heuristics.
  const ring = ringFromComposite(convictionScore);
  const driver = driverLine(newsDriver, headlines);

  const [menuOpen, setMenuOpen] = useState(false);
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
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleKebabClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }, []);

  return (
    <div className="terminal-card-wrap group">
      <div className="terminal-card-inner">
        <Link
          href={`/companies/${ticker}`}
          className={`wl-ring-row ${inkBoxClass(moveTone)}`}
          title={`${companyName} — open dashboard`}
        >
          <div className="wl-ring-row-main">
            <div className="wl-ring-identity">
              <strong className="wl-ring-ticker">
                <span className="tr-ring-rank">#{rank}</span> {ticker}
              </strong>
              <span className="wl-ring-name">{companyName}</span>
              <span className="tr-ring-activity">{activityLabel}</span>
            </div>

            <div className="wl-ring-price">
              <div className="wl-ring-price-primary">
                <strong className="wl-ring-last">
                  {live.price !== null ? `$${formatPrice(live.price)}` : "—"}
                </strong>
                {sessionLabel ? (
                  <span className="ink-chip ink-chip--quiet wl-ring-session-chip">{sessionLabel}</span>
                ) : null}
              </div>
              <span className={`${inkChipClass(moveTone)} wl-ring-day-change`}>
                {formatPercent(live.changePercent)}
              </span>
              {hasExtendedSession ? (
                <span className={`wl-ring-at-close ${closeChangeClass}`}>
                  At close ${formatPrice(quote.price)}
                  {isFiniteNumber(quote.changePercent)
                    ? ` (${formatPercent(quote.changePercent)})`
                    : ""}
                </span>
              ) : null}
            </div>

            <div className="wl-ring-gauge">
              <GaugeRing
                size="sm"
                value={scoreLoading ? null : ring.value}
                label={scoreLoading ? "…" : ring.value !== null ? String(ring.value) : "—"}
                caption={scoreLoading ? "Scoring" : undefined}
                tone={ring.tone}
                loading={scoreLoading}
                ariaLabel={
                  scoreLoading
                    ? `Conviction score computing for ${ticker}`
                    : `Conviction ${ring.value ?? "unavailable"}: ${ring.label}`
                }
              />
            </div>

            <div className="wl-ring-menu">
              <button
                ref={kebabRef}
                className="watchlist-kebab"
                onClick={handleKebabClick}
                aria-label={`Options for ${ticker}`}
                aria-expanded={menuOpen}
              >
                ⋮
              </button>
              {menuOpen ? (
                <div ref={menuRef} className="watchlist-kebab-menu" role="menu">
                  <Link
                    href={`/companies/${ticker}`}
                    className="watchlist-kebab-item"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Open dashboard
                  </Link>
                  {isTracked ? (
                    <button
                      className="watchlist-kebab-item watchlist-kebab-item-danger"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRemove();
                      }}
                      role="menuitem"
                    >
                      Remove from watchlist
                    </button>
                  ) : (
                    <button
                      className="watchlist-kebab-item"
                      disabled={isAdding}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen(false);
                        onAdd();
                      }}
                      role="menuitem"
                    >
                      {isAdding ? "Adding…" : "Add to watchlist"}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {driver ? (
            <p className="wl-ring-driver">
              <span className="wl-ring-driver-label">What’s driving the move</span>
              <span className="wl-ring-driver-text">{driver}</span>
            </p>
          ) : null}
        </Link>
      </div>
    </div>
  );
}
