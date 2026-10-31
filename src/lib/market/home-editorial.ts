import type { StockHistoryPoint } from "@/lib/market/quotes";

/** Factual direction only: never infer a news cause from a price move. */
export function marketTakeaway(change: number | null | undefined): string {
  if (change == null || !Number.isFinite(change)) return "The market picture is still coming together.";
  if (Math.abs(change) < 0.05) return "U.S. stocks are little changed.";
  return change > 0 ? "U.S. stocks are moving higher." : "U.S. stocks are moving lower.";
}

/** Oil earns Home space only when its move is independently meaningful. */
export function shouldShowOilSignal(
  oilChange: number | null | undefined,
  broadMarketChange: number | null | undefined,
): boolean {
  if (oilChange == null || !Number.isFinite(oilChange)) return false;
  if (Math.abs(oilChange) >= 2) return true;
  return broadMarketChange != null
    && Number.isFinite(broadMarketChange)
    && Math.abs(oilChange - broadMarketChange) >= 2.5;
}

export function oilSignalContext(
  oilChange: number,
  broadMarketChange: number | null | undefined,
): string {
  if (broadMarketChange != null && Number.isFinite(broadMarketChange)) {
    if (oilChange * broadMarketChange < 0) {
      return `Oil is moving ${oilChange > 0 ? "higher" : "lower"} while stocks move the other way—a cross-asset divergence worth watching.`;
    }
    if (Math.abs(oilChange - broadMarketChange) >= 2.5) {
      return "Oil’s move is materially outpacing the broad market.";
    }
  }
  return "Oil is making a material session move.";
}

export function homeChart(history: StockHistoryPoint[]) {
  const points = history.filter(p => Number.isFinite(p.close) && Number.isFinite(Date.parse(p.date)))
    .toSorted((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (points.length < 2) return null;
  const low = Math.min(...points.map(p => p.close));
  const high = Math.max(...points.map(p => p.close));
  const first = Date.parse(points[0].date);
  const last = Date.parse(points[points.length - 1].date);
  if (first === last) return null;
  const span = high - low;
  const path = points.map((p, i) => {
    const x = (Date.parse(p.date) - first) / (last - first) * 100;
    const y = span ? 90 - (p.close - low) / span * 80 : 50;
    return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return { path, low, high, first: points[0].date, last: points[points.length - 1].date };
}

export function briefingEdition(now: Date) {
  const zone = "America/New_York";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(now);
  return {
    iso: new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    label: new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now),
    weekend: weekday === "Sat" || weekday === "Sun",
  };
}

/** The banner describes the available print, not today's calendar or a presumed cause. */
export function briefingLead(change: number | null | undefined, session: string | undefined) {
  if (change == null || !Number.isFinite(change)) return "The market picture is still coming together.";
  const direction = Math.abs(change) < .05 ? "holds steady" : change > 0 ? "edges higher" : "edges lower";
  const strongDirection = Math.abs(change) >= 1 ? (change > 0 ? "climbs" : "falls") : direction;
  const timing = session === "Pre-Market" ? "in the pre-market snapshot" : session === "After Hours" ? "in the after-hours snapshot" : session === "Closed" ? "in the latest completed session" : "in the latest session snapshot";
  return `S&P 500 proxy ${strongDirection} ${timing}.`;
}

export const HOME_READING_LENSES: Record<string, string> = {
  "ai-compute": "What does this mean for demand, spending or competition in technology?",
  "rates-fed": "What could this change about borrowing costs and company financing?",
  "energy-oil": "Could supply, transport costs or demand change the energy picture?",
  "crypto-liquidity": "What does the reporting say about liquidity and appetite for risk?",
  "trade-supply": "Which supply chains and international markets are directly affected?",
  "consumer-demand": "What does this reveal about customers, company earnings or sector demand?",
};
