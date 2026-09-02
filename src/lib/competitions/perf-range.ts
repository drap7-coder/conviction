/** Head-to-head campus performance windows (not lifetime / banked). */

export const H2H_PERF_RANGES = ["1d", "1w", "1m", "ytd"] as const;

export type H2HPerfRange = (typeof H2H_PERF_RANGES)[number];

export const DEFAULT_H2H_PERF_RANGE: H2HPerfRange = "ytd";

export const H2H_PERF_RANGE_OPTIONS: Array<{ value: H2HPerfRange; label: string }> = [
  /** Session return vs prior close — same idea as brokerage “Today”. */
  { value: "1d", label: "Today" },
  { value: "1w", label: "Weekly" },
  { value: "1m", label: "Monthly" },
  { value: "ytd", label: "YTD" },
];

export function h2hPerfRangeLabel(range: H2HPerfRange): string {
  return H2H_PERF_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "YTD";
}

export function parseH2HPerfRange(raw: string | null | undefined): H2HPerfRange {
  const value = raw?.trim().toLowerCase();
  if (value === "1d" || value === "1w" || value === "1m" || value === "ytd") {
    return value;
  }
  return DEFAULT_H2H_PERF_RANGE;
}

/**
 * Offline demo scale so Today / Weekly / Monthly / YTD don't all show the same
 * fabricated banked lifetime % when Yahoo isn't available.
 */
export function seedRangeScale(range: H2HPerfRange): number {
  if (range === "1d") return 0.08;
  if (range === "1w") return 0.22;
  if (range === "1m") return 0.45;
  return 1;
}

/** Equal-weight period return from a baseline spot to current. */
export function periodReturnPct(startPrice: number, currentPrice: number): number {
  if (!Number.isFinite(startPrice) || startPrice <= 0 || !Number.isFinite(currentPrice)) {
    return 0;
  }
  return Math.round(((currentPrice - startPrice) / startPrice) * 10000) / 100;
}

/**
 * Resolve the score baseline for one active pick over a longer window.
 * Mid-window picks use entry; earlier picks use the period open.
 * Today does not use this — use ticker session % via {@link pickPeriodReturnPct}.
 */
export function resolvePickPeriodStart(input: {
  periodStartPrice: number | null;
  periodStartAt: string | null;
  entryPrice: number;
  pickedAt: string | null;
}): number | null {
  const entry = input.entryPrice;
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const periodStart = input.periodStartPrice;
  if (periodStart === null || !Number.isFinite(periodStart) || periodStart <= 0) {
    return entry;
  }

  if (!input.pickedAt || !input.periodStartAt) {
    return periodStart;
  }

  const pickedMs = Date.parse(input.pickedAt);
  const periodMs = Date.parse(input.periodStartAt);
  if (!Number.isFinite(pickedMs) || !Number.isFinite(periodMs)) {
    return periodStart;
  }

  // Pick opened after the window started — score from entry, not period open.
  if (pickedMs > periodMs) return entry;
  return periodStart;
}

/**
 * Period return for one campus pick.
 * Today is always the ticker's session % (e.g. AAPL +2%) — never entry-based.
 * Longer windows use period open, or entry when the pick started mid-window.
 */
export function pickPeriodReturnPct(input: {
  range: H2HPerfRange;
  entryPrice: number;
  pickedAt: string | null;
  baseline: {
    startPrice: number | null;
    startAt: string | null;
    currentPrice: number | null;
    sessionReturnPct?: number | null;
  } | null | undefined;
}): number | null {
  const baseline = input.baseline;
  if (!baseline) return null;

  if (input.range === "1d") {
    if (
      typeof baseline.sessionReturnPct === "number" &&
      Number.isFinite(baseline.sessionReturnPct)
    ) {
      return baseline.sessionReturnPct;
    }
    const start = baseline.startPrice;
    const current = baseline.currentPrice;
    if (start === null || current === null) return null;
    return periodReturnPct(start, current);
  }

  const current = baseline.currentPrice;
  if (current === null) return null;
  const start = resolvePickPeriodStart({
    periodStartPrice: baseline.startPrice,
    periodStartAt: baseline.startAt,
    entryPrice: input.entryPrice,
    pickedAt: input.pickedAt,
  });
  if (start === null) return null;
  return periodReturnPct(start, current);
}
