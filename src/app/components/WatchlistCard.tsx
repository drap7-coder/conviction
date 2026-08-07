"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { isFiniteNumber } from "@/lib/display/format";
import { changeToneClass } from "@/lib/display/heat-color";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";

export interface WatchlistCardHeadline {
  headline: string;
  url: string | null;
  date: string;
}

export interface WatchlistCardProps {
  ticker: string;
  companyName: string;
  /** Live session price (premarket / regular / after-hours) */
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  /** "Pre-Market" or "After Hours" chip when hero is extended-hours */
  sessionLabel: string | null;
  /** Regular-session close reference when extended */
  closePrice: number | null;
  closeChangePercent: number | null;
  convictionState: string;
  convictionTone: string;
  /** 0–100 score for the conviction ring; null when awaiting evidence */
  convictionStrength: number | null;
  /** True while the shared score request is still in flight. */
  scoreLoading?: boolean;
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

function ringFromComposite(input: {
  tone?: string | null;
  label?: string | null;
  strength: number | null;
}): {
  tone: GaugeTone;
  label: string;
} {
  // Prefer explicit composite ring fields from /api/conviction/score.
  if (input.tone === "green" || input.tone === "amber" || input.tone === "red" || input.tone === "neutral") {
    return {
      tone: input.tone,
      label: input.label ?? (input.strength === null ? "Awaiting" : "Holding"),
    };
  }
  if (input.tone === "positive") return { tone: "green", label: input.label ?? "Accumulating" };
  if (input.tone === "negative") return { tone: "red", label: input.label ?? "Distribution" };
  if (input.tone === "contested") return { tone: "amber", label: input.label ?? "Holding" };
  return { tone: "neutral", label: input.label ?? "Awaiting" };
}

export function WatchlistCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  sessionLabel,
  closePrice,
  closeChangePercent,
  convictionState,
  convictionTone,
  convictionStrength,
  scoreLoading = false,
  onRemove,
  isRemoving,
  isFocused,
}: WatchlistCardProps) {
  const hasExtendedSession = sessionLabel !== null && closePrice !== null;
  const dayChangeClass = changeToneClass(changePercent);
  const closeChangeClass = changeToneClass(closeChangePercent);
  const moveTone = inkToneFromSemantic(
    dayChangeClass === "positive"
      ? "positive"
      : dayChangeClass === "negative" || dayChangeClass === "negative-mild"
        ? "negative"
        : "quiet",
  );

  const ring = ringFromComposite({
    tone: convictionTone,
    label: convictionState,
    strength: convictionStrength,
  });

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
      className={`terminal-card-wrap group${isSwiping ? " is-swiping" : ""}`}
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
          className={`wl-ring-row ${inkBoxClass(moveTone)}${isFocused ? " focused-card" : ""}`}
          title={`${companyName} — open dashboard`}
        >
          <div className="wl-ring-row-main">
            <div className="wl-ring-identity">
              <strong className="wl-ring-ticker">{ticker}</strong>
              <span className="wl-ring-name">{companyName}</span>
            </div>

            <div className="wl-ring-price">
              <div className="wl-ring-price-primary">
                <strong className="wl-ring-last">
                  {price !== null ? `$${formatPrice(price)}` : "—"}
                </strong>
                {sessionLabel ? (
                  <span className="ink-chip ink-chip--quiet wl-ring-session-chip">{sessionLabel}</span>
                ) : null}
              </div>
              <span className={`${inkChipClass(moveTone)} wl-ring-day-change`}>
                {formatPercent(changePercent)}
              </span>
              {hasExtendedSession ? (
                <span className={`wl-ring-at-close ${closeChangeClass}`}>
                  At close ${formatPrice(closePrice)}
                  {isFiniteNumber(closeChangePercent)
                    ? ` (${formatPercent(closeChangePercent)})`
                    : ""}
                </span>
              ) : null}
            </div>

            <div className="wl-ring-gauge">
              <GaugeRing
                size="sm"
                value={scoreLoading ? null : convictionStrength}
                label={
                  scoreLoading
                    ? "…"
                    : convictionStrength !== null
                      ? String(convictionStrength)
                      : "—"
                }
                caption={
                  scoreLoading
                    ? "Scoring"
                    : convictionStrength !== null
                      ? ring.label
                      : "Score"
                }
                tone={ring.tone}
                loading={scoreLoading}
                ariaLabel={
                  scoreLoading
                    ? `Conviction score computing for ${ticker}`
                    : `Conviction ${convictionStrength ?? "unavailable"}: ${ring.label}`
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
        </Link>
      </div>
    </div>
  );
}
