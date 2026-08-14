/**
 * Minimal quote shape needed for getLivePrice.
 * Accepts either StockQuote from @/lib/market/quotes or @/lib/market/types.
 */
export interface LiveQuoteInput {
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

export type MarketSession = "pre_market" | "regular" | "after_hours" | "closed";

export interface LivePrice {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  label: string | null;
  session: MarketSession;
}

function easternClockSession(now: Date): MarketSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "pre_market";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "regular";
  if (minutes >= 16 * 60 && minutes < 20 * 60) return "after_hours";
  return "closed";
}

/**
 * Map a marketState string to a canonical MarketSession.
 */
export function getMarketSession(marketState: string | null): MarketSession {
  if (marketState === "PRE") return "pre_market";
  if (marketState === "POST" || marketState === "POSTPOST") return "after_hours";
  if (marketState === "REGULAR" || marketState === null) return "regular";
  return "closed";
}

/**
 * Given a quote-like object, return the best currently-live
 * price/change/changePercent and a human-readable label
 * ("Pre-Market", "After Hours", or "At close").
 *
 * Logic:
 * - `marketState === "PRE"`  → use preMarket* fields (fall back to regular)
 * - After-hours window (and overnight while closed) → use postMarket* when present
 * - Closed with no post print → regular close labeled "At close"
 * - Regular session → unlabeled regular print
 */
export function getLivePrice(quote: LiveQuoteInput, now = new Date()): LivePrice {
  const state = quote.marketState ?? "";
  const clockSession = easternClockSession(now);

  const getExtendedMove = (extendedPrice: number) => {
    if (quote.price === null) {
      return { change: null, changePercent: null };
    }

    const change = extendedPrice - quote.price;
    return {
      change,
      changePercent: quote.price !== 0 ? (change / quote.price) * 100 : null,
    };
  };

  // Pre-market
  if (state === "PRE" && clockSession === "pre_market" && quote.preMarketPrice != null) {
    const move = getExtendedMove(quote.preMarketPrice);
    return {
      price: quote.preMarketPrice,
      change: move.change ?? quote.preMarketChange,
      changePercent: move.changePercent ?? quote.preMarketChangePercent,
      label: "Pre-Market",
      session: "pre_market",
    };
  }

  // After-hours print. Yahoo often flips marketState to CLOSED at 8 p.m. ET
  // while leaving postMarket* populated — keep that last extended print (and
  // its label) until the next pre-market session.
  if (
    (clockSession === "after_hours" || clockSession === "closed")
    && (state === "POST" || state === "POSTPOST" || state === "CLOSED")
    && quote.postMarketPrice != null
  ) {
    const move = getExtendedMove(quote.postMarketPrice);
    return {
      price: quote.postMarketPrice,
      change: move.change ?? quote.postMarketChange,
      changePercent: move.changePercent ?? quote.postMarketChangePercent,
      label: "After Hours",
      session: "after_hours",
    };
  }

  // Markets closed with only a regular close available.
  if (clockSession === "closed" || state === "CLOSED") {
    return {
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      label: "At close",
      session: "closed",
    };
  }

  // Regular session / fallback
  return {
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    label: null,
    session: "regular",
  };
}
