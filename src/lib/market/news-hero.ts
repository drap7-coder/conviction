import { isUsableArticleImage } from "@/lib/evidence/article-image";
import type {
  MarketNarrativeHeadline,
  MarketNarrativeTheme,
} from "@/lib/market/market-narratives";

const HEADLINE_STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "has", "in",
  "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
]);

const FILLER_HEADLINE =
  /sector update|stocks? moving|whale activity|millionaire maker|stock to buy|before you buy|moomoo|press release/i;

const SAME_STORY_THRESHOLD = 0.5;

function headlineTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !HEADLINE_STOP_WORDS.has(token)),
  );
}

export function headlineSimilarity(a: string, b: string): number {
  const aTokens = headlineTokens(a);
  const bTokens = headlineTokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }
  return shared / Math.min(aTokens.size, bTokens.size);
}

export function isFillerHeadline(title: string): boolean {
  return FILLER_HEADLINE.test(title);
}

export function usableHeadlineImage(value: string | null | undefined): string | null {
  if (!value || !isUsableArticleImage(value)) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export function primaryHeadline(theme: MarketNarrativeTheme): MarketNarrativeHeadline | null {
  return theme.headline ?? theme.headlines[0] ?? null;
}

function publisherBoost(publisher: string | null | undefined): number {
  const value = publisher?.toLowerCase() ?? "";
  if (/reuters|associated press|ap news|bloomberg|financial times|wall street journal/.test(value)) {
    return 12;
  }
  if (/cnbc|yahoo finance|marketwatch|barron|fortune|business insider/.test(value)) {
    return 6;
  }
  return 2;
}

function freshnessBoost(isoDate: string, nowMs: number): number {
  const ageMs = nowMs - new Date(isoDate).getTime();
  const ageDays = Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : 30;
  if (ageDays <= 1) return 8;
  if (ageDays <= 2) return 2;
  // Past the News theme window — should rarely appear; keep punitive if it does.
  if (ageDays <= 7) return -18;
  return -36;
}

function uniqueHeadlines(theme: MarketNarrativeTheme): MarketNarrativeHeadline[] {
  const seen = new Set<string>();
  const out: MarketNarrativeHeadline[] = [];
  for (const headline of [theme.headline, ...theme.headlines]) {
    if (!headline?.title.trim()) continue;
    const key = `${headline.title.trim().toLowerCase()}|${headline.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(headline);
  }
  return out;
}

function picturedHeadlineScore(headline: MarketNarrativeHeadline, nowMs: number): number {
  const imageBoost = usableHeadlineImage(headline.imageUrl) ? 14 : 0;
  const fillerPenalty = isFillerHeadline(headline.title) ? 18 : 0;
  return publisherBoost(headline.publisher) + freshnessBoost(headline.date, nowMs) + imageBoost - fillerPenalty;
}

/** Editorial rank for Brief cards. Photo helps, but does not outrank a much more important theme. */
export function editorialThemeScore(theme: MarketNarrativeTheme, nowMs = Date.now()): number {
  const headline = primaryHeadline(theme);
  if (!headline) return theme.score - 100;
  return theme.score + picturedHeadlineScore(headline, nowMs);
}

/**
 * Headline shown on a Brief card. For the featured hero, prefer an important
 * article that actually has a usable photo — same story first, else the best
 * pictured non-filler headline in the theme. Never glue an unrelated photo
 * onto a different title.
 */
export function pickHeroHeadline(
  theme: MarketNarrativeTheme,
  nowMs = Date.now(),
): MarketNarrativeHeadline | null {
  const lead = primaryHeadline(theme);
  if (!lead) return null;

  const pool = uniqueHeadlines(theme);
  const pictured = pool
    .filter((headline) => usableHeadlineImage(headline.imageUrl) && !isFillerHeadline(headline.title))
    .sort((a, b) => picturedHeadlineScore(b, nowMs) - picturedHeadlineScore(a, nowMs));

  if (pictured.length === 0) return lead;

  if (usableHeadlineImage(lead.imageUrl) && !isFillerHeadline(lead.title)) {
    return lead;
  }

  const sameStory = pictured.find((headline) =>
    headline.title === lead.title
    || headlineSimilarity(headline.title, lead.title) >= SAME_STORY_THRESHOLD,
  );
  if (sameStory) {
    return { ...lead, imageUrl: sameStory.imageUrl };
  }

  return pictured[0] ?? lead;
}

export function themeHasHeroPhoto(theme: MarketNarrativeTheme, nowMs = Date.now()): boolean {
  return Boolean(usableHeadlineImage(pickHeroHeadline(theme, nowMs)?.imageUrl));
}

/**
 * Put the most important pictured Brief first so the feed hero has a photo.
 * If nothing has a photo, keep editorial order (text-only full-width fallback).
 */
export function orderNewsBriefThemes(
  themes: MarketNarrativeTheme[],
  nowMs = Date.now(),
): MarketNarrativeTheme[] {
  const ranked = [...themes]
    .filter((theme) => Boolean(primaryHeadline(theme)))
    .sort((a, b) => editorialThemeScore(b, nowMs) - editorialThemeScore(a, nowMs));

  const heroIndex = ranked.findIndex((theme) => themeHasHeroPhoto(theme, nowMs));
  if (heroIndex <= 0) return ranked;

  const hero = ranked[heroIndex];
  return [hero, ...ranked.filter((theme) => theme.id !== hero.id)];
}
