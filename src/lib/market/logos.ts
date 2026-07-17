/**
 * Logo resolution for watchlist companies and sector ETFs.
 *
 * For companies we know the domain of, we use Google Favicons API
 * (no manual SVG files to source/maintain).
 * For sector ETFs (no real website), we generate a branded gradient badge.
 */

// ── Company domain map ──
// Ticker → known website domain used for favicon lookup.
const DOMAIN_MAP: Record<string, string> = {
  OXY: "oxy.com",
  INTC: "intel.com",
  GOOG: "abc.xyz",
  NVO: "novonordisk.com",
  PFE: "pfizer.com",
  NBIS: "nebius.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  AAPL: "apple.com",
  AMD: "amd.com",
  PLTR: "palantir.com",
  AMZN: "amazon.com",
  MSFT: "microsoft.com",
  META: "meta.com",
  AVGO: "broadcom.com",
  ORCL: "oracle.com",
  IBM: "ibm.com",
  GME: "gamestop.com",
  HOOD: "robinhood.com",
  COIN: "coinbase.com",
};

// ── Sector ETF fallback colors ──
const SECTOR_COLORS: Record<string, { c1: string; c2: string; label: string }> = {
  XLK:  { c1: "#0052CC", c2: "#003380", label: "Tech" },
  XLF:  { c1: "#00875A", c2: "#005a3c", label: "Financial" },
  XLV:  { c1: "#E0115F", c2: "#a00d44", label: "Health" },
  XLE:  { c1: "#FF6B35", c2: "#cc4400", label: "Energy" },
  XLI:  { c1: "#00B8D9", c2: "#0085a0", label: "Industrials" },
  XLY:  { c1: "#7F55E0", c2: "#5435a0", label: "Cyclical" },
  XLP:  { c1: "#DA62AC", c2: "#b53d82", label: "Staples" },
  XLU:  { c1: "#F5CD47", c2: "#c7a333", label: "Utilities" },
  XLRE: { c1: "#A67C52", c2: "#7a5a39", label: "Real Estate" },
  XLC:  { c1: "#00C7E5", c2: "#0099b8", label: "Comm" },
  XLB:  { c1: "#F59E0B", c2: "#c47d08", label: "Materials" },
};

const FAVICON_BASE = "https://www.google.com/s2/favicons";

/**
 * Returns a favicon URL for known companies, or undefined for sector ETFs.
 */
export function getLogoUrl(ticker: string): string | undefined {
  const upper = ticker.toUpperCase();
  const domain = DOMAIN_MAP[upper];
  if (domain) {
    return `${FAVICON_BASE}?domain=${domain}&sz=64`;
  }
  return undefined;
}

/** Returns true if this ticker has a known domain for favicon lookup. */
export function hasDomainLogo(ticker: string): boolean {
  return ticker.toUpperCase() in DOMAIN_MAP;
}

/** Returns the sector fallback color palette, or undefined for non-sector tickers. */
export function getSectorColors(ticker: string): { c1: string; c2: string; label: string } | undefined {
  return SECTOR_COLORS[ticker.toUpperCase()];
}

/** Returns the display label for sector badges. */
export function getSectorLabel(ticker: string): string | undefined {
  return SECTOR_COLORS[ticker.toUpperCase()]?.label;
}
