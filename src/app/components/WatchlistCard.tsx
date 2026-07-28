"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { isFiniteNumber } from "@/lib/display/format";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";

export interface WatchlistCardEvidencePill {
  type: string;
  text?: string;
  direction: "positive" | "negative" | "neutral" | "contested";
}

export interface WatchlistCardActivityLine {
  timestamp: string;
  text: string;
  source?: string;
}

export interface WatchlistCardHeadline {
  headline: string;
  url: string | null;
  date: string;
}

export interface WatchlistCardProps {
  ticker: string;
  companyName: string;
  /** Regular-session / last close price */
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  /** "Pre-Market" or "After Hours" when applicable */
  sessionLabel: string | null;
  sessionPrice: number | null;
  sessionChange: number | null;
  sessionChangePercent: number | null;
  convictionState: string;
  convictionTone: string;
  /** 0–99 score for the conviction ring */
  convictionStrength: number;
  evidencePills: WatchlistCardEvidencePill[];
  activityLine: WatchlistCardActivityLine | null;
  headlines: WatchlistCardHeadline[];
  newsDriver: NewsDriver | null;
  sparklinePath: string;
  sparklineDirection: "positive" | "negative" | "neutral";
  onRemove: (ticker: string) => void;
  isRemoving: boolean;
  isFocused?: boolean;
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
  if (tone === "positive") {
    return { tone: "green", label: "Accumulating" };
  }
  if (tone === "negative") {
    return { tone: "red", label: "Distribution" };
  }
  if (tone === "contested") {
    return { tone: "amber", label: "Holding" };
  }
  // quiet / awaiting — still show a score, amber holding
  return {
    tone: strength >= 55 ? "amber" : "neutral",
    label: strength >= 55 ? "Holding" : "Awaiting",
  };
}

function driverLine(
  newsDriver: NewsDriver | null,
  headlines: WatchlistCardHeadline[],
  activityLine: WatchlistCardActivityLine | null,
): string | null {
  if (newsDriver?.label) return newsDriver.label;
  if (headlines[0]?.headline) return headlines[0].headline;
  if (activityLine?.text) return activityLine.text;
  return null;
}

export function WatchlistCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  sessionLabel,
  sessionPrice,
  sessionChange,
  sessionChangePercent,
  convictionTone,
  convictionStrength,
  activityLine,
  headlines,
  newsDriver,
  onRemove,
  isRemoving,
  isFocused,
}: WatchlistCardProps) {
  const hasExtendedSession = sessionLabel !== null && sessionPrice !== null;
  const dayChangeClass =
    isFiniteNumber(change) && change > 0
      ? "positive"
      : isFiniteNumber(change) && change < 0
        ? "negative"
        : "neutral";
  const sessionChangeClass =
    isFiniteNumber(sessionChange) && sessionChange > 0
      ? "positive"
      : isFiniteNumber(sessionChange) && sessionChange < 0
        ? "negative"
        : "neutral";

  const ring = ringFromVerdict(convictionTone, convictionStrength);
  const driver = driverLine(newsDriver, headlines, activityLine);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 80;

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

  const handleConfirmRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setConfirmRemove(false);
    onRemove(ticker);
  }, [onRemove, ticker]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = Math.abs((touchStartY.current ?? 0) - e.touches[0].clientY);
    if (dx > 0 && dx > dy * 1.5) {
      setSwipeOffset(Math.min(dx, 120));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset >= SWIPE_THRESHOLD) {
      onRemove(ticker);
    }
    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartX.current = null;
    touchStartY.current = null;
  }, [swipeOffset, onRemove, ticker]);

  const innerStyle = isSwiping
    ? ({ transform: `translateX(-${swipeOffset}px)` } as React.CSSProperties)
    : undefined;

  const wrapStyle = isRemoving
    ? ({ opacity: 0.4, pointerEvents: "none" as const } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="terminal-card-wrap group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={wrapStyle}
    >
      <div className="terminal-card-swipe-surface" aria-hidden="true">
        <span className="terminal-card-swipe-label">DELETE</span>
      </div>

      <div className="terminal-card-inner" style={innerStyle}>
        <Link
          href={`/companies/${ticker}`}
          className={`wl-ring-row ${isFocused ? "focused-card" : ""}`}
          title={`${companyName} — open dashboard`}
        >
          <div className="wl-ring-row-main">
            <div className="wl-ring-identity">
              <strong className="wl-ring-ticker">{ticker}</strong>
              <span className="wl-ring-name">{companyName}</span>
            </div>

            <div className="wl-ring-price">
              <strong className="wl-ring-last">
                {price !== null ? `$${formatPrice(price)}` : "—"}
              </strong>
              <span className={`wl-ring-day-change ${dayChangeClass}`}>
                {formatPercent(changePercent)}
              </span>
              {hasExtendedSession ? (
                <span className={`wl-ring-session ${sessionChangeClass}`}>
                  <span className="wl-ring-session-icon" aria-hidden="true">
                    {sessionLabel === "Pre-Market" ? "◎" : "☀"}
                  </span>
                  <span className="wl-ring-session-price">
                    ${formatPrice(sessionPrice)}
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
                value={convictionStrength}
                label={String(convictionStrength)}
                caption=""
                tone={ring.tone}
                ariaLabel={`Conviction ${convictionStrength}: ${ring.label}`}
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmRemove(false);
                        }}
                        role="menuitem"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/companies/${ticker}`}
                        className="watchlist-kebab-item"
                        onClick={() => setMenuOpen(false)}
                        role="menuitem"
                      >
                        Open dashboard
                      </Link>
                      <button
                        className="watchlist-kebab-item watchlist-kebab-item-danger"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmRemove(true);
                        }}
                        role="menuitem"
                      >
                        Remove from watchlist
                      </button>
                    </>
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
