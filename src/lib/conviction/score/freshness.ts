/** Shared freshness helpers for CategoryScore adapters. */

const MS_PER_DAY = 86_400_000;

/** Default stale threshold — matches existing conviction scoring (≈90 days). */
export const STALE_AFTER_DAYS = 90;

export function ageInDays(date: string | null | undefined, now = new Date()): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - timestamp) / MS_PER_DAY);
}

export function isSourceStale(
  sourceDate: string | null | undefined,
  now = new Date(),
  thresholdDays = STALE_AFTER_DAYS,
): boolean {
  return ageInDays(sourceDate, now) > thresholdDays;
}

export function clampSignedScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}
