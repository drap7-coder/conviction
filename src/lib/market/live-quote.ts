/**
 * Minimal quote shape needed for getLivePrice.
 * Accepts either StockQuote from @/lib/market/quotes or @/lib/market/types.
 */
interface LiveQuoteInput {
  marketState: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
}

export interface LivePrice {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  label: string | null;
}

/**
 * Given a quote-like object, return the best currently-live
 * price/change/changePercent and a human-readable label
 * ("Pre-Market" or "After Hours").
 *
 * Logic:
 * - `marketState === "PRE"`  → use preMarket* fields (fall back to regular)
 * - `marketState === "POST"` or `"POSTPOST"` → use postMarket* fields (fall back to regular)
 * - Otherwise → use the regular price/change/changePercent fields
 */
export function getLivePrice(quote: LiveQuoteInput): LivePrice {
  const state = quote.marketState ?? "";

  // Pre-market
  if (state === "PRE" && quote.preMarketPrice != null) {
    return {
      price: quote.preMarketPrice,
      change: quote.preMarketChange,
      changePercent: quote.preMarketChangePercent,
      label: "Pre-Market",
    };
  }

  // After-hours
  if ((state === "POST" || state === "POSTPOST") && quote.postMarketPrice != null) {
    return {
      price: quote.postMarketPrice,
      change: quote.postMarketChange,
      changePercent: quote.postMarketChangePercent,
      label: "After Hours",
    };
  }

  // Regular / closed / fallback
  return {
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    label: null,
  };
}
