import {
  buildWatchlistBriefItems,
  type WatchlistBriefItem,
  type WatchlistNewsHeadline,
  type WatchlistNewsSummary,
  type WatchlistTransition,
} from "@/components/WatchlistDailyBrief";
import type { StockQuote } from "@/lib/market/types";
import type { WatchlistEntry } from "@/lib/watchlist/types";

export interface CompanyEvidenceHeadline {
  headline: string;
  url: string | null;
  date: string;
}

export interface CompanyEvidenceSignal {
  eyebrow: WatchlistBriefItem["kind"];
  conclusion: string;
  conclusionHref: string | null;
  evidence: string;
  whyItMatters: string;
  badge: { label: string; tone: string };
  source: string;
  dateLabel: string | null;
  extraHeadlines: CompanyEvidenceHeadline[];
}

export function newsSummaryFromEvents(
  events: Array<{
    title: string;
    sourceUrl?: string | null;
    date: string;
    metadata?: { publisher?: string };
  }>,
  driver: WatchlistNewsSummary["driver"],
): WatchlistNewsSummary {
  const headlines: WatchlistNewsHeadline[] = events.slice(0, 6).map((event) => ({
    headline: event.title,
    url: event.sourceUrl ?? null,
    date: event.date,
    publisher: event.metadata?.publisher ?? null,
  }));
  const lead = headlines[0];
  return {
    headline: lead?.headline ?? null,
    url: lead?.url ?? null,
    date: lead?.date ?? null,
    publisher: lead?.publisher,
    driver,
    headlines,
  };
}

export function buildCompanyEvidenceItem({
  ticker,
  companyName,
  quote,
  news,
  transitions,
  now,
}: {
  ticker: string;
  companyName: string;
  quote: StockQuote | null;
  news: WatchlistNewsSummary | null;
  transitions: WatchlistTransition[];
  now?: Date;
}): WatchlistBriefItem | null {
  const upper = ticker.toUpperCase();
  const entry: WatchlistEntry = {
    ticker: upper,
    companyName,
    addedAt: "",
    status: "active",
  };
  const items = buildWatchlistBriefItems({
    entries: [entry],
    quotes: quote ? { [upper]: quote } : {},
    newsByTicker: news ? { [upper]: news } : {},
    transitions,
    now,
  });
  return items[0] ?? null;
}

export function formatCompanyEvidenceDate(value: string | null): string | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  const parsed = iso ? new Date(`${iso}T12:00:00`) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function proofBadge(item: WatchlistBriefItem): CompanyEvidenceSignal["badge"] {
  if (item.proofStatus === "Price only") {
    return { label: item.proofStatus, tone: "amber" };
  }
  if (item.tone === "up") return { label: item.proofStatus, tone: "up" };
  if (item.tone === "down") return { label: item.proofStatus, tone: "down" };
  return { label: item.proofStatus, tone: "quiet" };
}

function sameHeadline(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function companyEvidenceSignal(
  item: WatchlistBriefItem,
  news: WatchlistNewsSummary | null,
): CompanyEvidenceSignal {
  const headlines = news?.headlines ?? [];
  const matching = headlines.find((headline) => sameHeadline(headline.headline, item.headline));
  const conclusionHref = matching?.url
    ?? (news?.headline && sameHeadline(news.headline, item.headline) ? news.url : null);

  return {
    eyebrow: item.kind,
    conclusion: item.headline,
    conclusionHref,
    evidence: item.why,
    whyItMatters: item.watchNext,
    badge: proofBadge(item),
    source: item.sourceLabel,
    dateLabel: formatCompanyEvidenceDate(item.occurredAt),
    extraHeadlines: headlines
      .filter((headline) => !sameHeadline(headline.headline, item.headline))
      .slice(0, 2),
  };
}
