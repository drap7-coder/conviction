/**
 * Competition pick lock window (ET):
 * Open from weekend open (Saturday 00:00 ET) through Monday 9:30 AM ET.
 * Locked from Monday RTH open until the next Saturday.
 */

export type MarketClockParts = {
  weekday: string;
  minutes: number;
};

export function easternClockParts(now = new Date()): MarketClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: value("weekday"),
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

/** True while picks may be submitted or changed. */
export function isCompetitionPickWindowOpen(now = new Date()): boolean {
  const { weekday, minutes } = easternClockParts(now);
  const openMinutes = 9 * 60 + 30; // 9:30 AM ET Monday open

  if (weekday === "Sat" || weekday === "Sun") return true;
  if (weekday === "Mon" && minutes < openMinutes) return true;
  return false;
}

/** Milliseconds until period_end (clamped ≥ 0). */
export function msUntil(iso: string, now = new Date()): number {
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - now.getTime());
}

export function averagesTied(a: number | null, b: number | null, epsilon = 0.005): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= epsilon;
}
