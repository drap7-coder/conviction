import type { PulseIndicator } from "@/app/api/market/pulse/route";
import { isFiniteNumber } from "@/lib/display/format";

export type PulseGaugeTone = "calm" | "steady" | "elevated" | "stress" | "quiet";
export type PulseGaugeAccent = "vix" | "yield";

export interface PulseGaugeCard {
  id: PulseGaugeAccent;
  ticker: string;
  label: string;
  value: string;
  fill: number;
  tone: PulseGaugeTone;
  status: string;
  caption: string;
  accent: PulseGaugeAccent;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function signedDelta(value: number | null, decimals: number): string | null {
  if (!isFiniteNumber(value)) return null;
  const abs = Math.abs(value).toFixed(decimals);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

function caption(delta: string | null): string {
  return delta ? `${delta} vs. yesterday` : "vs. yesterday";
}

/**
 * Yahoo sometimes quotes ^TNX as 42.8 (10×) instead of 4.28.
 * A real 10-year yield will not print above 20 in this product.
 */
export function normalizeTenYear(price: number | null, change: number | null): {
  last: number | null;
  change: number | null;
} {
  if (!isFiniteNumber(price)) return { last: null, change: isFiniteNumber(change) ? change : null };
  if (price <= 20) return { last: price, change: isFiniteNumber(change) ? change : null };
  return {
    last: Number((price / 10).toFixed(4)),
    change: isFiniteNumber(change) ? Number((change / 10).toFixed(4)) : null,
  };
}

export function vixStatus(last: number): { status: string; tone: PulseGaugeTone } {
  if (last < 18) return { status: "CALM", tone: "calm" };
  if (last < 23) return { status: "STEADY", tone: "steady" };
  if (last < 30) return { status: "ELEVATED", tone: "elevated" };
  return { status: "STRESS", tone: "stress" };
}

export function yieldStatus(change: number | null): { status: string; tone: PulseGaugeTone } {
  if (!isFiniteNumber(change)) return { status: "STEADY", tone: "steady" };
  if (Math.abs(change) < 0.04) return { status: "STEADY", tone: "steady" };
  if (change > 0) return { status: "RISING", tone: "elevated" };
  return { status: "FALLING", tone: "calm" };
}

export function vixGauge(indicator: PulseIndicator | undefined): PulseGaugeCard {
  const last = indicator?.price ?? null;
  const change = indicator?.change ?? null;
  const classified = isFiniteNumber(last) ? vixStatus(last) : { status: "—", tone: "quiet" as const };
  return {
    id: "vix",
    ticker: "^VIX",
    label: "VIX",
    value: isFiniteNumber(last) ? last.toFixed(1) : "—",
    fill: isFiniteNumber(last) ? clamp(((last - 10) / 30) * 100, 4, 100) : 0,
    tone: classified.tone,
    status: classified.status,
    caption: caption(signedDelta(change, 1)),
    accent: "vix",
  };
}

export function yieldGauge(indicator: PulseIndicator | undefined): PulseGaugeCard {
  const { last, change } = normalizeTenYear(indicator?.price ?? null, indicator?.change ?? null);
  const classified = isFiniteNumber(last)
    ? yieldStatus(change)
    : { status: "—", tone: "quiet" as const };
  return {
    id: "yield",
    ticker: "^TNX",
    label: "10Y YIELD",
    value: isFiniteNumber(last) ? `${last.toFixed(2)}%` : "—",
    fill: isFiniteNumber(last) ? clamp(((last - 1.5) / 4.5) * 100, 4, 100) : 0,
    tone: classified.tone,
    status: classified.status,
    caption: caption(signedDelta(change, 2)),
    accent: "yield",
  };
}

export function pulseMacroGauges(indicators: PulseIndicator[]): PulseGaugeCard[] {
  const byTicker = new Map(indicators.map((item) => [item.ticker.toUpperCase(), item]));
  return [vixGauge(byTicker.get("^VIX")), yieldGauge(byTicker.get("^TNX"))];
}
