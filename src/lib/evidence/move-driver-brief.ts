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
  /** One supporting line (second headline), if any */
  evidence: string | null;
  /** Optional catalyst/theme chip */
  badge: { label: string; tone: string } | null;
  /** Extra headlines under the lead (deduped) */
  headlines: MoveDriverHeadline[];
  dateLabel: string | null;
}

/** Session move size that justifies showing an empty-catalyst card. */
export const MOVE_DRIVER_ABS_CHANGE_PCT = 1;

export function normalizeHeadlineDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function isRecentHeadlineDate(dateRaw: string, now = new Date()): boolean {
  const iso = normalizeHeadlineDate(dateRaw);
  if (!iso) return false;
  const todayIso = marketTodayIso(now);
  if (iso === todayIso) return true;
  const today = new Date(`${todayIso}T12:00:00Z`);
  const d = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(d.getTime())) return false;
  return Math.round((today.getTime() - d.getTime()) / 86_400_000) === 1;
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
  const recent = input.headlines.filter((item) => isRecentHeadlineDate(item.date, now));
  const driver = usableNewsDriver(input.driver);
  const catalyst: TodayCatalyst | null = recent.length > 0
    ? deriveTodayCatalyst(
      recent.map((item) => ({ headline: item.headline, date: item.date })),
      driver?.label,
      { ticker: input.ticker, companyName: input.companyName, now },
    )
    : null;

  const hasFreshStory = recent.length > 0;
  const meaningfulMove =
    typeof input.absChangePercent === "number"
    && Number.isFinite(input.absChangePercent)
    && Math.abs(input.absChangePercent) >= MOVE_DRIVER_ABS_CHANGE_PCT;

  if (!hasFreshStory && !meaningfulMove) {
    return {
      mode: "hidden",
      title: "What’s driving the move",
      conclusion: "",
      evidence: null,
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
      evidence: null,
      badge: null,
      headlines: [],
      dateLabel: null,
    };
  }

  const lead = recent[0]!;
  const support = recent.find((item) => !sameHeadline(item.headline, lead.headline)) ?? null;
  const extras = recent
    .filter((item) =>
      !sameHeadline(item.headline, lead.headline)
      && (!support || !sameHeadline(item.headline, support.headline)),
    )
    .slice(0, 2);

  const themeLabel = primaryDriverLabel(driver);
  const badge = showBadge
    ? (catalyst
      ? { label: catalyst.label, tone: catalyst.tone }
      : themeLabel
        ? { label: themeLabel, tone: "contested" }
        : null)
    : (themeLabel && !catalyst
      ? { label: themeLabel, tone: "contested" }
      : null);

  return {
    mode: "catalyst",
    title: "What’s driving the move",
    conclusion: lead.headline,
    evidence: support?.headline ?? null,
    badge,
    headlines: extras,
    dateLabel: formatDateLabel(lead.date),
  };
}
