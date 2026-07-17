"use client";

import Link from "next/link";
import { LogoDisplay } from "./LogoDisplay";

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

  return (
    <div className="terminal-card-wrap group">
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

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(ticker);
        }}
        disabled={isRemoving}
        title={`Remove ${ticker}`}
        className="terminal-card-delete"
        aria-label={`Remove ${ticker}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}