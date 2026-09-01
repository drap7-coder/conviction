import { fetchStockQuotes, type StockQuote } from "@/lib/market/quotes";

export type AuthoritativeSpotResult =
  | { ok: true; spot: number; quote: StockQuote }
  | { ok: false; error: string };

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

  return { ok: true, spot, quote };
}

export async function fetchAuthoritativeSpot(ticker: string): Promise<AuthoritativeSpotResult> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: "Enter a ticker." };
  }
  const [quote] = await fetchStockQuotes([normalized]);
  return spotFromQuote(quote, normalized);
}
