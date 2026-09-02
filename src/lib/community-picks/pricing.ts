import { fetchFreshStockQuotes, type StockQuote } from "@/lib/market/quotes";

export type AuthoritativeSpotResult =
  | { ok: true; spot: number; quote: StockQuote }
  | { ok: false; error: string };

/** Reject clearly stale regular-session prints (provider clock skew / hung cache). */
const MAX_REGULAR_QUOTE_AGE_MS = 15 * 60 * 1000;

/** Server-side spot for pick entry/exit — never trust client-submitted prices. */
export function spotFromQuote(quote: StockQuote | undefined, ticker: string): AuthoritativeSpotResult {
  if (!quote) {
    return { ok: false, error: `Could not get a market price for ${ticker}.` };
  }

  const spot = quote.price ?? quote.previousClose;
  if (spot === null || !Number.isFinite(spot) || spot <= 0) {
    return {
      ok: false,
      error: `No trustworthy price available for ${ticker}. Try again when markets are open.`,
    };
  }

  const marketState = (quote.marketState ?? "").toUpperCase();
  if (marketState === "REGULAR" && quote.asOf) {
    const asOfMs = Date.parse(quote.asOf);
    if (Number.isFinite(asOfMs)) {
      const ageMs = Date.now() - asOfMs;
      if (ageMs > MAX_REGULAR_QUOTE_AGE_MS) {
        return {
          ok: false,
          error: `Price for ${ticker} looks stale. Try again in a moment.`,
        };
      }
    }
  }

  return { ok: true, spot, quote };
}

/**
 * Fresh, server-only execution quote — bypasses the 5-minute display cache.
 * Used for community pick entry/exit spots only.
 */
export async function fetchAuthoritativeSpot(ticker: string): Promise<AuthoritativeSpotResult> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: "Enter a ticker." };
  }
  const [quote] = await fetchFreshStockQuotes([normalized]);
  return spotFromQuote(quote, normalized);
}
