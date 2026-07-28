/**
 * ── TrendingCard ──
 *
 * Compact ring-list row matching Watchlist: ticker, day move,
 * after-hours line, conviction ring, and a one-line move driver.
 * Trending-specific: activity rank/label + add/remove watchlist.
 */

"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import { getCardVerdict } from "@/lib/evidence/card-verdict";
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

function formatSessionChange(change: number | null, percent: number | null) {
  if (!isFiniteNumber(change) || !isFiniteNumber(percent)) return "—";
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  return `${sign}${Math.abs(change).toFixed(2)} ${formatPercent(percent)}`;
}

function ringFromVerdict(tone: string, strength: number): {
  tone: GaugeTone;
  label: string;
} {
  if (tone === "positive") return { tone: "green", label: "Accumulating" };
  if (tone === "negative") return { tone: "red", label: "Distribution" };
  if (tone === "contested") return { tone: "amber", label: "Holding" };
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
  isTracked,
  isAdding,
  onAdd,
  onRemove,
}: TrendingCardProps) {
  const live = getLivePrice(quote);
  const sessionLabel = live.label;
  const hasExtendedSession = Boolean(sessionLabel && live.price !== null);

  const dayChange = quote.change;
  const dayChangePercent = quote.changePercent;
  const dayChangeClass =
    isFiniteNumber(dayChange) && dayChange > 0
      ? "positive"
      : isFiniteNumber(dayChange) && dayChange < 0
        ? "negative"
        : "neutral";

  const sessionChange = hasExtendedSession ? live.change : null;
  const sessionChangePercent = hasExtendedSession ? live.changePercent : null;
  const sessionChangeClass =
    isFiniteNumber(sessionChange) && sessionChange > 0
      ? "positive"
      : isFiniteNumber(sessionChange) && sessionChange < 0
        ? "negative"
        : "neutral";

  const verdict = getCardVerdict({
    ticker,
    companyName,
    addedAt: new Date().toISOString(),
    status: "active",
  }, quote);
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
              <strong className="wl-ring-last">
                {quote.price !== null ? `$${formatPrice(quote.price)}` : "—"}
              </strong>
              <span className={`wl-ring-day-change ${dayChangeClass}`}>
                {formatPercent(dayChangePercent)}
              </span>
              {hasExtendedSession ? (
                <span className={`wl-ring-session ${sessionChangeClass}`}>
                  <span className="wl-ring-session-icon" aria-hidden="true">
                    {sessionLabel === "Pre-Market" ? "◎" : "☀"}
                  </span>
                  <span className="wl-ring-session-price">
                    ${formatPrice(live.price)}
                  </span>
                  <span className="wl-ring-session-move">
                    {formatSessionChange(sessionChange, sessionChangePercent)}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="wl-ring-gauge">
              <GaugeRing
                size="sm"
                value={verdict.strength}
                label={String(verdict.strength)}
                tone={ring.tone}
                ariaLabel={`Conviction ${verdict.strength}: ${ring.label}`}
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
