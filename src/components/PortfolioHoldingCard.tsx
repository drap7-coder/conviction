/**
 * Compact read-only portfolio holding card — ticker badge, name + size,
 * value + day %, and a thin allocation bar.
 */

"use client";

import Link from "next/link";
import { isFiniteNumber } from "@/lib/display/format";
import { changeToneClass } from "@/lib/display/heat-color";
import type { PositionMetrics } from "@/lib/portfolio/types";

export interface PortfolioHoldingCardProps {
  ticker: string;
  companyName?: string | null;
  /** Live session price (premarket / regular / after-hours) */
  price: number | null;
  changePercent: number | null;
  /** "Pre-Market" or "After Hours" chip when hero is extended-hours */
  sessionLabel: string | null;
  /** Regular-session close reference when extended */
  closePrice: number | null;
  closeChangePercent: number | null;
  shares: number;
  metrics: PositionMetrics;
  focused?: boolean;
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

function compactCurrency(value: number | null) {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function allocationBand(weight: number | null): "green" | "amber" | "red" | "neutral" {
  if (!isFiniteNumber(weight)) return "neutral";
  if (weight > 20) return "red";
  if (weight >= 12) return "amber";
  return "green";
}

export function PortfolioHoldingCard({
  ticker,
  companyName,
  price,
  changePercent,
  sessionLabel,
  closePrice,
  closeChangePercent,
  shares,
  metrics,
  focused = false,
}: PortfolioHoldingCardProps) {
  const hasExtendedSession = sessionLabel !== null && closePrice !== null;
  const dayChangeClass = changeToneClass(changePercent);
  const closeChangeClass = changeToneClass(closeChangePercent);
  const allocation = metrics.weight;
  const band = allocationBand(allocation);
  const displayName = companyName?.trim() || ticker;
  const barWidth = isFiniteNumber(allocation) ? Math.min(100, Math.max(0, allocation)) : 0;

  return (
    <article
      id={`portfolio-holding-${ticker}`}
      className={`pf-holding-card${focused ? " focused-card" : ""}`}
      aria-label={`${displayName} holding`}
    >
      <div className="pf-holding-main">
        <span className="pf-holding-badge">{ticker}</span>

        <div className="pf-holding-copy">
          <Link href={`/companies/${ticker}`} className="pf-holding-name">
            {displayName}
          </Link>
          <span className="pf-holding-meta tnum">
            {shares.toLocaleString()} sh · {price !== null ? `$${formatPrice(price)}` : "—"}
            {sessionLabel ? ` · ${sessionLabel}` : ""}
          </span>
        </div>

        <div className="pf-holding-figures">
          <strong className="pf-holding-value tnum">{compactCurrency(metrics.marketValue)}</strong>
          <span className={`pf-holding-day tnum ${dayChangeClass}`}>{formatPercent(changePercent)}</span>
          {hasExtendedSession ? (
            <span className={`pf-holding-close tnum ${closeChangeClass}`}>
              Close ${formatPrice(closePrice)}
              {isFiniteNumber(closeChangePercent) ? ` ${formatPercent(closeChangePercent)}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={`pf-holding-bar is-${band}`}
        aria-label={`${ticker} allocation ${isFiniteNumber(allocation) ? `${allocation.toFixed(1)} percent` : "unavailable"}`}
      >
        <i style={{ width: `${barWidth}%` }} />
      </div>
    </article>
  );
}
