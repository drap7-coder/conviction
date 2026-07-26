import { fetchWithTimeout } from "@/lib/request-timeout";

const BLUESKY_SEARCH_URL = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const CACHE_SECONDS = 5 * 60;
const SEARCH_TIMEOUT_MS = 5_000;

export type AttentionScope = "market" | "industry" | "company";
export type AttentionSignal =
  | "attention-leading"
  | "price-confirming"
  | "cooling"
  | "steady";
export type AttentionConfidence = "high" | "medium" | "low";

export interface AttentionTarget {
  ticker: string;
  label: string;
  priceChangePercent: number | null;
  scope?: AttentionScope;
}

export interface AttentionScoreInput {
  mentionsLastHour: number;
  mentionsPreviousHour: number;
  mentionsLast24Hours: number;
  uniqueAuthorsLastHour: number;
  largestAuthorShare: number;
  priceChangePercent: number | null;
}

export interface AttentionScore {
  velocity: number;
  accelerationPercent: number;
  score: number;
  signal: AttentionSignal;
  confidence: AttentionConfidence;
}

export interface OpenAttentionItem extends AttentionScore {
  ticker: string;
  label: string;
  scope: AttentionScope;
  mentionsLastHour: number;
  mentionsPreviousHour: number;
  mentionsLast24Hours: number;
  uniqueAuthorsLastHour: number;
  priceChangePercent: number | null;
  summary: string;
}

export interface OpenAttentionPulse {
  source: "bluesky";
  sourceLabel: "Bluesky";
  status: "live" | "partial" | "unavailable";
  items: OpenAttentionItem[];
  fetchedAt: string;
  methodology: string;
}

interface BlueskyPost {
  indexedAt?: string;
  author?: { did?: string };
}

interface BlueskySearchResponse {
  hitsTotal?: number;
  posts?: BlueskyPost[];
}

function safeCount(response: BlueskySearchResponse): number {
  const count = response.hitsTotal ?? response.posts?.length ?? 0;
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreAttention(input: AttentionScoreInput): AttentionScore {
  const current = Math.max(0, input.mentionsLastHour);
  const previous = Math.max(0, input.mentionsPreviousHour);
  const day = Math.max(current, input.mentionsLast24Hours);
  const baselineHourly = Math.max((day - current) / 23, 0.5);
  const velocity = current === 0 ? 0 : round(clamp(current / baselineHourly, 0, 25));
  const accelerationPercent = previous > 0
    ? round(((current - previous) / previous) * 100, 0)
    : current > 0 ? 100 : 0;
  const priceMove = Math.abs(input.priceChangePercent ?? 0);

  let signal: AttentionSignal = "steady";
  if (current >= 3 && velocity >= 2 && priceMove < 0.75) {
    signal = "attention-leading";
  } else if (current >= 3 && velocity >= 1.5 && priceMove >= 0.75) {
    signal = "price-confirming";
  } else if (current < previous * 0.65 || (day >= 4 && velocity < 0.65)) {
    signal = "cooling";
  }

  let confidence: AttentionConfidence = "low";
  if (
    current >= 12
    && input.uniqueAuthorsLastHour >= 8
    && input.largestAuthorShare <= 0.45
  ) {
    confidence = "high";
  } else if (
    current >= 4
    && input.uniqueAuthorsLastHour >= 3
    && input.largestAuthorShare <= 0.67
  ) {
    confidence = "medium";
  }

  const volumePoints = Math.min(35, Math.log2(current + 1) * 8);
  const velocityPoints = Math.min(40, velocity * 10);
  const breadthPoints = Math.min(25, input.uniqueAuthorsLastHour * 2.5);
  const concentrationPenalty = input.largestAuthorShare > 0.5 ? 15 : 0;
  const score = Math.round(clamp(volumePoints + velocityPoints + breadthPoints - concentrationPenalty, 0, 100));

  return { velocity, accelerationPercent, score, signal, confidence };
}

function describeAttention(item: AttentionScoreInput & AttentionScore): string {
  if (item.signal === "attention-leading") {
    return `Conversation is ${item.velocity.toFixed(1)}× normal while price is comparatively quiet.`;
  }
  if (item.signal === "price-confirming") {
    return `Conversation and today’s price move are accelerating together.`;
  }
  if (item.signal === "cooling") {
    return "Conversation is fading relative to its recent pace.";
  }
  if (item.mentionsLastHour === 0) {
    return "No meaningful open-social activity detected in the past hour.";
  }
  return "Conversation is near its recent baseline.";
}

function isoOffset(now: Date, milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString();
}

async function searchPosts(
  ticker: string,
  since: string,
  until: string | null,
  limit: number,
): Promise<BlueskySearchResponse> {
  const url = new URL(BLUESKY_SEARCH_URL);
  url.searchParams.set("q", `$${ticker}`);
  url.searchParams.set("sort", "latest");
  url.searchParams.set("since", since);
  url.searchParams.set("limit", String(limit));
  if (until) url.searchParams.set("until", until);

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Conviction/1.0 (open market-attention research)",
    },
    next: { revalidate: CACHE_SECONDS },
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) throw new Error(`Bluesky search failed with ${response.status}`);
  return response.json() as Promise<BlueskySearchResponse>;
}

async function fetchTargetCounts(ticker: string, now: Date): Promise<{
  current: BlueskySearchResponse;
  previous: BlueskySearchResponse;
  day: BlueskySearchResponse;
}> {
  const oneHourAgo = isoOffset(now, 60 * 60 * 1_000);
  const twoHoursAgo = isoOffset(now, 2 * 60 * 60 * 1_000);
  const oneDayAgo = isoOffset(now, 24 * 60 * 60 * 1_000);
  const nowIso = now.toISOString();

  // One daily sample supplies all windows. This deliberately trades exact counts
  // above 100 posts for a much gentler request pattern on the free public API.
  const day = await searchPosts(ticker, oneDayAgo, nowIso, 100);
  const posts = day.posts ?? [];
  const currentPosts = posts.filter((post) => {
    const timestamp = post.indexedAt ?? "";
    return timestamp >= oneHourAgo && timestamp < nowIso;
  });
  const previousPosts = posts.filter((post) => {
    const timestamp = post.indexedAt ?? "";
    return timestamp >= twoHoursAgo && timestamp < oneHourAgo;
  });
  const current: BlueskySearchResponse = {
    hitsTotal: currentPosts.length,
    posts: currentPosts,
  };
  const previous: BlueskySearchResponse = {
    hitsTotal: previousPosts.length,
    posts: previousPosts,
  };

  return { current, previous, day };
}

function authorBreadth(posts: BlueskyPost[]): {
  uniqueAuthors: number;
  largestAuthorShare: number;
} {
  if (!posts.length) return { uniqueAuthors: 0, largestAuthorShare: 0 };
  const counts = new Map<string, number>();
  for (const post of posts) {
    const did = post.author?.did;
    if (!did) continue;
    counts.set(did, (counts.get(did) ?? 0) + 1);
  }
  const largest = Math.max(...counts.values(), 0);
  return {
    uniqueAuthors: counts.size,
    largestAuthorShare: largest / posts.length,
  };
}

async function fetchAttentionItem(target: AttentionTarget, now: Date): Promise<OpenAttentionItem> {
  const counts = await fetchTargetCounts(target.ticker, now);
  const mentionsLastHour = safeCount(counts.current);
  const mentionsPreviousHour = safeCount(counts.previous);
  const mentionsLast24Hours = counts.day.posts?.length ?? safeCount(counts.day);
  const breadth = authorBreadth(counts.current.posts ?? []);
  const input: AttentionScoreInput = {
    mentionsLastHour,
    mentionsPreviousHour,
    mentionsLast24Hours,
    uniqueAuthorsLastHour: breadth.uniqueAuthors,
    largestAuthorShare: breadth.largestAuthorShare,
    priceChangePercent: target.priceChangePercent,
  };
  const scored = scoreAttention(input);

  return {
    ticker: target.ticker,
    label: target.label,
    scope: target.scope ?? "company",
    mentionsLastHour,
    mentionsPreviousHour,
    mentionsLast24Hours,
    uniqueAuthorsLastHour: breadth.uniqueAuthors,
    priceChangePercent: target.priceChangePercent,
    ...scored,
    summary: describeAttention({ ...input, ...scored }),
  };
}

export async function fetchOpenAttentionPulse(
  targets: AttentionTarget[],
  now = new Date(),
): Promise<OpenAttentionPulse> {
  const bucketMs = CACHE_SECONDS * 1_000;
  const bucketedNow = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const uniqueTargets = Array.from(
    new Map(targets.map((target) => [target.ticker.toUpperCase(), {
      ...target,
      ticker: target.ticker.toUpperCase(),
    }])).values(),
  ).slice(0, 6);

  const settled = await Promise.allSettled(
    uniqueTargets.map((target) => fetchAttentionItem(target, bucketedNow)),
  );
  const items = settled
    .filter((result): result is PromiseFulfilledResult<OpenAttentionItem> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => b.score - a.score);
  const failures = settled.length - items.length;

  return {
    source: "bluesky",
    sourceLabel: "Bluesky",
    status: items.length === 0 ? "unavailable" : failures > 0 ? "partial" : "live",
    items,
    fetchedAt: bucketedNow.toISOString(),
    methodology: "Latest public cashtag sample, compared with each ticker’s trailing 24-hour hourly baseline.",
  };
}
