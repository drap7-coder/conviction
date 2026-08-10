/**
 * Presentation helpers for the company “What’s driving the move” card.
 * Headline-first, recency-gated, no theme-as-title fluff.
 */

import type { NewsDriver } from "./news-driver";
import {
  deriveTodayCatalyst,
  marketTodayIso,
  type TodayCatalyst,
} from "./today-catalyst";

export interface MoveDriverHeadline {
  headline: string;
  url: string | null;
  date: string;
}

export type MoveDriverMode = "catalyst" | "no_catalyst" | "hidden";

export interface MoveDriverView {
  mode: MoveDriverMode;
  /** Section title */
  title: string;
  /** Lead line — a real headline, never a theme label */
  conclusion: string;
  /** Link for the lead headline when available */
  conclusionUrl: string | null;
  /** Optional catalyst/theme chip */
  badge: { label: string; tone: string } | null;
  /** Up to 2 more headlines under the lead (deduped, linked in UI) */
  headlines: MoveDriverHeadline[];
  dateLabel: string | null;
}

/** Session move size that justifies showing an empty-catalyst card. */
export const MOVE_DRIVER_ABS_CHANGE_PCT = 1;

/** Card only opens when something is this fresh. */
export const MOVE_DRIVER_FRESH_DAYS = 1;

/** Sibling headlines may be this old when filling out a 3-item list. */
export const MOVE_DRIVER_SIBLING_DAYS = 3;

export function normalizeHeadlineDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function ageInMarketDays(dateRaw: string, now = new Date()): number | null {
  const iso = normalizeHeadlineDate(dateRaw);
  if (!iso) return null;
  const todayIso = marketTodayIso(now);
  const today = new Date(`${todayIso}T12:00:00Z`);
  const d = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(d.getTime())) return null;
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

export function isRecentHeadlineDate(
  dateRaw: string,
  now = new Date(),
  maxAgeDays = MOVE_DRIVER_FRESH_DAYS,
): boolean {
  const age = ageInMarketDays(dateRaw, now);
  return age !== null && age >= 0 && age <= maxAgeDays;
}

/** Theme driver usable as a chip — not as the card title. */
export function usableNewsDriver(driver: NewsDriver | null | undefined): NewsDriver | null {
  if (!driver) return null;
  if (/still forming/i.test(driver.label)) return null;
  return driver;
}

export function primaryDriverLabel(driver: NewsDriver | null | undefined): string | null {
  const usable = usableNewsDriver(driver);
  if (!usable) return null;
  return usable.label.split(" · ")[0]?.trim() || usable.label;
}

function formatDateLabel(dateRaw: string): string {
  const iso = normalizeHeadlineDate(dateRaw);
  if (!iso) return "Recent";
  const d = new Date(`${iso}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sameHeadline(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function dedupeHeadlines(items: MoveDriverHeadline[]): MoveDriverHeadline[] {
  const out: MoveDriverHeadline[] = [];
  for (const item of items) {
    if (out.some((existing) => sameHeadline(existing.headline, item.headline))) continue;
    out.push(item);
  }
  return out;
}

export interface BuildMoveDriverViewInput {
  ticker: string;
  companyName?: string;
  driver: NewsDriver | null;
  headlines: MoveDriverHeadline[];
  /** Absolute session change percent, if known */
  absChangePercent?: number | null;
  /** When false, omit catalyst chip (header already shows it). */
  showBadge?: boolean;
  now?: Date;
}

/**
 * Decide whether the move-driver card should lead, show a no-catalyst note,
 * or stay hidden so Conviction signals keep the top slot.
 */
export function buildMoveDriverView(input: BuildMoveDriverViewInput): MoveDriverView {
  const now = input.now ?? new Date();
  const showBadge = input.showBadge !== false;
  const fresh = input.headlines.filter((item) =>
    isRecentHeadlineDate(item.date, now, MOVE_DRIVER_FRESH_DAYS),
  );
  const driver = usableNewsDriver(input.driver);
  const catalyst: TodayCatalyst | null = fresh.length > 0
    ? deriveTodayCatalyst(
      fresh.map((item) => ({ headline: item.headline, date: item.date })),
      driver?.label,
      { ticker: input.ticker, companyName: input.companyName, now },
    )
    : null;

  const hasFreshStory = fresh.length > 0;
  const meaningfulMove =
    typeof input.absChangePercent === "number"
    && Number.isFinite(input.absChangePercent)
    && Math.abs(input.absChangePercent) >= MOVE_DRIVER_ABS_CHANGE_PCT;

  if (!hasFreshStory && !meaningfulMove) {
    return {
      mode: "hidden",
      title: "What’s driving the move",
      conclusion: "",
      conclusionUrl: null,
      badge: null,
      headlines: [],
      dateLabel: null,
    };
  }

  if (!hasFreshStory) {
    return {
      mode: "no_catalyst",
      title: "What’s driving the move",
      conclusion: "No clear news catalyst for today’s move",
      conclusionUrl: null,
      badge: null,
      headlines: [],
      dateLabel: null,
    };
  }

  // Lead must be fresh. Fill out to 3 with slightly older siblings when needed.
  const siblings = input.headlines.filter((item) =>
    isRecentHeadlineDate(item.date, now, MOVE_DRIVER_SIBLING_DAYS),
  );
  const stacked = dedupeHeadlines([...fresh, ...siblings]).slice(0, 3);
  const lead = stacked[0]!;
  const more = stacked.slice(1);

  // One intentional pill: catalyst kind only (Earnings, Analyst upgrade, …).
  // Never promote vague theme labels into the badge.
  const badge = showBadge && catalyst
    ? { label: catalyst.label, tone: catalyst.tone }
    : null;

  return {
    mode: "catalyst",
    title: "What’s driving the move",
    conclusion: lead.headline,
    conclusionUrl: lead.url,
    badge,
    headlines: more,
    dateLabel: formatDateLabel(lead.date),
  };
}
