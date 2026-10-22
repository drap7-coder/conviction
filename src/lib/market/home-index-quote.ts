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
