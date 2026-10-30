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
