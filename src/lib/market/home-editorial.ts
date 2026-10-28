import type { StockHistoryPoint } from "@/lib/market/quotes";

/** Factual direction only: never infer a news cause from a price move. */
export function marketTakeaway(change: number | null | undefined): string {
  if (change == null || !Number.isFinite(change)) return "The market picture is still coming together.";
  if (Math.abs(change) < 0.05) return "U.S. stocks are little changed.";
  return change > 0 ? "U.S. stocks are moving higher." : "U.S. stocks are moving lower.";
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
