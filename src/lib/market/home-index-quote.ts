import {
  easternClockSession,
  getLivePrice,
  type LivePrice,
  type LiveQuoteInput,
} from "@/lib/market/live-quote";

/**
 * Cash indexes (^GSPC / SPX) often have no Yahoo pre/AH print while the ETF
 * proxy (SPY) does. During extended hours, prefer the proxy session move so
 * Home / Pulse do not keep painting yesterday's regular close as "live."
 *
 * Informational only — no expense-ratio or tracking-basis adjustment.
 */
export function resolveHomeIndexLiveQuote(
  quote: LiveQuoteInput,
  proxy: LiveQuoteInput | null | undefined,
  now = new Date(),
): LivePrice {
  const live = getLivePrice(quote, now);
  const clock = easternClockSession(now);
  if (clock !== "pre_market" && clock !== "after_hours") {
    return live;
  }

  const primaryHasExtendedPrint =
    clock === "pre_market"
      ? quote.preMarketPrice != null
      : quote.postMarketPrice != null;
  if (primaryHasExtendedPrint || !proxy) {
    return live;
  }

  const proxyLive = getLivePrice(proxy, now);
  if (proxyLive.label == null || proxyLive.changePercent == null) {
    return live;
  }

  const proxyRegular = proxy.price;
  const proxyExtended = proxyLive.price;
  const indexRegular = quote.price;
  const impliedLevel =
    indexRegular != null
    && proxyRegular != null
    && proxyRegular !== 0
    && proxyExtended != null
      ? indexRegular * (proxyExtended / proxyRegular)
      : live.price;

  return {
    price: impliedLevel,
    change:
      impliedLevel != null && indexRegular != null
        ? impliedLevel - indexRegular
        : proxyLive.change,
    changePercent: proxyLive.changePercent,
    label: proxyLive.label,
    session: proxyLive.session,
  };
}

export function homeIndexSessionLabel(live: LivePrice): string {
  if (live.label) return live.label;
  if (live.session === "closed") return "Closed";
  if (live.session === "pre_market") return "Pre-Market";
  if (live.session === "after_hours") return "After Hours";
  return "Regular";
}

/**
 * Home tile dual print (Yahoo / CNBC style):
 * - Live / PRE·AH % as the headline move
 * - Prior regular-session % kept as context ("what happened yesterday")
 */
export type HomeIndexDisplayQuote = {
  /** Regular-session last (RTH close). */
  regularPrice: number | null;
  regularChange: number | null;
  regularChangePercent: number | null;
  /** Live session last (extended when pre/AH; else regular). */
  livePrice: number | null;
  liveChange: number | null;
  liveChangePercent: number | null;
  sessionLabel: "Pre-Market" | "After Hours" | null;
  extendedNoTrades: boolean;
};

export function resolveHomeIndexDisplayQuote(
  quote: LiveQuoteInput,
  proxy: LiveQuoteInput | null | undefined,
  now = new Date(),
): HomeIndexDisplayQuote {
  const live = resolveHomeIndexLiveQuote(quote, proxy, now);
  const sessionLabel =
    live.label === "Pre-Market" || live.label === "After Hours" ? live.label : null;
  const inExtended = sessionLabel != null;

  return {
    regularPrice: quote.price,
    regularChange: quote.change,
    regularChangePercent: quote.changePercent,
    livePrice: live.price,
    liveChange: live.change,
    liveChangePercent: live.changePercent,
    sessionLabel,
    extendedNoTrades: inExtended && live.changePercent == null && live.price == null,
  };
}
