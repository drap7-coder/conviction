/** Head-to-head campus performance windows (not lifetime / banked). */

export const H2H_PERF_RANGES = ["1d", "1w", "1m", "ytd"] as const;

export type H2HPerfRange = (typeof H2H_PERF_RANGES)[number];

export const DEFAULT_H2H_PERF_RANGE: H2HPerfRange = "ytd";

export const H2H_PERF_RANGE_OPTIONS: Array<{ value: H2HPerfRange; label: string }> = [
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
  { value: "1m", label: "Monthly" },
  { value: "ytd", label: "YTD" },
];

export function parseH2HPerfRange(raw: string | null | undefined): H2HPerfRange {
  const value = raw?.trim().toLowerCase();
  if (value === "1d" || value === "1w" || value === "1m" || value === "ytd") {
    return value;
  }
  return DEFAULT_H2H_PERF_RANGE;
}

/**
 * Offline demo scale so Daily / Weekly / Monthly / YTD don't all show the same
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

const etDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isSameEtCalendarDay(
  left: string | Date,
  right: string | Date = new Date(),
): boolean {
  const leftMs = left instanceof Date ? left.getTime() : Date.parse(left);
  const rightMs = right instanceof Date ? right.getTime() : Date.parse(right);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
  return etDayFmt.format(new Date(leftMs)) === etDayFmt.format(new Date(rightMs));
}

/**
 * Resolve the score baseline for one active pick over a window.
 * Mid-window picks use entry; earlier picks use the period open.
 * For Daily (`sameEtDayIsMidWindow`), mid-window means picked today in ET.
 */
export function resolvePickPeriodStart(input: {
  periodStartPrice: number | null;
  periodStartAt: string | null;
  entryPrice: number;
  pickedAt: string | null;
  sameEtDayIsMidWindow?: boolean;
}): number | null {
  const entry = input.entryPrice;
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const periodStart = input.periodStartPrice;
  if (periodStart === null || !Number.isFinite(periodStart) || periodStart <= 0) {
    return entry;
  }

  if (input.sameEtDayIsMidWindow) {
    if (input.pickedAt && isSameEtCalendarDay(input.pickedAt)) return entry;
    return periodStart;
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
