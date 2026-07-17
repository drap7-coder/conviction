"use client";

import Link from "next/link";
import { LogoDisplay } from "./LogoDisplay";
import { useRef, useState, useCallback } from "react";

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

export interface WatchlistCardProps {
  ticker: string;
  companyName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  convictionState: string;
  convictionTone: string;
  evidencePills: WatchlistCardEvidencePill[];
  activityLine: WatchlistCardActivityLine | null;
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
  return {
    dollars: `${sign}${value.toFixed(2)}`,
    percent: `${sign}${percent.toFixed(2)}%`,
  };
}

export function WatchlistCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  convictionState,
  convictionTone,
  evidencePills,
  activityLine,
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
  const supportingEvidence = evidencePills.filter(
    (pill) => pill.text?.replace(/\.$/, "") !== activityLine?.text,
  );

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
          className={`watchlist-row watchlist-row-${convictionTone}`}
          title={companyName}
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
              <span className="watchlist-row-period">Today</span>
              <strong className={change !== null && change > 0 ? "positive" : change !== null && change < 0 ? "negative" : ""}>
                {changeText?.percent ?? "—"}
              </strong>
              <span>
                {price !== null ? `$${formatPrice(price)}` : "—"}
                {changeText ? ` · ${changeText.dollars}` : ""}
              </span>
            </div>

            <span className={`watchlist-row-state watchlist-row-state-${convictionTone}`}>
              {convictionState}
            </span>
          </div>

          <p className="watchlist-row-driver">
            {activityLine?.source ? (
              <span className="watchlist-row-driver-source">{activityLine.source}</span>
            ) : null}
            {activityLine?.text ?? "No material evidence change detected yet."}
          </p>

          {supportingEvidence.length > 0 && (
            <div className="watchlist-row-evidence">
              {supportingEvidence.map((pill) => (
                <span
                  key={pill.type}
                  className={`watchlist-row-evidence-item watchlist-row-evidence-${pill.direction}`}
                >
                  <b>{pill.type}</b>
                  {pill.text ? ` · ${pill.text}` : ""}
                </span>
              ))}
            </div>
          )}

          {activityLine ? (
            <span className="watchlist-row-recency">Updated {activityLine.timestamp}</span>
          ) : null}
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
