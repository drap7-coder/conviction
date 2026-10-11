import type { EvidenceEvent } from "@/lib/evidence/types";
import { buildNewsDriver } from "@/lib/evidence/news-driver";

export type BriefName = { ticker: string; held: boolean };
export type BriefStory = { ticker: string; held: boolean; event: EvidenceEvent };

export function briefContext(event: EvidenceEvent, ticker: string): string {
  const driver = buildNewsDriver([event], ticker);
  return driver
    ? `${driver.explanation} This is context inferred from the report, not a confirmed explanation of the share-price move.`
    : "Check whether this report changes the company’s revenue outlook, costs, or risks. Confirm the details in the source before drawing conclusions from the headline.";
}

/** Holdings first; stable, deduplicated coverage with a strict request budget. */
export function briefNames(held: string[], watched: string[]): BriefName[] {
  const names = new Map<string, BriefName>();
  for (const [tickers, isHeld] of [[held, true], [watched, false]] as const) {
    for (const raw of tickers) {
      if (typeof raw !== "string") continue;
      const ticker = raw.trim().toUpperCase();
      if (/^[A-Z0-9.^-]{1,15}$/.test(ticker) && !names.has(ticker)) {
        names.set(ticker, { ticker, held: isHeld });
      }
    }
  }
  return [...names.values()];
}

export function selectBriefStories(stories: BriefStory[], now = Date.now()): BriefStory[] {
  const seen = new Set<string>();
  return stories.filter(({ event }) => {
    const age = now - Date.parse(event.date);
    return Number.isFinite(age) && age >= 0 && age <= 48 * 3_600_000 &&
      /^https?:\/\//i.test(event.sourceUrl) && Boolean(event.title?.trim());
  }).sort((a, b) => Number(b.held) - Number(a.held) ||
    Date.parse(b.event.date) - Date.parse(a.event.date) || a.ticker.localeCompare(b.ticker))
    .filter(({ event }) => {
      const key = event.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
}
