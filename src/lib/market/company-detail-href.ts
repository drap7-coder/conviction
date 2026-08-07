/**
 * Company detail pages (`/companies/[ticker]`) require an SEC-resolvable
 * equity/ETF issuer. Pulse also shows crypto pairs and index symbols that
 * should stay visible as market tiles but must not deep-link into a 404.
 */

/** Yahoo-style crypto (and similar) pairs, e.g. BTC-USD, ETH-USD. */
const YAHOO_PAIR_TICKER = /^[A-Z0-9]{1,10}-[A-Z]{3,4}$/;

/** Index / macro symbols from Yahoo (^VIX, ^TNX). */
function isIndexSymbol(ticker: string): boolean {
  return ticker.startsWith("^");
}

function isYahooPairTicker(ticker: string): boolean {
  return YAHOO_PAIR_TICKER.test(ticker);
}

/** True when this ticker can have a `/companies/[ticker]` detail page. */
export function hasCompanyDetailPage(ticker: string): boolean {
  const cleaned = ticker.trim().toUpperCase();
  if (!cleaned) return false;
  if (isIndexSymbol(cleaned)) return false;
  if (isYahooPairTicker(cleaned)) return false;
  return true;
}

/** Company dashboard href, or null when no detail page exists. */
export function companyDetailHref(ticker: string): string | null {
  const cleaned = ticker.trim().toUpperCase();
  if (!hasCompanyDetailPage(cleaned)) return null;
  return `/companies/${encodeURIComponent(cleaned)}`;
}
