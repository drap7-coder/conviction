"use client";

import Link from "next/link";
import { LogoDisplay } from "./LogoDisplay";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { getConvictionBadge } from "@/lib/conviction/canonical-types";
import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { NewsDriverBrief } from "./NewsDriverBrief";

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
  marketCap: number | null;
  /** "Pre-Market" or "After Hours" when applicable, null during regular hours */
  sessionLabel: string | null;
  sessionPrice: number | null;
  sessionChange: number | null;
  sessionChangePercent: number | null;
  convictionState: string;
  convictionTone: string;
  evidencePills: WatchlistCardEvidencePill[];
  activityLine: WatchlistCardActivityLine | null;
  headlines: WatchlistCardHeadline[];
  newsDriver: NewsDriver | null;
  sparklinePath: string;
  sparklineDirection: "positive" | "negative" | "neutral";
  onRemove: (ticker: string) => void;
  isRemoving: boolean;
  isFocused?: boolean;
  /** Optional canonical snapshot — takes precedence over individual conviction props */
  canonicalSnapshot?: ConvictionSnapshot | null;
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

function formatMarketCap(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 1_000_000_000_000) {
    return "$" + (value / 1_000_000_000_000).toFixed(1) + "T";
  }
  if (value >= 1_000_000_000) {
    return "$" + (value / 1_000_000_000).toFixed(1) + "B";
  }
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(1) + "M";
  }
  return "$" + value.toLocaleString();
}

export function WatchlistCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  marketCap,
  sessionLabel,
  sessionPrice,
  sessionChange,
  sessionChangePercent,
  convictionState,
  convictionTone,
  evidencePills,
  activityLine,
  headlines,
  newsDriver,
  sparklinePath,
  sparklineDirection,
  onRemove,
  isRemoving,
  isFocused,
  canonicalSnapshot,
}: WatchlistCardProps) {
  // Derive badge from canonical snapshot when available
  const canonicalBadge = useMemo(() => {
    if (!canonicalSnapshot) return null;
    return getConvictionBadge(canonicalSnapshot);
  }, [canonicalSnapshot]);

  const effectiveConvictionTone = canonicalBadge?.tone ?? convictionTone;
  const hasExtendedSession = sessionLabel !== null && sessionPrice !== null;
  const displayedPrice = hasExtendedSession ? sessionPrice : price;
  const displayedChange = hasExtendedSession ? sessionChange : change;
  const displayedChangePercent = hasExtendedSession ? sessionChangePercent : changePercent;
  const displayedChangeText = formatChange(displayedChange, displayedChangePercent);
  const regularChangeText = formatChange(change, changePercent);

  // ▲/▼ arrow
  const arrow = displayedChange !== null
    ? (displayedChange > 0 ? "▲" : displayedChange < 0 ? "▼" : null)
    : null;
  const arrowClass = displayedChange !== null && displayedChange > 0 ? "up" : displayedChange !== null && displayedChange < 0 ? "down" : "";

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 80;

  // ── Kebab menu state ──
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

  const handleViewDetails = useCallback(() => {
    setMenuOpen(false);
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
    onRemove(ticker);
  }, [onRemove, ticker]);

  const handleCancelRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmRemove(false);
  }, []);

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

  const supportingEvidence = evidencePills.filter(
    (pill) => pill.text?.replace(/\.$/, "") !== activityLine?.text,
  );

  const marketCapText = formatMarketCap(marketCap);

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
          className={`watchlist-row watchlist-row-${effectiveConvictionTone} ${isFocused ? "focused-card" : ""}`}
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
              <span className="watchlist-row-period">
                {sessionLabel ? `${sessionLabel}` : "Today"}
              </span>
              <span className="watchlist-row-move-amounts">
                <strong>
                  {arrow ? <span className={`watchlist-row-arrow ${arrowClass}`}>{arrow} </span> : null}
                  {displayedPrice !== null ? `$${formatPrice(displayedPrice)}` : "—"}
                </strong>
                <span className={"watchlist-row-change " + (displayedChange !== null && displayedChange > 0 ? "positive" : displayedChange !== null && displayedChange < 0 ? "negative" : "neutral")}>
                  {displayedChangeText ? `${displayedChangeText.dollars} · ${displayedChangeText.percent}` : "—"}
                </span>
              </span>
              {hasExtendedSession && price !== null && (
                <span className="watchlist-row-session">
                  <span className="watchlist-row-session-label">At Close · Today</span>
                  <span className="watchlist-row-session-price">${formatPrice(price)}</span>
                  {regularChangeText ? (
                    <span className={`watchlist-row-session-change ${change !== null && change > 0 ? "positive" : change !== null && change < 0 ? "negative" : ""}`}>
                      {regularChangeText.percent}
                    </span>
                  ) : null}
                </span>
              )}
            </div>

            {/* ── Card options (grid-column 2, row 1) ── */}
            <div className="watchlist-row-state-area">
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
                          className="watchlist-kebab-item watchlist-kebab-item-danger"
                          onClick={handleRemoveClick}
                          role="menuitem"
                        >
                          Remove from watchlist
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
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

          {headlines.length > 0 || newsDriver ? (
            <NewsDriverBrief ticker={ticker} driver={newsDriver} headlines={headlines} compact />
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

        {/* ── Market cap stat row ── */}
        {marketCapText && (
          <div className="watchlist-card-stats-row">
            <span className="watchlist-card-stat">Mkt Cap {marketCapText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
