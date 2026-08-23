/**
 * Capital-Map sleeve buckets used to classify a live book against Study templates.
 *
 * Fit compares U.S. equity / intl / bonds / gold / commodities / cash.
 * Individual stock sectors (Technology, …) collapse to U.S. equity here;
 * Reliance still reads the raw Capital Map label for copy like `Tech 61%`.
 */

import { getMarketInstrument } from "@/lib/market/market-instruments";

export const SLEEVE_BUCKETS = [
  "usEquity",
  "intl",
  "bonds",
  "gold",
  "commodities",
  "cash",
] as const;

export type SleeveBucket = (typeof SLEEVE_BUCKETS)[number];

export type SleeveMix = Record<SleeveBucket, number>;

export type BookHolding = {
  ticker: string;
  weight: number | null;
  /** Capital Map / portfolioExposure label, or a stock sector. */
  exposure?: string | null;
};

export type RankedHolding = {
  ticker: string;
  weight: number;
  exposure: string | null;
};

const GOLD_TICKERS = new Set(["GLD", "IAU", "SGOL", "GLDM"]);

const SHORT_EXPOSURE: Record<string, string> = {
  Technology: "Tech",
  "Health Care": "Health",
  "Communication Services": "Comms",
  "Consumer Discretionary": "Disc.",
  "Consumer Staples": "Staples",
  Financials: "Fins",
  Industrials: "Indust.",
  "U.S. Equity": "U.S. eq.",
  "International Equity": "Intl",
  "Fixed Income": "Bonds",
  Commodities: "Cmdty",
};

export function rankedHoldings(holdings: BookHolding[]): RankedHolding[] {
  return holdings
    .filter((holding): holding is BookHolding & { weight: number } =>
      typeof holding.ticker === "string"
      && holding.ticker.trim().length > 0
      && typeof holding.weight === "number"
      && Number.isFinite(holding.weight)
      && holding.weight >= 0,
    )
    .map((holding) => ({
      ticker: holding.ticker.trim().toUpperCase(),
      weight: holding.weight,
      exposure: holding.exposure?.trim() || null,
    }))
    .sort((a, b) => b.weight - a.weight);
}

export function emptySleeveMix(): SleeveMix {
  return {
    usEquity: 0,
    intl: 0,
    bonds: 0,
    gold: 0,
    commodities: 0,
    cash: 0,
  };
}

/** Map a ticker + Capital Map label onto a Fit sleeve. Gold is split from commodities. */
export function sleeveBucketFor(ticker: string, exposure?: string | null): SleeveBucket | null {
  const symbol = ticker.trim().toUpperCase();
  if (GOLD_TICKERS.has(symbol)) return "gold";

  const instrument = getMarketInstrument(symbol);
  const label = (exposure ?? instrument?.portfolioExposure ?? "").trim().toLowerCase();

  if (label.includes("international")) return "intl";
  if (label.includes("fixed income") || label.includes("bond")) return "bonds";
  if (label === "cash" || instrument?.portfolioExposure === "Cash") return "cash";
  if (label.includes("commodit")) return "commodities";
  if (label.includes("crypto") || label.includes("currency")) return null;

  return "usEquity";
}

export function mixFromHoldings(holdings: BookHolding[]): SleeveMix {
  const mix = emptySleeveMix();
  for (const holding of rankedHoldings(holdings)) {
    const bucket = sleeveBucketFor(holding.ticker, holding.exposure);
    if (bucket) mix[bucket] += holding.weight;
  }
  return mix;
}

export function sleeveDistance(a: SleeveMix, b: SleeveMix): number {
  return SLEEVE_BUCKETS.reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0);
}

/** 100 = identical mix. L1 of six 0–100 buckets is at most 200. */
export function scoreSleeveMix(current: SleeveMix, target: SleeveMix): number {
  return Math.max(0, Math.round(100 - sleeveDistance(current, target) / 2));
}

/** Shared-ticker weight, capped at 100 — Fit's tie-break, not the primary score. */
export function tickerOverlap(
  current: Array<{ ticker: string; weight: number }>,
  target: Array<{ ticker: string; weight: number }>,
): number {
  const have = new Map(current.map((row) => [row.ticker.toUpperCase(), row.weight]));
  let shared = 0;
  for (const sleeve of target) {
    shared += Math.min(have.get(sleeve.ticker.toUpperCase()) ?? 0, sleeve.weight);
  }
  return Math.min(100, shared);
}

export function shortExposureLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return SHORT_EXPOSURE[trimmed] ?? trimmed;
}
