import { getMarketInstrument } from "@/lib/market/market-instruments";

/**
 * Detail pages exist for equities/ETFs and known market instruments (crypto).
 * Index symbols like ^VIX stay unlinkable — no detail route for caret tickers.
 */

function isIndexSymbol(ticker: string): boolean {
  return ticker.startsWith("^");
}

/** True when `/companies/[ticker]` should be offered. */
export function hasCompanyDetailPage(ticker: string): boolean {
  const cleaned = ticker.trim().toUpperCase();
  if (!cleaned) return false;
  if (isIndexSymbol(cleaned)) return false;
  // Known crypto pairs always have a light detail page.
  if (getMarketInstrument(cleaned)) return true;
  // Equities / ETFs — linked; page validates via SEC resolve.
  return true;
}

/** Company/market detail href, or null when no detail page exists. */
export function companyDetailHref(ticker: string): string | null {
  const cleaned = ticker.trim().toUpperCase();
  if (!hasCompanyDetailPage(cleaned)) return null;
  return `/companies/${encodeURIComponent(cleaned)}`;
}
