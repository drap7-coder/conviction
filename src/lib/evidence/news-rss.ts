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
      });
    }
  }

  return items;
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
  const suffix = /\s[-–—]\s([^–—-]{2,48})$/.exec(stripHtml(item.title));
  if (suffix?.[1]) return suffix[1].trim();
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
