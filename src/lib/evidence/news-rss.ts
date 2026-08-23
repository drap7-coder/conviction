// ── Lightweight RSS news fetcher ──
// Fetches Yahoo Finance RSS by ticker to provide real recent headlines.
// Falls back to Google News RSS when Yahoo returns off-topic / empty feeds.
// No API key required. Degrades to empty on fetch/parse errors.

import type { EvidenceEvent } from "./types";
import { getMarketInstrumentAlias } from "./market-instrument-aliases";

const YAHOO_RSS_BASE = "https://finance.yahoo.com/rss/headline";
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  imageUrl: string | null;
}

/**
 * Parse RSS XML without a library.
 * This handles Yahoo Finance's specific RSS structure.
 */
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Split on <item> tags
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source");

    if (title && link) {
      items.push({
        title,
        link,
        description: description ?? "",
        pubDate: pubDate ?? "",
        source: source ?? "",
        imageUrl: extractRssImageUrl(block, description ?? ""),
      });
    }
  }

  return items;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  const raw = match?.[1] ?? match?.[2] ?? null;
  return raw ? decodeXmlEntities(raw).trim() : null;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function looksLikeImage(url: string, type: string | null, medium: string | null): boolean {
  if (medium && medium.toLowerCase() === "image") return true;
  if (type && type.toLowerCase().startsWith("image/")) return true;
  if (type || (medium && medium.toLowerCase() !== "image")) return false;
  return /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url)
    || /(?:yimg|zenfs|media|img|image|photo)/i.test(url);
}

function pickImageFromTags(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}\\b([^>]*)(?:\\/>|>)`, "gi");
  let best: { url: string; area: number } | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(block)) !== null) {
    const attrs = match[1];
    const url = extractAttr(attrs, "url") ?? extractAttr(attrs, "href");
    const type = extractAttr(attrs, "type");
    const medium = extractAttr(attrs, "medium");
    if (!isHttpUrl(url) || !looksLikeImage(url, type, medium)) continue;

    const width = Number(extractAttr(attrs, "width") ?? 0);
    const height = Number(extractAttr(attrs, "height") ?? 0);
    const area = (Number.isFinite(width) ? width : 0) * (Number.isFinite(height) ? height : 0);
    if (!best || area > best.area) best = { url, area };
  }

  return best?.url ?? null;
}

function firstDescriptionImage(description: string): string | null {
  const match = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(description);
  const raw = match?.[1] ?? match?.[2] ?? null;
  const url = raw ? decodeXmlEntities(raw).trim() : null;
  return isHttpUrl(url) ? url : null;
}

/** Yahoo often uses media:content; also honor enclosure, thumbnail, itunes, and description <img>. */
export function extractRssImageUrl(block: string, description: string): string | null {
  return pickImageFromTags(block, "media:content")
    ?? pickImageFromTags(block, "enclosure")
    ?? pickImageFromTags(block, "media:thumbnail")
    ?? pickImageFromTags(block, "thumbnail")
    ?? pickImageFromTags(block, "itunes:image")
    ?? firstDescriptionImage(description);
}

function extractTag(xml: string, tag: string): string | null {
  // Handles <tag>value</tag> and <tag><![CDATA[value]]></tag>
  const cdataRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const plainRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssDate(dateStr: string): string {
  // Yahoo RSS format: "Fri, 10 Jul 2026 14:30:00 +0000"
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // fall through
  }
  return new Date().toISOString();
}

function publisherFromItem(item: RssItem, sourceLabel: string): string {
  const source = stripHtml(item.source).trim();
  if (source) return source;
  return sourceLabel.replace(/\s+RSS$/i, "");
}

function cleanPublisherSuffix(title: string, publisher: string): string {
  const clean = stripHtml(title);
  if (!publisher) return clean;
  const escaped = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean.replace(new RegExp(`\\s[-–—]\\s${escaped}$`, "i"), "").trim();
}

async function fetchRssXml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Conviction/1.0 (research tool; nathandrapkin@gmail.com)",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function itemsToEvents(
  items: RssItem[],
  ticker: string,
  limit: number,
  sourceLabel: string,
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (events.length >= limit) break;

    const dedupKey = item.title.toLowerCase().slice(0, 80);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const date = parseRssDate(item.pubDate);
    const description = stripHtml(item.description).slice(0, 300);
    const publisher = publisherFromItem(item, sourceLabel);

    events.push({
      id: `rss-${ticker}-${date}-${events.length}`,
      ticker: ticker.toUpperCase(),
      type: "material-news",
      direction: "neutral",
      title: cleanPublisherSuffix(item.title, publisher).slice(0, 200),
      summary: description || "No summary available.",
      source: "publisher",
      sourceUrl: item.link,
      date,
      disclosureDelay: 0,
      size: 0.5,
      strength: 0.5,
      isContradiction: false,
      aiExplanation: `Sourced RSS headline from ${sourceLabel}.`,
      metadata: {
        publisher,
        imageUrl: item.imageUrl,
        transactionClass: sourceLabel,
      },
    });
  }

  return events;
}

function googleNewsQuery(ticker: string, companyName?: string | null): string {
  const alias = getMarketInstrumentAlias(ticker);
  if (alias) return alias.searchQuery;
  const name = companyName?.trim();
  if (name && name.toUpperCase() !== ticker.toUpperCase()) {
    return `"${ticker}" OR "${name}"`;
  }
  return `"${ticker}" stock`;
}

/**
 * Fetch recent RSS headlines for a ticker.
 * Tries Yahoo Finance first, then Google News when Yahoo is empty/off-topic upstream.
 */
export async function fetchRssNews(
  ticker: string,
  limit = 5,
  companyName?: string | null,
): Promise<EvidenceEvent[]> {
  const upper = ticker.toUpperCase();
  const yahooUrl = `${YAHOO_RSS_BASE}?s=${encodeURIComponent(upper)}`;
  const yahooXml = await fetchRssXml(yahooUrl);
  if (yahooXml) {
    const yahooItems = parseRssXml(yahooXml);
    if (yahooItems.length > 0) {
      return itemsToEvents(yahooItems, upper, limit, "Yahoo Finance RSS");
    }
  }

  const query = googleNewsQuery(upper, companyName);
  const googleUrl =
    `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const googleXml = await fetchRssXml(googleUrl);
  if (!googleXml) return [];
  const googleItems = parseRssXml(googleXml);
  return itemsToEvents(googleItems, upper, limit, "Google News RSS");
}

/**
 * Fetch Google News RSS for a ticker/company (used when Yahoo headlines
 * exist but none are company-relevant).
 */
export async function fetchGoogleNewsRss(
  ticker: string,
  limit = 5,
  companyName?: string | null,
): Promise<EvidenceEvent[]> {
  const upper = ticker.toUpperCase();
  const query = googleNewsQuery(upper, companyName);
  const googleUrl =
    `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const googleXml = await fetchRssXml(googleUrl);
  if (!googleXml) return [];
  return itemsToEvents(parseRssXml(googleXml), upper, limit, "Google News RSS");
}
