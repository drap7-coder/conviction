/** US Eastern helpers for weekly pick windows (no extra deps). */

const ET = "America/New_York";

type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function etParts(date: Date): EtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/** Build a UTC Date for an ET wall-clock moment (handles DST via probe). */
export function etWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
  for (let i = 0; i < 3; i += 1) {
    const p = etParts(guess);
    const deltaMin =
      (hour - p.hour) * 60 +
      (minute - p.minute) +
      (day - p.day) * 24 * 60;
    if (deltaMin === 0) return guess;
    guess.setUTCMinutes(guess.getUTCMinutes() + deltaMin);
  }
  return guess;
}

export type WeekWindow = {
  periodStart: Date;
  lockAt: Date;
  periodEnd: Date;
  weekKey: string;
};

/** Sun 00:00 ET → Fri 16:00 ET; lock Mon 09:30 ET. */
export function weekWindowContaining(date: Date): WeekWindow {
  const p = etParts(date);
  const dayOffset = p.weekday;
  const sunday = new Date(date);
  sunday.setUTCDate(sunday.getUTCDate() - dayOffset);
  const sp = etParts(sunday);

  const periodStart = etWallTimeToUtc(sp.year, sp.month, sp.day, 0, 0);
  const lockDay = new Date(periodStart);
  lockDay.setUTCDate(lockDay.getUTCDate() + 1);
  const lp = etParts(lockDay);
  const lockAt = etWallTimeToUtc(lp.year, lp.month, lp.day, 9, 30);
  const friday = new Date(periodStart);
  friday.setUTCDate(friday.getUTCDate() + 5);
  const fp = etParts(friday);
  const periodEnd = etWallTimeToUtc(fp.year, fp.month, fp.day, 16, 0);

  const weekKey = `${sp.year}-${String(sp.month).padStart(2, "0")}-${String(sp.day).padStart(2, "0")}`;
  return { periodStart, lockAt, periodEnd, weekKey };
}

export function competitionStatusLabel(
  status: string,
  lockAt: Date,
  periodEnd: Date,
  now = new Date(),
): string {
  if (status === "final" || status === "archived") return "Final";
  if (status === "live") return "Live";
  if (now < lockAt) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: ET,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `Locks ${fmt.format(lockAt)} ET`;
  }
  if (now < periodEnd) return "Live";
  return "Final";
}

export function isSubmissionOpen(status: string, lockAt: Date, now = new Date()): boolean {
  return status === "open" && now < lockAt;
}
