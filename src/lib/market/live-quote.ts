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

/** Extended-hours quote line for TradingView-style rows (nullable = No trades). */
export interface ExtendedSessionQuote {
  /** "Pre-Market" or "After Hours" when the ET clock is in that window. */
  sessionLabel: "Pre-Market" | "After Hours" | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** True when the session is extended but Yahoo has no print yet. */
  noTrades: boolean;
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
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));

  // Weekends: no regular session. Keep the Friday post window conceptually open
  // so callers can still surface the last AH print (Yahoo leaves it up).
  if (weekday === "Sat" || weekday === "Sun") return "after_hours";

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "pre_market";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "regular";
  // After the close (incl. overnight past 8pm ET and Mon 12:00–4:00am): keep
  // the last post print visible until pre starts — Yahoo keeps After Hours up
  // through the weekend into Monday morning.
  if (minutes >= 16 * 60 || minutes < 4 * 60) return "after_hours";
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
 * ("Pre-Market" or "After Hours").
 *
 * Logic:
 * - `marketState === "PRE"`  → use preMarket* fields (fall back to regular)
 * - `marketState === "POST"` or `"POSTPOST"` → use postMarket* fields (fall back to regular)
 * - Otherwise → use the regular price/change/changePercent fields
 */
export function getLivePrice(quote: LiveQuoteInput, now = new Date()): LivePrice {
  const state = quote.marketState ?? "";
  const session = getMarketSession(quote.marketState);
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
      session,
    };
  }

  // After-hours. Yahoo often clears marketState / postMarket* meta after 8pm ET
  // but leaves the completed post print (or 5m bars) — keep showing it overnight
  // and across the weekend until Monday pre-market.
  if (
    clockSession === "after_hours" &&
    (state === "POST" || state === "POSTPOST" || state === "CLOSED" || state === "REGULAR" || state === "") &&
    quote.postMarketPrice != null
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

  // Regular / closed / fallback (incl. AH clock with no post print yet)
  return {
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    label: null,
    session:
      clockSession === "closed"
      || (clockSession === "after_hours" && state !== "POST" && state !== "POSTPOST" && state !== "REGULAR")
        ? "closed"
        : "regular",
  };
}

/**
 * Extended-hours line for TV-style quote stacks.
 * Unlike getLivePrice, this stays in the pre/AH window even when Yahoo has
 * no print yet — so the UI can render “No trades” instead of a false 0%.
 */
export function getExtendedSessionQuote(
  quote: LiveQuoteInput,
  now = new Date(),
): ExtendedSessionQuote {
  const clock = easternClockSession(now);
  const state = quote.marketState ?? "";

  const moveFrom = (extendedPrice: number | null, fallbackChange: number | null, fallbackPct: number | null) => {
    if (extendedPrice == null || quote.price == null) {
      return { change: fallbackChange, changePercent: fallbackPct };
    }
    const change = extendedPrice - quote.price;
    return {
      change,
      changePercent: quote.price !== 0 ? (change / quote.price) * 100 : fallbackPct,
    };
  };

  if (clock === "pre_market") {
    const price = quote.preMarketPrice;
    const move = moveFrom(price, quote.preMarketChange, quote.preMarketChangePercent);
    return {
      sessionLabel: "Pre-Market",
      price,
      change: move.change,
      changePercent: move.changePercent,
      noTrades: price == null,
    };
  }

  if (
    clock === "after_hours"
    && (state === "POST" || state === "POSTPOST" || state === "CLOSED" || state === "REGULAR" || state === "")
  ) {
    // REGULAR can linger briefly after the bell; still prefer a post print when present.
    const price = quote.postMarketPrice;
    if (price == null) {
      // Live post window: surface No trades. Overnight/weekend after Yahoo
      // cleared meta with no derived bar: stay quiet (don't spam every name).
      if (state === "POST" || state === "POSTPOST") {
        return {
          sessionLabel: "After Hours",
          price: null,
          change: null,
          changePercent: null,
          noTrades: true,
        };
      }
      return { sessionLabel: null, price: null, change: null, changePercent: null, noTrades: false };
    }
    const move = moveFrom(price, quote.postMarketChange, quote.postMarketChangePercent);
    return {
      sessionLabel: "After Hours",
      price,
      change: move.change,
      changePercent: move.changePercent,
      noTrades: false,
    };
  }

  return {
    sessionLabel: null,
    price: null,
    change: null,
    changePercent: null,
    noTrades: false,
  };
}
