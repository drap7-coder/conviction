/**
 * ── Shared Formatting Utilities ──
 *
 * Consolidates number, currency, percent, price, market-cap, and date
 * formatting used across Watchlist, Trending, Market Pulse, and Portfolio.
 *
 * Rules:
 * - Never display NaN, Infinity, or undefined.
 * - Never substitute $0.00 for missing data.
 * - Distinguish a true 0.00% move from unavailable data.
 * - Use tabular numerals where supported.
 */

// ── Safety ──

/** True iff `v` is a finite number (not null, NaN, or Infinity). */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Returns the value as-is if it is a finite number, otherwise returns null.
 * Use before passing to any formatter to guarantee safety.
 */
export function safeFinite(v: unknown): number | null {
  return isFiniteNumber(v) ? v : null;
}

// ── Currency ──

/**
 * Format a value as USD currency with 2 decimal places.
 * Returns "—" for null/non-finite.
 */
export function fmtCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Compact currency: $1.2M, $450K, $123.45.
 * Returns "—" for null/non-finite.
 */
export function fmtCompactCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// ── Percentages ──

/**
 * Format a signed percentage with the specified decimal places.
 * Returns "—" for null/non-finite.
 * Example: +3.42%, -0.15%
 */
export function fmtPercent(
  value: number | null,
  decimals: number = 2,
): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Signed percentage with 1 decimal place (used for market indicators).
 */
export function fmtPct1(value: number | null): string {
  return fmtPercent(value, 1);
}

// ── Prices ──

/**
 * Format a stock price with appropriate decimal places.
 * - >= 1000: integer (no decimals)
 * - >= 10:  2 decimals
 * - < 10:   3 decimals
 * Returns "—" for null/non-finite.
 */
export function fmtPrice(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

/**
 * Format price with a dollar sign prefix.
 */
export function fmtDollarPrice(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `$${fmtPrice(value)}`;
}

// ── Dollar changes (signed with +/−) ──

/**
 * Format a signed dollar amount.
 * Returns "—" for null/non-finite.
 * Example: +$420.69, −$50.00
 */
export function fmtSignedDollar(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value > 0 ? "+" : "−"}$${abs}`;
}

// ── Market cap ──

/**
 * Abbreviated market cap string.
 * Returns "—" for null/non-finite.
 * Example: $185.2B, $12.4M
 */
export function fmtMarketCap(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// ── Portfolio weight ──

/**
 * Format a portfolio weight as a rounded whole percentage.
 * Returns "—" for null/non-finite.
 */
export function fmtWeight(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${Math.round(value)}%`;
}

// ── Numbers ──

/**
 * Locale-formatted number with no fraction digits.
 * Returns "—" for null/non-finite.
 */
export function fmtInteger(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ── Dates ──

/**
 * Format an ISO date string as a human-readable relative or absolute date.
 * - Today:    "today"
 * - Yesterday: "1 day ago"
 * - 2-6 days: "N days ago"
 * - Older:    "MMM DD"
 * Returns "—" for null/invalid.
 */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days <= 6) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format an ISO date string as a short absolute date (e.g. "Jul 24").
 */
export function fmtShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Quote freshness ──

import type { Freshness } from "./types";

/**
 * Classify quote freshness based on updatedAt and an optional explicit
 * provider delay flag.
 */
export function classifyFreshness(
  updatedAt: string | null,
  isDelayedProvider: boolean = false,
): Freshness {
  if (!updatedAt) return "unavailable";
  const then = new Date(updatedAt).getTime();
  if (!Number.isFinite(then)) return "unavailable";
  const ageMs = Date.now() - then;
  if (isDelayedProvider) return "delayed";
  if (ageMs <= 60_000) return "live";
  if (ageMs <= 300_000) return "recent";
  if (ageMs <= 900_000) return "delayed";
  return "stale";
}

/**
 * Human-readable freshness label.
 */
export function fmtFreshness(freshness: Freshness): string {
  switch (freshness) {
    case "live": return "Live";
    case "recent": return "Recent";
    case "delayed": return "Delayed";
    case "stale": return "Stale";
    case "unavailable": return "Unavailable";
  }
}
