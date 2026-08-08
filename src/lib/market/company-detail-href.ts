/**
 * Detail pages exist for equities and known market instruments (crypto / Pulse ETFs).
 * Index symbols like ^VIX stay unlinkable — no detail route for caret tickers.
 *
 * Pulse ETF tiles (RSP, SPY, XLK, …) must be registered in market-instruments so
 * `/companies/[ticker]` validates without depending on SEC company_tickers.
 */

function isIndexSymbol(ticker: string): boolean {
  return ticker.startsWith("^");
}

/** True when `/companies/[ticker]` should be offered. */
export function hasCompanyDetailPage(ticker: string): boolean {
  const cleaned = ticker.trim().toUpperCase();
  if (!cleaned) return false;
  if (isIndexSymbol(cleaned)) return false;
  // Equities + registered market instruments — page validates via validateTicker.
  return true;
}

/** Company/market detail href, or null when no detail page exists. */
export function companyDetailHref(ticker: string): string | null {
  const cleaned = ticker.trim().toUpperCase();
  if (!hasCompanyDetailPage(cleaned)) return null;
  return `/companies/${encodeURIComponent(cleaned)}`;
}
