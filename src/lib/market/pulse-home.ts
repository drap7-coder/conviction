import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";
import {
  editorialThemeScore,
  headlineSimilarity,
  orderNewsBriefThemes,
  primaryHeadline,
} from "@/lib/market/news-hero";

export type PulseHomeStories = {
  todaysBrief: MarketNarrativeTheme[];
  worthUnderstanding: MarketNarrativeTheme | null;
};

/**
 * Pick up to three market-wide brief themes, then one distinct deeper story
 * that does not repeat the brief lead headline.
 */
export function selectPulseHomeStories(
  themes: MarketNarrativeTheme[],
  nowMs = Date.now(),
): PulseHomeStories {
  const ordered = orderNewsBriefThemes(themes, nowMs);
  const todaysBrief = ordered.slice(0, 3);
  const briefIds = new Set(todaysBrief.map((theme) => theme.id));
  const briefLead = todaysBrief[0] ? primaryHeadline(todaysBrief[0]) : null;

  const candidates = ordered
    .filter((theme) => !briefIds.has(theme.id))
    .sort((a, b) => editorialThemeScore(b, nowMs) - editorialThemeScore(a, nowMs));

  const worthUnderstanding =
    candidates.find((theme) => {
      const headline = primaryHeadline(theme);
      if (!headline || !briefLead) return true;
      return headlineSimilarity(headline.title, briefLead.title) < 0.5;
    }) ?? null;

  return { todaysBrief, worthUnderstanding };
}

export function personalSnapshotTickers(
  holdings: string[],
  watched: string[],
  limit = 6,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...holdings, ...watched]) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push(ticker);
    if (out.length >= limit) break;
  }
  return out;
}
