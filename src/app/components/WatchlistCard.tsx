"use client";

import Link from "next/link";
import { LogoDisplay } from "./LogoDisplay";
import { StatusBadge } from "./StatusBadge";
import { useRef, useState, useCallback } from "react";
import type { ThesisStatus } from "@/lib/watchlist/types";

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
  price: number | null;
  change: number | null;
  changePercent: number | null;
  convictionState: string;
  convictionTone: string;
  evidencePills: WatchlistCardEvidencePill[];
  activityLine: WatchlistCardActivityLine | null;
  headlines: WatchlistCardHeadline[];
  sparklinePath: string;
  sparklineDirection: "positive" | "negative" | "neutral";
  onRemove: (ticker: string) => void;
  isRemoving: boolean;
  thesisStatus?: ThesisStatus;
  macroCorrelationHighlight?: boolean;
  isFocused?: boolean; // Added for focus mode
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
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return {
    dollars: `${sign}$${Math.abs(value).toFixed(2)}`,
    percent: `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`,
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
  headlines,
  sparklinePath,
  sparklineDirection,
  onRemove,
  isRemoving,
  thesisStatus,
  macroCorrelationHighlight,
  isFocused,
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
          className={`watchlist-row watchlist-row-${convictionTone} ${macroCorrelationHighlight ? "border-l-4 border-amber-400" : ""}`}
          title={companyName}
        >
          {thesisStatus && <StatusBadge status={thesisStatus} />}
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
              <strong>
                {price !== null ? `$${formatPrice(price)}` : "—"}
              </strong>
              <span className={change !== null && change > 0 ? "positive" : change !== null && change < 0 ? "negative" : "neutral"}>
                {changeText ? `${changeText.dollars} · ${changeText.percent}` : "—"}
              </span>
            </div>

            <span className={`watchlist-row-state watchlist-row-state-${convictionTone}`}>
              {convictionState}
            </span>
          </div>

          {sparklinePath ? (
            <div
              className={`watchlist-row-chart price-chart ${sparklineDirection}`}
              aria-label={`${ticker} intraday chart`}
            >
              <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
                <path className="price-chart-glow" d={sparklinePath} />
                <path className="price-chart-line" d={sparklinePath} />
              </svg>
              <span>Today</span>
            </div>
          ) : null}

          {headlines.length > 0 ? (
            <ol className="summary-headlines" aria-label={`${ticker} recent headlines`}>
              {headlines.slice(0, 3).map((item) => (
                <li key={`${item.date}-${item.headline}`}>{item.headline}</li>
              ))}
            </ol>
          ) : (
            <p className="watchlist-row-driver">
              {activityLine?.source ? (
                <span className="watchlist-row-driver-source">{activityLine.source}</span>
              ) : null}
              {activityLine?.text ?? "Recent headlines unavailable."}
            </p>
          )}

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

          {activityLine && headlines.length === 0 ? (
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
