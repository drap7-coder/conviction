"use client";

import Link from "next/link";
import { LogoDisplay } from "./LogoDisplay";
import { useRef, useState, useCallback } from "react";

export interface WatchlistCardEvidencePill {
  type: string;
  direction: "positive" | "negative" | "neutral" | "contested";
}

export interface WatchlistCardActivityLine {
  timestamp: string;
  text: string;
}

export interface WatchlistCardProps {
  ticker: string;
  companyName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  convictionScore: number;
  convictionState: string;
  convictionTone: string;
  evidencePills: WatchlistCardEvidencePill[];
  activityLine: WatchlistCardActivityLine | null;
  sparklinePath: string;
  sparklineDirection: "positive" | "negative" | "neutral";
  onRemove: (ticker: string) => void;
  isRemoving: boolean;
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
}

export function WatchlistCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  convictionScore,
  convictionState,
  convictionTone,
  evidencePills,
  activityLine,
  sparklinePath,
  sparklineDirection,
  onRemove,
  isRemoving,
}: WatchlistCardProps) {
  const changeText = formatChange(change, changePercent);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = Math.abs((touchStartY.current ?? 0) - e.touches[0].clientY);
    // Only swipe if horizontal movement dominates (avoiding vertical scroll)
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
      {/* Swipe-to-delete surface (mobile) */}
      <div className="terminal-card-swipe-surface" aria-hidden="true">
        <span className="terminal-card-swipe-label">DELETE</span>
      </div>

      {/* Inner container — translates on swipe to reveal delete surface */}
      <div className="terminal-card-inner" style={innerStyle}>
        <Link
          href={`/companies/${ticker}`}
          className={`terminal-card terminal-card-${convictionTone}`}
          title={companyName}
        >
          {/* Header Row: Logo + Ticker | Price | Conviction Score */}
          <div className="terminal-card-header">
            <div className="terminal-card-header-left">
              <LogoDisplay ticker={ticker} size="card" />
              <span className="terminal-card-ticker">{ticker}</span>
            </div>
            <span className="terminal-card-price">
              {price !== null ? `$${formatPrice(price)}` : "—"}
            </span>
            <div className="terminal-card-conviction">
              <span className="terminal-card-score">{convictionScore}</span>
              <span className="terminal-card-state">/ {convictionState}</span>
            </div>
          </div>

          {/* Sparkline */}
          {sparklinePath ? (
            <div className={`terminal-card-sparkline ${sparklineDirection}`} aria-label={`${ticker} intraday micro chart`}>
              <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 240 42">
                <path className="sparkline-glow" d={sparklinePath} />
                <path className="sparkline-line" d={sparklinePath} />
              </svg>
            </div>
          ) : (
            <div className="terminal-card-sparkline terminal-card-sparkline-empty" />
          )}

          {/* Evidence Pills */}
          {evidencePills.length > 0 && (
            <div className="terminal-card-pills">
              {evidencePills.map((pill) => (
                <span
                  key={pill.type}
                  className={`terminal-card-pill terminal-card-pill-${pill.type.toLowerCase()} terminal-card-pill-${pill.direction}`}
                >
                  {pill.type}
                </span>
              ))}
              {changeText && (
                <span className={`terminal-card-change ${change !== null && change > 0 ? "positive" : change !== null && change < 0 ? "negative" : ""}`}>
                  {changeText}
                </span>
              )}
            </div>
          )}

          {/* Activity Line */}
          <div className="terminal-card-activity">
            {activityLine ? (
              <>
                <span className="terminal-card-activity-ts">{activityLine.timestamp}</span>
                <span className="terminal-card-activity-sep"> • </span>
                <span className="terminal-card-activity-text">{activityLine.text}</span>
              </>
            ) : (
              <span className="terminal-card-activity-muted">Awaiting evidence</span>
            )}
          </div>
        </Link>

        {/* Desktop hover-reveal delete button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(ticker);
          }}
          disabled={isRemoving}
          className="terminal-card-delete"
          aria-label={`Remove ${ticker}`}
        >
          [DEL]
        </button>
      </div>
    </div>
  );
}