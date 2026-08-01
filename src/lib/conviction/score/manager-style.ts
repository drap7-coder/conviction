/**
 * Shared 13F manager style tags — used by evidence (flow) and quality (who holds).
 * Durable capital counts more than trading-oriented books.
 */

export const DURABLE_MANAGERS = new Set([
  "Berkshire Hathaway",
  "Baupost Group",
  "Pershing Square Capital Management",
  "Duquesne Family Office",
  "Scion Asset Management",
  "Bridgewater Associates",
]);

export const TRADING_MANAGERS = new Set([
  "Citadel Advisors",
  "Renaissance Technologies",
  "D. E. Shaw",
  "Coatue Management",
  "Tiger Global Management",
  "Lone Pine Capital",
  "Viking Global Investors",
  "Third Point",
  "Soros Fund Management",
]);

export type ManagerStyle = "durable" | "trading" | "other";

export function managerStyle(manager: string): ManagerStyle {
  if (DURABLE_MANAGERS.has(manager)) return "durable";
  if (TRADING_MANAGERS.has(manager)) return "trading";
  return "other";
}

/** Soft multiplier for 13F flow / ownership weighting. */
export function managerStyleMultiplier(manager: string): number {
  const style = managerStyle(manager);
  if (style === "durable") return 1.35;
  if (style === "trading") return 0.55;
  return 1;
}

/**
 * Dollar-ish weight for a 13F row. Prefers reported value; falls back to shares.
 * Log-scaled so mega positions dominate without zeroing everyone else.
 */
export function institutionalDollarWeight(row: {
  reportedValue: number;
  shares: number;
  shareChange?: number;
}): number {
  const value =
    row.reportedValue > 0
      ? row.reportedValue
      : Math.max(Math.abs(row.shareChange ?? 0), row.shares, 0) * 50;
  const logW = Math.log10(Math.max(value, 1_000) / 1_000);
  return Math.max(0.35, Math.min(4, logW));
}
