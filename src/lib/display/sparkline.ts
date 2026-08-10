/**
 * Tiny SVG sparkline helpers for watchlist / heat tiles.
 * Values are closes; we draw the last N points into a fixed viewBox.
 */

export type SparklineTone = "positive" | "negative" | "neutral";

export function sparklineToneFromChange(
  changePercent: number | null | undefined,
): SparklineTone {
  if (changePercent == null || !Number.isFinite(changePercent)) return "neutral";
  if (Math.abs(changePercent) < 0.05) return "neutral";
  return changePercent > 0 ? "positive" : "negative";
}

export function sparklineStroke(tone: SparklineTone): string {
  if (tone === "positive") return "var(--green)";
  if (tone === "negative") return "var(--red)";
  return "rgba(255,255,255,0.45)";
}

export function sparklineGlow(tone: SparklineTone): string {
  if (tone === "positive") return "color-mix(in srgb, var(--green) 55%, transparent)";
  if (tone === "negative") return "color-mix(in srgb, var(--red) 55%, transparent)";
  return "rgba(255,255,255,0.18)";
}

/** Build an SVG path + last-point coords for a sparkline. */
export function buildSparklineGeometry(
  values: number[],
  width = 120,
  height = 36,
  pad = 2,
): { path: string; lastX: number; lastY: number } | null {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = pad + index * step;
    const y = pad + innerH - ((value - min) / range) * innerH;
    return { x, y };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const last = coords[coords.length - 1]!;
  return { path, lastX: last.x, lastY: last.y };
}

/** Prefer quote sparkline closes; fall back to a short synthetic trail from last price. */
export function sparklineValuesFromQuote(input: {
  sparkline?: Array<{ close: number }> | null;
  price?: number | null;
  previousClose?: number | null;
  limit?: number;
}): number[] {
  const limit = input.limit ?? 15;
  const fromHistory = (input.sparkline ?? [])
    .map((point) => point.close)
    .filter((value) => Number.isFinite(value))
    .slice(-limit);
  if (fromHistory.length >= 2) return fromHistory;

  const price = input.price;
  const previous = input.previousClose;
  if (
    typeof price === "number" && Number.isFinite(price)
    && typeof previous === "number" && Number.isFinite(previous)
  ) {
    // Stub a gentle trail from prior close → live price across ~15 steps.
    const out: number[] = [];
    for (let i = 0; i < limit; i++) {
      const t = i / (limit - 1);
      out.push(previous + (price - previous) * t);
    }
    return out;
  }
  return fromHistory;
}
