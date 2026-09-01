/**
 * Shared watchlist ticker sanitize + format gates.
 * Keeps client Manage compose, DELETE/PATCH routes, and validateTicker aligned.
 */

/** Plain equity: AAPL, MSFT */
export const EQUITY_TICKER_REGEX = /^[A-Z]{1,5}$/;

/** Share class: BRK.B, BRK-B, BF.A */
export const SHARE_CLASS_TICKER_REGEX = /^[A-Z]{1,4}[.\-][A-Z]{1,2}$/;

/** Crypto-style market instruments: BTC-USD, ETH-USD */
export const CRYPTO_PAIR_TICKER_REGEX = /^[A-Z0-9]{2,6}-[A-Z]{2,4}$/;

/** Stored / path symbols (not free-form company names). */
export const WATCHLIST_SYMBOL_REGEX =
  /^(?:[A-Z]{1,5}|[A-Z]{1,4}[.\-][A-Z]{1,2}|[A-Z0-9]{2,6}-[A-Z]{2,4})$/;

/**
 * Prepare compose input before validate/add.
 * - Ticker-shaped (no spaces): trim, uppercase, strip to A–Z / 0–9 / . / -
 * - Company names (spaces or &/' ): trim, collapse whitespace, uppercase, keep name punctuation
 */
export function sanitizeWatchlistInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const looksLikeName = /\s/.test(trimmed) || /[&']/.test(trimmed);
  if (looksLikeName) {
    return trimmed.toUpperCase().replace(/[^A-Z0-9 &\-'.]/g, "");
  }

  return trimmed.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
}

/** True when the string is a persistable watchlist symbol (not a company-name query). */
export function isWatchlistSymbolFormat(symbol: string): boolean {
  return WATCHLIST_SYMBOL_REGEX.test(symbol);
}

/**
 * Normalize a path / stored ticker for API routes.
 * Returns null when the value is empty or not a valid symbol format.
 */
export function sanitizeWatchlistSymbol(raw: string): string | null {
  const cleaned = sanitizeWatchlistInput(raw);
  if (!cleaned || !isWatchlistSymbolFormat(cleaned)) return null;
  return cleaned;
}
