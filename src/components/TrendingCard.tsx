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
import { getCardVerdict, type CardVerdictShortInterest } from "@/lib/evidence/card-verdict";
import { isFiniteNumber } from "@/lib/display/format";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote, StockHistoryPoint } from "@/lib/market/quotes";

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
  shortInterest?: CardVerdictShortInterest;
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

function ringFromVerdict(tone: string, strength: number | null): {
  tone: GaugeTone;
  label: string;
} {
  if (tone === "positive") return { tone: "green", label: "Accumulating" };
  if (tone === "negative") return { tone: "red", label: "Distribution" };
  if (tone === "contested") return { tone: "amber", label: "Holding" };
  if (strength === null) return { tone: "neutral", label: "Awaiting" };
  return {
    tone: strength >= 55 ? "amber" : "neutral",
    label: strength >= 55 ? "Holding" : "Awaiting",
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
  shortInterest,
  isTracked,
  isAdding,
  onAdd,
  onRemove,
}: TrendingCardProps) {
  const live = getLivePrice(quote);
  const sessionLabel = live.label;
  const hasExtendedSession = Boolean(sessionLabel && quote.price !== null);

  const changeClass =
    isFiniteNumber(live.change) && live.change > 0
      ? "positive"
      : isFiniteNumber(live.change) && live.change < 0
        ? "negative"
        : "neutral";
  const closeChangeClass =
    isFiniteNumber(quote.changePercent) && quote.changePercent > 0
      ? "positive"
      : isFiniteNumber(quote.changePercent) && quote.changePercent < 0
        ? "negative"
        : "neutral";

  const verdict = getCardVerdict({
    ticker,
    companyName,
    addedAt: new Date().toISOString(),
    status: "active",
  }, quote, shortInterest);
  const ring = ringFromVerdict(verdict.tone, verdict.strength);
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
          className="wl-ring-row"
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
                  <span className="wl-ring-session-chip">{sessionLabel}</span>
                ) : null}
              </div>
              <span className={`wl-ring-day-change ${changeClass}`}>
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
                value={verdict.strength}
                label={verdict.strength !== null ? String(verdict.strength) : "—"}
                tone={ring.tone}
                ariaLabel={`Conviction ${verdict.strength ?? "unavailable"}: ${ring.label}`}
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
