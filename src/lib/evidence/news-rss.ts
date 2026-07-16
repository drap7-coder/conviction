// ── Lightweight RSS news fetcher ──
// Fetches Yahoo Finance RSS by ticker to provide real recent headlines.
// No API key required. Uses the Yahoo Finance RSS feed format.
// Falls back to empty gracefully on fetch/parse errors or unsupported tickers.

import type { EvidenceEvent } from "./types";

const YAHOO_RSS_BASE = "https://finance.yahoo.com/rss/headline";

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
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

    if (title && link) {
      items.push({ title, link, description: description ?? "", pubDate: pubDate ?? "" });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handles <tag>value</tag> and <tag><![CDATA[value]]></tag>
  const cdataRegex = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const plainRegex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function parseRssDate(dateStr: string): string {
  // Yahoo RSS format: "Fri, 10 Jul 2026 14:30:00 +0000"
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}

const TITLE_DEDUP = new Set<string>();
setInterval(() => { TITLE_DEDUP.clear(); }, 300_000); // reset every 5 min

/**
 * Fetch recent RSS headlines for a ticker from Yahoo Finance.
 * Returns up to `limit` items, deduplicated by title within a 5-min window.
 */
export async function fetchRssNews(ticker: string, limit = 5): Promise<EvidenceEvent[]> {
  const url = `${YAHOO_RSS_BASE}?s=${encodeURIComponent(ticker.toUpperCase())}`;

  let text: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Conviction/1.0 (research tool; nathandrapkin@gmail.com)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    text = await response.text();
  } catch {
    return [];
  }

  const items = parseRssXml(text);
  if (items.length === 0) return [];

  const events: EvidenceEvent[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (events.length >= limit) break;

    const dedupKey = item.title.toLowerCase().slice(0, 80);
    if (seen.has(dedupKey) || TITLE_DEDUP.has(dedupKey)) continue;
    seen.add(dedupKey);
    TITLE_DEDUP.add(dedupKey);

    const date = parseRssDate(item.pubDate);
    const description = stripHtml(item.description).slice(0, 300);

    events.push({
      id: `rss-${ticker}-${date}-${events.length}`,
      ticker: ticker.toUpperCase(),
      type: "material-news",
      direction: "neutral",
      title: item.title.slice(0, 200),
      summary: description || "No summary available.",
      source: "publisher",
      sourceUrl: item.link,
      date,
      disclosureDelay: 0,
      size: 0.5,
      strength: 0.5,
      isContradiction: false,
      aiExplanation: "Sourced RSS headline from Yahoo Finance.",
      metadata: {
        transactionClass: "Yahoo Finance RSS",
      },
    });
  }

  return events;
}