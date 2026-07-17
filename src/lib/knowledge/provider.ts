import { PodcastEpisode } from "./types";

/**
 * RSS feed definitions for investment podcasts.
 * Failures are isolated per-feed and never throw.
 */
const PODCAST_FEEDS = [
  {
    id: "compound-and-friends",
    showName: "Compound and Friends",
    feedUrl: "https://feeds.megaphone.fm/TCP4771071679",
    artworkUrl: null,
  },
  {
    id: "invest-like-the-best",
    showName: "Invest Like the Best",
    feedUrl: "https://feeds.megaphone.fm/CLS2859450455",
    artworkUrl: null,
  },
];

const FETCH_TIMEOUT_MS = 8_000;
const EPISODES_PER_FEED = 3;

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "i"),
  );
  return match ? match[1].trim() : null;
}

function extractTagAttr(
  xml: string,
  tag: string,
  attr: string,
): string | null {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*\\s${attr}\\s*=\\s*["']([^"']*)["']`, "i"),
  );
  return match ? match[1].trim() : null;
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    items.push(match[0]);
  }
  return items;
}

function parseDuration(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const total = Number(trimmed);
    if (total <= 0) return "";
    if (total >= 3600) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const m = Math.floor(total / 60);
    return `${m} min`;
  }
  if (/^\d+:\d+:\d+$/.test(trimmed)) {
    const [h, m] = trimmed.split(":").map(Number);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  }
  if (/^\d+:\d+$/.test(trimmed)) {
    const [m] = trimmed.split(":").map(Number);
    return `${m} min`;
  }
  return trimmed;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

function parseEpisode(itemXml: string, showName: string): PodcastEpisode | null {
  const title = extractTag(itemXml, "title");
  if (!title) return null;

  const rawDescription = extractTag(itemXml, "description") || "";
  const description = stripHtml(rawDescription).slice(0, 300);

  const rawDuration =
    extractTag(itemXml, "itunes:duration") ||
    extractTag(itemXml, "duration") ||
    "";
  const duration = parseDuration(rawDuration);

  const pubDate = extractTag(itemXml, "pubDate") || "";

  const audioUrl =
    extractTagAttr(itemXml, "enclosure", "url") || "";
  if (!audioUrl) return null;

  const linkUrl = extractTag(itemXml, "link") || "";
  if (!linkUrl) return null;

  const artworkUrl =
    extractTagAttr(itemXml, "itunes:image", "href") ||
    extractTagAttr(itemXml, "media:thumbnail", "url") ||
    null;

  const id = `${showName}::${title}`;

  return {
    id,
    title,
    showName,
    description,
    duration,
    pubDate,
    audioUrl,
    linkUrl,
    artworkUrl,
  };
}

function isValidEpisode(ep: PodcastEpisode): boolean {
  return (
    ep.title.length > 0 &&
    ep.showName.length > 0 &&
    ep.linkUrl.length > 0 &&
    (ep.linkUrl.startsWith("http://") || ep.linkUrl.startsWith("https://"))
  );
}

async function fetchAndParseFeed(
  feed: (typeof PODCAST_FEEDS)[number],
): Promise<PodcastEpisode[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(feed.feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Compatible; Conviction-Bot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      console.warn(`[knowledge-provider] ${feed.showName}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.length < 100) return [];

    const items = extractItems(xml);
    const episodes: PodcastEpisode[] = [];

    for (const itemXml of items.slice(0, EPISODES_PER_FEED)) {
      const ep = parseEpisode(itemXml, feed.showName);
      if (ep && isValidEpisode(ep)) {
        episodes.push(ep);
      }
    }

    return episodes;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[knowledge-provider] ${feed.showName}: timeout`);
    } else {
      console.warn(
        `[knowledge-provider] ${feed.showName}:`,
        err instanceof Error ? err.message : err,
      );
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch investment podcast episodes from all configured RSS feeds.
 * Takes 3 episodes from each feed, then sorts by publication date so
 * episodes from different shows interleave in the rail.
 * Failures are isolated per-feed.
 */
export async function fetchKnowledgePodcastEpisodes(): Promise<PodcastEpisode[]> {
  const results = await Promise.allSettled(
    PODCAST_FEEDS.map((feed) => fetchAndParseFeed(feed)),
  );

  const episodes: PodcastEpisode[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      episodes.push(...result.value);
    }
  }

  // Deduplicate by stable key
  const seen = new Set<string>();
  const deduplicated = episodes.filter((ep) => {
    if (seen.has(ep.id)) return false;
    seen.add(ep.id);
    return true;
  });

  // Sort by publication date descending so the rail interleaves shows
  return deduplicated.sort((a, b) => {
    const aTime = new Date(a.pubDate).getTime();
    const bTime = new Date(b.pubDate).getTime();
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return bTime - aTime;
    }
    // Fall back to stable sort by id
    return a.id.localeCompare(b.id);
  });
}