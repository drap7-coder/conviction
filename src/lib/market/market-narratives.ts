import { fetchGoogleNewsRss, fetchRssNews } from "@/lib/evidence/news-rss";

const CACHE_SECONDS = 5 * 60;

export type NarrativeHeat = "surging" | "building" | "steady" | "quiet";
export type NarrativeMarketTone = "positive" | "negative" | "mixed";

/** Pulse heatmap groups these narratives attach to (one primary group each). */
export type NarrativeHeatmapGroup =
  | "Major Index"
  | "Themes"
  | "Commodity"
  | "Crypto"
  | "International"
  | "Industries";

export interface NarrativeThemeConfig {
  id: string;
  label: string;
  query: string;
  newsTicker: string;
  /** Which Pulse heatmap shell owns this narrative. */
  heatmapGroup: NarrativeHeatmapGroup;
  assets: Array<{ ticker: string; label: string }>;
  headlinePattern: RegExp;
}

export const MARKET_NARRATIVE_THEMES: NarrativeThemeConfig[] = [
  {
    id: "ai-compute",
    label: "AI + Compute",
    query: "Nvidia",
    newsTicker: "NVDA",
    heatmapGroup: "Major Index",
    assets: [
      { ticker: "QQQ", label: "Nasdaq 100" },
      { ticker: "SPY", label: "S&P 500" },
      { ticker: "DIA", label: "Dow 30" },
    ],
    headlinePattern: /ai|artificial intelligence|chip|semiconductor|nvidia|data center|nasdaq|s&p/i,
  },
  {
    id: "rates-fed",
    label: "Rates + Style",
    query: "Federal Reserve",
    newsTicker: "TLT",
    heatmapGroup: "Themes",
    assets: [
      { ticker: "SCHD", label: "Dividends" },
      { ticker: "VNQ", label: "Real Estate" },
      { ticker: "IYT", label: "Transports" },
    ],
    headlinePattern: /fed|rate|yield|treasury|inflation|dividend|reit|real estate|transport/i,
  },
  {
    id: "energy-oil",
    label: "Energy + Metals",
    query: "oil",
    newsTicker: "USO",
    heatmapGroup: "Commodity",
    assets: [
      { ticker: "USO", label: "Oil" },
      { ticker: "GLD", label: "Gold" },
      { ticker: "SLV", label: "Silver" },
    ],
    headlinePattern: /oil|crude|opec|energy|gas|gold|silver|commodity/i,
  },
  {
    id: "crypto-liquidity",
    label: "Crypto + Liquidity",
    query: "Bitcoin",
    newsTicker: "BTC-USD",
    heatmapGroup: "Crypto",
    assets: [
      { ticker: "BTC-USD", label: "Bitcoin" },
      { ticker: "ETH-USD", label: "Ethereum" },
      { ticker: "SOL-USD", label: "Solana" },
    ],
    headlinePattern: /bitcoin|ethereum|solana|crypto|stablecoin|digital asset/i,
  },
  {
    id: "trade-supply",
    label: "Trade + Global",
    query: "tariffs",
    newsTicker: "MCHI",
    heatmapGroup: "International",
    assets: [
      { ticker: "MCHI", label: "China" },
      { ticker: "EWJ", label: "Japan" },
      { ticker: "EWT", label: "Taiwan" },
    ],
    headlinePattern: /tariff|trade|export|china|japan|taiwan|supply chain|global/i,
  },
  {
    id: "consumer-demand",
    label: "Sector Leadership",
    query: "inflation",
    newsTicker: "XLY",
    heatmapGroup: "Industries",
    assets: [
      { ticker: "XLK", label: "Technology" },
      { ticker: "XLY", label: "Discretionary" },
      { ticker: "XLF", label: "Financials" },
    ],
    headlinePattern: /consumer|inflation|retail|spending|sector|financials|technology|discretionary/i,
  },
];

export interface NarrativeAssetMove {
  ticker: string;
  label: string;
  changePercent: number | null;
}

export interface MarketNarrativeHeadline {
  title: string;
  url: string | null;
  date: string;
  publisher?: string | null;
}

export interface MarketNarrativeTheme {
  id: string;
  label: string;
  heatmapGroup: NarrativeHeatmapGroup;
  heat: NarrativeHeat;
  marketTone: NarrativeMarketTone;
  score: number;
  /** News intensity proxy (fresh matched coverage relative to baseline). */
  velocity: number;
  summary: string;
  /** Primary matched headline (drivers panel). */
  headline: MarketNarrativeHeadline | null;
  /** Broader RSS stack for the Pulse News feed. */
  headlines: MarketNarrativeHeadline[];
  newsTicker: string;
  assets: NarrativeAssetMove[];
}

export function themesForHeatmapGroup(
  themes: MarketNarrativeTheme[],
  group: NarrativeHeatmapGroup | string,
): MarketNarrativeTheme[] {
  return themes
    .filter((theme) => theme.heatmapGroup === group)
    .sort((a, b) => b.score - a.score);
}

export interface MarketNarrativePulse {
  status: "live" | "partial" | "unavailable";
  themes: MarketNarrativeTheme[];
  fetchedAt: string;
  methodology: string;
}

export interface NarrativeScoreInput {
  matchedHeadlines: number;
  totalHeadlines: number;
  freshHeadlines: number;
  assetMoves: Array<number | null>;
}

export interface NarrativeScore {
  heat: NarrativeHeat;
  marketTone: NarrativeMarketTone;
  score: number;
  velocity: number;
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function headlineAgeDays(isoDate: string, now: Date): number | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return (now.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1_000);
}

/** Rank themes from news coverage + linked-asset price reaction (no social feeds). */
export function scoreNarrative(input: NarrativeScoreInput): NarrativeScore {
  const matched = Math.max(0, input.matchedHeadlines);
  const total = Math.max(0, input.totalHeadlines);
  const fresh = Math.max(0, input.freshHeadlines);
  const validMoves = input.assetMoves.filter(
    (move): move is number => move !== null && Number.isFinite(move),
  );
  const averageMove = validMoves.length
    ? validMoves.reduce((sum, move) => sum + move, 0) / validMoves.length
    : 0;
  const averageAbsoluteMove = validMoves.length
    ? validMoves.reduce((sum, move) => sum + Math.abs(move), 0) / validMoves.length
    : 0;

  const velocity = total === 0
    ? 0
    : round(clamp((matched * 1.4 + fresh) / Math.max(total * 0.35, 1), 0, 25));

  let heat: NarrativeHeat = "steady";
  if (total === 0) heat = "quiet";
  else if (matched >= 3 && fresh >= 2 && (velocity >= 2.2 || averageAbsoluteMove >= 0.9)) {
    heat = "surging";
  } else if (matched >= 1 && fresh >= 1) heat = "building";
  else if (matched === 0 && fresh === 0) heat = "quiet";

  const marketTone: NarrativeMarketTone = averageMove > 0.45
    ? "positive"
    : averageMove < -0.45
      ? "negative"
      : "mixed";

  const coveragePoints = Math.min(55, matched * 9 + fresh * 6 + Math.log2(total + 1) * 4);
  const marketPoints = Math.min(30, averageAbsoluteMove * 8);
  const freshnessBoost = Math.min(15, fresh * 3);
  const score = Math.round(clamp(coveragePoints + marketPoints + freshnessBoost, 0, 100));

  return { heat, marketTone, score, velocity };
}

export function narrativeSummary(
  label: string,
  score: NarrativeScore,
  assets: NarrativeAssetMove[],
): string {
  const lead = [...assets]
    .filter((asset) => asset.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0];
  const leadMove = lead?.changePercent;
  const leadText = lead && leadMove !== null
    ? `${lead.ticker} is ${leadMove > 0 ? "+" : ""}${leadMove.toFixed(1)}%`
    : "linked markets are mixed";

  if (score.heat === "surging") {
    return `${label} leads the tape; ${leadText}.`;
  }
  if (score.heat === "building") {
    return `${label} is in focus as ${leadText}.`;
  }
  if (score.heat === "quiet") {
    return `Little fresh coverage; ${leadText}.`;
  }
  return `${label} holds; ${leadText}.`;
}

function toNarrativeHeadline(item: {
  title: string;
  sourceUrl?: string | null;
  date: string;
  metadata?: { publisher?: string };
}): MarketNarrativeHeadline {
  return {
    title: item.title,
    url: item.sourceUrl ?? null,
    date: item.date,
    publisher: item.metadata?.publisher ?? null,
  };
}

const HEADLINE_STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "has", "in",
  "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
]);

function headlineTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !HEADLINE_STOP_WORDS.has(token)),
  );
}

function headlineSimilarity(a: string, b: string): number {
  const aTokens = headlineTokens(a);
  const bTokens = headlineTokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }
  return shared / Math.min(aTokens.size, bTokens.size);
}

function publisherWeight(publisher: string | null | undefined): number {
  const value = publisher?.toLowerCase() ?? "";
  if (/reuters|associated press|ap news|bloomberg|financial times|wall street journal/.test(value)) return 4;
  if (/cnbc|yahoo finance|marketwatch|barron|fortune|business insider/.test(value)) return 3;
  if (/seeking alpha|benzinga|motley fool|globenewswire|business wire/.test(value)) return 1;
  return 2;
}

function lowValueHeadline(title: string): boolean {
  return /stocks? moving|whale activity|millionaire maker|stock to buy|before you buy|moomoo|press release/i.test(title);
}

function rankHeadlines(
  headlines: MarketNarrativeHeadline[],
  pattern: RegExp,
  now: Date,
): MarketNarrativeHeadline[] {
  return [...headlines].sort((a, b) => {
    const aMatch = pattern.test(a.title) ? 1 : 0;
    const bMatch = pattern.test(b.title) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;

    const aLowValue = lowValueHeadline(a.title) ? 1 : 0;
    const bLowValue = lowValueHeadline(b.title) ? 1 : 0;
    if (aLowValue !== bLowValue) return aLowValue - bLowValue;

    const sourceDiff = publisherWeight(b.publisher) - publisherWeight(a.publisher);
    if (sourceDiff !== 0) return sourceDiff;

    const aAge = headlineAgeDays(a.date, now);
    const bAge = headlineAgeDays(b.date, now);
    const aScore = aAge === null ? Number.POSITIVE_INFINITY : aAge;
    const bScore = bAge === null ? Number.POSITIVE_INFINITY : bAge;
    if (aScore !== bScore) return aScore - bScore;
    return a.title.localeCompare(b.title);
  });
}

function dedupeHeadlines(headlines: MarketNarrativeHeadline[]): MarketNarrativeHeadline[] {
  const kept: MarketNarrativeHeadline[] = [];
  for (const headline of headlines) {
    const duplicate = kept.some((existing) =>
      existing.title.trim().toLowerCase() === headline.title.trim().toLowerCase()
      || headlineSimilarity(existing.title, headline.title) >= 0.72,
    );
    if (!duplicate) kept.push(headline);
  }
  return kept;
}

async function fetchTheme(
  config: NarrativeThemeConfig,
  assets: NarrativeAssetMove[],
  now: Date,
): Promise<MarketNarrativeTheme> {
  // Yahoo by ticker + Google by ticker/theme query for broader, more relevant coverage.
  const [yahooHeadlines, googleTickerHeadlines, googleThemeHeadlines] = await Promise.all([
    fetchRssNews(config.newsTicker, 10).catch(() => []),
    fetchGoogleNewsRss(config.newsTicker, 10, config.query).catch(() => []),
    fetchGoogleNewsRss(config.newsTicker, 8, config.label).catch(() => []),
  ]);

  const pool = [...yahooHeadlines, ...googleTickerHeadlines, ...googleThemeHeadlines];
  const headlines = dedupeHeadlines(
    rankHeadlines(
      pool
        .map(toNarrativeHeadline)
        .filter((headline) => headline.title.trim().length > 0),
      config.headlinePattern,
      now,
    ),
  ).slice(0, 10);

  const matchedHeadlines = headlines.filter((headline) =>
    config.headlinePattern.test(headline.title),
  ).length;
  const freshHeadlines = headlines.filter((headline) => {
    const age = headlineAgeDays(headline.date, now);
    return age !== null && age <= 2;
  }).length;

  const scored = scoreNarrative({
    matchedHeadlines,
    totalHeadlines: headlines.length,
    freshHeadlines,
    assetMoves: assets.map((asset) => asset.changePercent),
  });

  const primary = headlines.find((headline) => config.headlinePattern.test(headline.title))
    ?? headlines[0]
    ?? null;

  return {
    id: config.id,
    label: config.label,
    heatmapGroup: config.heatmapGroup,
    ...scored,
    summary: narrativeSummary(config.label, scored, assets),
    headline: primary,
    headlines,
    newsTicker: config.newsTicker,
    assets,
  };
}

export async function fetchMarketNarrativePulse(
  assetMoves: Map<string, number | null>,
  now = new Date(),
): Promise<MarketNarrativePulse> {
  const bucketMs = CACHE_SECONDS * 1_000;
  const bucketedNow = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const settled = await Promise.allSettled(MARKET_NARRATIVE_THEMES.map((config) => {
    const assets = config.assets.map((asset) => ({
      ...asset,
      changePercent: assetMoves.get(asset.ticker) ?? null,
    }));
    return fetchTheme(config, assets, bucketedNow);
  }));
  const themes = settled
    .filter((result): result is PromiseFulfilledResult<MarketNarrativeTheme> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => b.score - a.score);
  const failures = settled.length - themes.length;

  return {
    status: themes.length === 0 ? "unavailable" : failures > 0 ? "partial" : "live",
    themes,
    fetchedAt: bucketedNow.toISOString(),
    methodology:
      "Ranks broad market narratives by news coverage (Yahoo + Google RSS), headline relevance, and linked-asset price reaction.",
  };
}
