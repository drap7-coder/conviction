/**
 * Compact portfolio holding row — same ring-list language as Watchlist,
 * with a color-accented holdings band (shares / value / alloc / cost / G&L).
 * Click opens the company dashboard.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import { isFiniteNumber } from "@/lib/display/format";
import type { PositionMetrics } from "@/lib/portfolio/types";

export interface PortfolioHoldingCardProps {
  ticker: string;
  companyName?: string | null;
  price: number | null;
  changePercent: number | null;
  sessionLabel: string | null;
  sessionPrice: number | null;
  sessionChange: number | null;
  sessionChangePercent: number | null;
  convictionTone: string;
  convictionStrength: number;
  shares: number;
  metrics: PositionMetrics;
  onEdit: (ticker: string) => void;
  onRemove: (ticker: string) => void;
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

function compactCurrency(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function holdingAccent(totalGainLoss: number | null): "up" | "down" | "flat" {
  if (!isFiniteNumber(totalGainLoss) || totalGainLoss === 0) return "flat";
  return totalGainLoss > 0 ? "up" : "down";
}

export function PortfolioHoldingCard({
  ticker,
  companyName,
  price,
  changePercent,
  sessionLabel,
  sessionPrice,
  sessionChange,
  sessionChangePercent,
  convictionTone,
  convictionStrength,
  shares,
  metrics,
  onEdit,
  onRemove,
}: PortfolioHoldingCardProps) {
  const hasExtendedSession = sessionLabel !== null && sessionPrice !== null;
  const dayChangeClass =
    isFiniteNumber(changePercent) && changePercent > 0
      ? "positive"
      : isFiniteNumber(changePercent) && changePercent < 0
        ? "negative"
        : "neutral";
  const sessionChangeClass =
    isFiniteNumber(sessionChange) && sessionChange > 0
      ? "positive"
      : isFiniteNumber(sessionChange) && sessionChange < 0
        ? "negative"
        : "neutral";

  const ring = ringFromVerdict(convictionTone, convictionStrength);
  const accent = holdingAccent(metrics.totalGainLoss);
  const displayName = companyName?.trim() || ticker;

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

  const stop = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <Link
      href={`/companies/${ticker}`}
      className="wl-ring-row"
      title={`${displayName} — open dashboard`}
    >
      <div className="wl-ring-row-main">
        <div className="wl-ring-identity">
          <strong className="wl-ring-ticker">{ticker}</strong>
          <span className="wl-ring-name">{displayName}</span>
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
                    onClick={(e) => {
                      stop(e);
                      setMenuOpen(false);
                      setConfirmRemove(false);
                      onRemove(ticker);
                    }}
                    role="menuitem"
                  >
                    Yes, remove
                  </button>
                  <button
                    className="watchlist-kebab-item"
                    onClick={(e) => {
                      stop(e);
                      setConfirmRemove(false);
                    }}
                    role="menuitem"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="watchlist-kebab-item"
                    onClick={(e) => {
                      stop(e);
                      setMenuOpen(false);
                      onEdit(ticker);
                    }}
                    role="menuitem"
                  >
                    Edit position
                  </button>
                  <button
                    className="watchlist-kebab-item watchlist-kebab-item-danger"
                    onClick={(e) => {
                      stop(e);
                      setConfirmRemove(true);
                    }}
                    role="menuitem"
                  >
                    Remove position
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`pf-ring-holding ${accent}`} aria-label="Holding details">
        <div className="pf-ring-holding-item">
          <span className="pf-ring-holding-label">Shares</span>
          <span className="pf-ring-holding-value">{shares.toLocaleString()}</span>
        </div>
        <div className="pf-ring-holding-item">
          <span className="pf-ring-holding-label">Value</span>
          <span className="pf-ring-holding-value">
            {compactCurrency(metrics.marketValue)}
          </span>
        </div>
        <div className="pf-ring-holding-item">
          <span className="pf-ring-holding-label">Alloc</span>
          <span className="pf-ring-holding-value">
            {isFiniteNumber(metrics.weight) ? `${Math.round(metrics.weight)}%` : "—"}
          </span>
        </div>
        <div className="pf-ring-holding-item">
          <span className="pf-ring-holding-label">Cost</span>
          <span className="pf-ring-holding-value">
            {compactCurrency(metrics.totalCost)}
          </span>
        </div>
        <div className="pf-ring-holding-item">
          <span className="pf-ring-holding-label">Gain/Loss</span>
          <span className={`pf-ring-holding-value pf-ring-holding-gl ${accent}`}>
            {compactCurrency(metrics.totalGainLoss)}
            {isFiniteNumber(metrics.totalGainLossPercent)
              ? ` ${formatPercent(metrics.totalGainLossPercent)}`
              : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
