import type { KnowledgeItem } from "./types";

interface PodcastFeed {
  id: string;
  title: string;
  creator: string;
  description: string;
  feedUrl: string;
}

const FEEDS: PodcastFeed[] = [
  {
    id: "invest-like-the-best",
    title: "Invest Like the Best",
    creator: "Patrick O'Shaughnessy",
    description: "Conversations with exceptional investors and business builders.",
    feedUrl: "https://feeds.megaphone.fm/CLS2859450455",
  },
  {
    id: "compound-and-friends",
    title: "Compound and Friends",
    creator: "Josh Brown & Michael Batnick",
    description: "A weekly, evidence-driven market roundtable.",
    feedUrl: "https://feeds.megaphone.fm/TCP4771071679",
  },
];

const FRESH_MS = 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
let cache: { items: KnowledgeItem[]; fetchedAt: number } | null = null;

function decode(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decode(match[1]) : null;
}

function attr(xml: string, name: string, attribute: string) {
  const value = xml.match(new RegExp(`<${name}[^>]*\\s${attribute}=["']([^"']+)["']`, "i"))?.[1];
  return value ? decode(value) : null;
}

function channelXml(xml: string) {
  return xml.split(/<item[\s>]/i)[0];
}

function firstItem(xml: string) {
  return xml.match(/<item[\s>]([\s\S]*?)<\/item>/i)?.[0] ?? "";
}

function duration(raw: string | null) {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
  }
  if (/^\d+:\d+:\d+$/.test(raw)) {
    const [hours, minutes] = raw.split(":").map(Number);
    return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
  }
  return raw;
}

async function fetchWithTimeout(url: string, accept: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, "User-Agent": "Conviction-Knowledge/1.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function appleArtwork(title: string): Promise<string | null> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", title);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", "5");
  const data = await (await fetchWithTimeout(url.toString(), "application/json")).json() as {
    results?: Array<{ collectionName?: string; artworkUrl600?: string; artworkUrl100?: string }>;
  };
  const target = normalize(title);
  const match = data.results?.find((item) => normalize(item.collectionName ?? "") === target);
  return match?.artworkUrl600 ?? match?.artworkUrl100 ?? null;
}

async function resolveFeed(feed: PodcastFeed): Promise<KnowledgeItem> {
  const xml = await (await fetchWithTimeout(feed.feedUrl, "application/rss+xml, application/xml")).text();
  const channel = channelXml(xml);
  const episode = firstItem(xml);
  const showTitle = tag(channel, "title") ?? feed.title;
  const rssArtwork = attr(channel, "itunes:image", "href") || tag(channel, "url");
  const artworkUrl = rssArtwork ?? await appleArtwork(showTitle).catch(() => null);
  const canonicalUrl = tag(channel, "link") ?? feed.feedUrl;
  const episodeUrl = tag(episode, "link") ?? canonicalUrl;

  return {
    id: feed.id,
    kind: "podcast",
    title: showTitle,
    creator: tag(channel, "itunes:author") ?? feed.creator,
    artworkUrl,
    canonicalUrl,
    description: tag(channel, "description") ?? feed.description,
    latestItem: episode ? {
      title: tag(episode, "title") ?? "Latest episode",
      duration: duration(tag(episode, "itunes:duration")),
      publishedAt: tag(episode, "pubDate"),
      canonicalUrl: episodeUrl,
    } : undefined,
  };
}

export async function getKnowledgePodcasts(): Promise<KnowledgeItem[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < FRESH_MS) return cache.items;
  try {
    const results = await Promise.allSettled(FEEDS.map(resolveFeed));
    const items = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (items.length === 0) throw new Error("No podcast providers succeeded");
    cache = { items, fetchedAt: now };
    return items;
  } catch (error) {
    if (cache && now - cache.fetchedAt < STALE_MS) return cache.items;
    throw error;
  }
}
