/**
 * Shared industry / exposure colors for Sector Mix, Concentration bars, etc.
 * Keep stock sectors and ETF sleeves in one map so Live surfaces match.
 */

export const SECTOR_NAME_COLORS: Record<string, string> = {
  "U.S. Equity": "#0052CC",
  "International Equity": "#7F55E0",
  "Fixed Income": "#00B8D9",
  Cash: "#00875A",
  Commodities: "#F59E0B",
  Currency: "#A67C52",
  Crypto: "#F97316",
  "Other ETF": "#64748B",
  "Other Fund": "#64748B",
  Index: "#475569",
  Technology: "#0052CC",
  Financials: "#00875A",
  "Health Care": "#E0115F",
  Healthcare: "#E0115F",
  Energy: "#FF6B35",
  Industrials: "#00B8D9",
  "Consumer Discretionary": "#7F55E0",
  "Consumer Cyclical": "#7F55E0",
  "Consumer Staples": "#DA62AC",
  "Consumer Defensive": "#DA62AC",
  Utilities: "#F5CD47",
  "Real Estate": "#A67C52",
  "Communication Services": "#00C7E5",
  Materials: "#F59E0B",
  "Basic Materials": "#F59E0B",
  Other: "#6b7280",
  Unclassified: "#6b7280",
};

const FALLBACK_SECTOR_COLOR = "#6b7280";

export function getSectorColor(sectorName: string | null | undefined): string {
  if (!sectorName) return FALLBACK_SECTOR_COLOR;
  return SECTOR_NAME_COLORS[sectorName] ?? FALLBACK_SECTOR_COLOR;
}
