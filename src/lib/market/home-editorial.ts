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
  return { path, low, high, points, first: points[0].date, last: points[points.length - 1].date };
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
  if (change == null || !Number.isFinite(change)) return "The day’s market story is still taking shape.";
  const flat = Math.abs(change) < .05;
  const strong = Math.abs(change) >= 1;
  const higher = change > 0;

  if (flat) {
    if (session === "Pre-Market") return "The market is waiting for its opening cue.";
    if (session === "After Hours") return "After the close, the market is holding its place.";
    return "The market is pausing between scenes.";
  }
  if (session === "Pre-Market") {
    if (higher) return strong ? "The market is setting up for an energetic opening." : "The day is opening on a brighter note.";
    return strong ? "A sharp change in mood is shaping the opening." : "A more cautious opening is taking shape.";
  }
  if (session === "After Hours") {
    if (higher) return strong ? "Stocks found a powerful second wind after the close." : "Stocks found a second wind after the close.";
    return strong ? "The mood shifted sharply after the close." : "Stocks lost some momentum after the close.";
  }
  if (session === "Closed") {
    if (higher) return strong ? "Stocks ended the latest session with real momentum." : "Stocks ended the latest session on an upbeat note.";
    return strong ? "Stocks closed the latest session on a decidedly downbeat note." : "Stocks ended the latest session on a softer note.";
  }
  if (higher) return strong ? "Momentum is giving the market a lift today." : "The market is taking a modestly upbeat turn.";
  return strong ? "A sharp change in mood is weighing on the market today." : "The market is taking a more cautious turn.";
}

export const HOME_READING_LENSES: Record<string, string> = {
  "ai-compute": "What could this change about production, advertising, streaming or the tools creative teams use?",
  "rates-fed": "Could this reshape deal financing, budgets or what audiences have left to spend?",
  "energy-oil": "Could this raise the cost of production, travel or getting entertainment to market?",
  "crypto-liquidity": "What does this reveal about risk appetite, attention and where speculative money is flowing?",
  "trade-supply": "Which global businesses, production pipelines or consumer markets are directly exposed?",
  "consumer-demand": "What does this say about subscriptions, discretionary spending and the fight for audience attention?",
};

/** Price direction in everyday language; unknown data must never read as flat. */
export function signalTakeaway(change: number | null | undefined): string {
  if (change == null || !Number.isFinite(change)) return "Update unavailable";
  if (Math.abs(change) < 0.05) return "Little changed";
  if (Math.abs(change) < 1) return change > 0 ? "Slightly higher" : "Slightly lower";
  return change > 0 ? "Higher this session" : "Lower this session";
}
