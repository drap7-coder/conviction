import { fetchRssNews } from "@/lib/evidence/news-rss";
import { fetchWithTimeout } from "@/lib/request-timeout";

const BLUESKY_SEARCH_URL = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const CACHE_SECONDS = 5 * 60;

export type NarrativeHeat = "surging" | "building" | "steady" | "quiet";
export type NarrativeMarketTone = "positive" | "negative" | "mixed";

/** Pulse heatmap groups these narratives attach to (one primary group each). */
export type NarrativeHeatmapGroup =
  | "Major Index"
  | "U.S. Markets"
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
    label: "Rates + Breadth",
    query: "Federal Reserve",
    newsTicker: "TLT",
    heatmapGroup: "U.S. Markets",
    assets: [
      { ticker: "IWM", label: "Russell 2000" },
      { ticker: "UUP", label: "U.S. Dollar" },
      { ticker: "XLU", label: "Utilities" },
    ],
    headlinePattern: /fed|rate|yield|treasury|inflation|dollar|breadth|small cap/i,
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

export interface MarketNarrativeTheme {
  id: string;
  label: string;
  heatmapGroup: NarrativeHeatmapGroup;
  heat: NarrativeHeat;
  marketTone: NarrativeMarketTone;
  score: number;
  velocity: number;
  mentionsLastHour: number;
  uniqueAuthorsLastHour: number;
  summary: string;
  headline: { title: string; url: string | null; date: string } | null;
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
  mentionsLastHour: number;
  mentionsPreviousHour: number;
  mentionsLast24Hours: number;
  uniqueAuthorsLastHour: number;
  assetMoves: Array<number | null>;
}

export interface NarrativeScore {
  heat: NarrativeHeat;
  marketTone: NarrativeMarketTone;
  score: number;
  velocity: number;
}

interface BlueskyPost {
  indexedAt?: string;
  author?: { did?: string };
}

interface BlueskySearchResponse {
  hitsTotal?: number;
  posts?: BlueskyPost[];
}

interface ThemeChatterSample {
  posts: BlueskyPost[];
  mentionsLastHour: number;
  mentionsLast24Hours: number;
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreNarrative(input: NarrativeScoreInput): NarrativeScore {
  const current = Math.max(0, input.mentionsLastHour);
  const day = Math.max(current, input.mentionsLast24Hours);
  const baselineHourly = Math.max((day - current) / 23, 0.5);
  const velocity = current === 0 ? 0 : round(clamp(current / baselineHourly, 0, 25));
  const validMoves = input.assetMoves.filter((move): move is number => move !== null && Number.isFinite(move));
  const averageMove = validMoves.length
    ? validMoves.reduce((sum, move) => sum + move, 0) / validMoves.length
    : 0;
  const averageAbsoluteMove = validMoves.length
    ? validMoves.reduce((sum, move) => sum + Math.abs(move), 0) / validMoves.length
    : 0;

  let heat: NarrativeHeat = "steady";
  if (current === 0) heat = "quiet";
  else if (current >= 6 && input.uniqueAuthorsLastHour >= 5 && velocity >= 2.5) heat = "surging";
  else if (current >= 3 && input.uniqueAuthorsLastHour >= 2 && velocity >= 1.4) heat = "building";

  const marketTone: NarrativeMarketTone = averageMove > 0.45
    ? "positive"
    : averageMove < -0.45 ? "negative" : "mixed";
  const chatterPoints = Math.min(55, velocity * 10 + Math.log2(current + 1) * 5);
  const breadthPoints = Math.min(20, input.uniqueAuthorsLastHour * 2);
  const marketPoints = Math.min(25, averageAbsoluteMove * 7);
  const score = Math.round(clamp(chatterPoints + breadthPoints + marketPoints, 0, 100));

  return { heat, marketTone, score, velocity };
}

function narrativeSummary(
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
    return `${label} chatter is ${score.velocity.toFixed(1)}× normal; ${leadText}.`;
  }
  if (score.heat === "building") {
    return `${label} is gaining attention as ${leadText}.`;
  }
  if (score.heat === "quiet") {
    return `Open-market chatter is quiet; ${leadText}.`;
  }
  return `${label} conversation is near baseline; ${leadText}.`;
}

function isoOffset(now: Date, milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString();
}

async function searchThemeChatter(
  query: string,
  since: string,
  until: string,
  limit: number,
): Promise<BlueskySearchResponse> {
  const url = new URL(BLUESKY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "latest");
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("limit", String(limit));

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Conviction/1.0 (open market-narrative research)",
    },
    next: { revalidate: CACHE_SECONDS },
  }, 5_000);
  if (!response.ok) throw new Error(`Bluesky search failed with ${response.status}`);
  return response.json() as Promise<BlueskySearchResponse>;
}

async function fetchThemeChatter(query: string, now: Date): Promise<ThemeChatterSample> {
  const oneHourAgo = isoOffset(now, 60 * 60 * 1_000);
  const day = await searchThemeChatter(
    query,
    isoOffset(now, 24 * 60 * 60 * 1_000),
    now.toISOString(),
    100,
  );
  const posts = day.posts ?? [];
  const mentionsLastHour = posts.filter((post) => {
    const timestamp = post.indexedAt ?? "";
    return timestamp >= oneHourAgo && timestamp < now.toISOString();
  }).length;
  return {
    posts,
    // The latest sample caps at 100, so this is deliberately conservative for
    // very active themes and cannot inflate a velocity spike.
    mentionsLastHour,
    mentionsLast24Hours: day.hitsTotal ?? posts.length,
  };
}

function windowStats(sample: ThemeChatterSample, now: Date) {
  const posts = sample.posts;
  const oneHourAgo = isoOffset(now, 60 * 60 * 1_000);
  const twoHoursAgo = isoOffset(now, 2 * 60 * 60 * 1_000);
  const nowIso = now.toISOString();
  const current = posts.filter((post) => {
    const timestamp = post.indexedAt ?? "";
    return timestamp >= oneHourAgo && timestamp < nowIso;
  });
  const previous = posts.filter((post) => {
    const timestamp = post.indexedAt ?? "";
    return timestamp >= twoHoursAgo && timestamp < oneHourAgo;
  });
  const authors = new Set(current.map((post) => post.author?.did).filter(Boolean));
  return {
    mentionsLastHour: sample.mentionsLastHour,
    mentionsPreviousHour: previous.length,
    mentionsLast24Hours: sample.mentionsLast24Hours,
    uniqueAuthorsLastHour: authors.size,
  };
}

async function fetchTheme(
  config: NarrativeThemeConfig,
  assets: NarrativeAssetMove[],
  now: Date,
): Promise<MarketNarrativeTheme> {
  const [chatter, headlines] = await Promise.all([
    fetchThemeChatter(config.query, now),
    fetchRssNews(config.newsTicker, 6),
  ]);
  const stats = windowStats(chatter, now);
  const scored = scoreNarrative({ ...stats, assetMoves: assets.map((asset) => asset.changePercent) });
  const matchedHeadline = headlines.find((headline) => config.headlinePattern.test(headline.title));

  return {
    id: config.id,
    label: config.label,
    heatmapGroup: config.heatmapGroup,
    ...scored,
    mentionsLastHour: stats.mentionsLastHour,
    uniqueAuthorsLastHour: stats.uniqueAuthorsLastHour,
    summary: narrativeSummary(config.label, scored, assets),
    headline: matchedHeadline ? {
      title: matchedHeadline.title,
      url: matchedHeadline.sourceUrl ?? null,
      date: matchedHeadline.date,
    } : null,
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
    methodology: "Ranks broad market narratives by open chatter velocity, source breadth, and linked-asset price reaction.",
  };
}
