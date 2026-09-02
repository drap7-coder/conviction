/**
 * Compact 0–100 gauges for quote surfaces (52-week range position).
 */

export type GaugeTone = "teal" | "amber" | "slate" | "red";

export function rangePosition(price: number | null, low: number | null, high: number | null): number | null {
  if (price == null || low == null || high == null) return null;
  if (!(high > low) || !Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high)) {
    return null;
  }
  const pct = ((price - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
