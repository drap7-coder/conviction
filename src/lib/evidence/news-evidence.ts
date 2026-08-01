import { getMoveEvent, type MoveEvent, type MoveEventCategory, type MoveEventConfidence } from "./move-events";
import { fetchGoogleNewsRss, fetchRssNews } from "./news-rss";
import { buildNewsDriver, type NewsDriver } from "./news-driver";
import { isCompanyRelevantHeadline } from "./today-catalyst";
import type { EvidenceDirection, EvidenceEvent } from "./types";

export type NewsEvidenceStatus = "success" | "empty" | "unsupported";

export interface NewsEvidenceSummary {
  ticker: string;
  status: NewsEvidenceStatus;
  events: EvidenceEvent[];
  driver: NewsDriver | null;
  fetchedAt: string;
  source: "curated-material-news" | "yahoo-finance-rss";
}

const MATERIAL_CATEGORIES = new Set<MoveEventCategory>([
  "earnings-warning",
  "earnings",
  "company-news",
]);

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function isSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function strengthFor(confidence: MoveEventConfidence, sourceCount: number) {
  const base = confidence === "high" ? 0.82 : confidence === "medium" ? 0.68 : 0.48;
  return Math.min(0.9, base + Math.min(0.06, sourceCount * 0.02));
}

function directionFor(category: MoveEventCategory): EvidenceDirection {
  if (category === "earnings-warning") return "negative";
  return "neutral";
}

function materialReason(event: MoveEvent) {
  if (event.category === "earnings-warning") {
    return "Sourced earnings warning directly challenges the current company evidence.";
  }
  if (event.category === "earnings") {
    return "Sourced earnings event may change the current company evidence.";
  }
  return "Sourced company-specific event appears material to current conviction.";
}

export function moveEventToNewsEvidence(event: MoveEvent): EvidenceEvent[] {
  const sources = event.sources.filter((source) => isSourceUrl(source.url));
  if (!MATERIAL_CATEGORIES.has(event.category)) return [];
  if (event.category === "no-clear-catalyst") return [];
  if (event.confidence === "low") return [];
  if (sources.length === 0) return [];

  const direction = directionFor(event.category);
  const leadSource = sources[0];
  const strength = strengthFor(event.confidence, sources.length);

  return [{
    id: `${event.ticker}-material-news-${event.date}`,
    ticker: event.ticker,
    type: "material-news",
    direction,
    title: event.headline,
    summary: event.answer,
    source: "publisher",
    sourceUrl: leadSource.url,
    date: event.date,
    disclosureDelay: 0,
    size: strength,
    strength,
    isContradiction: direction === "negative",
    aiExplanation: materialReason(event),
    metadata: {
      transactionClass: leadSource.label,
      transactionType: event.category,
    },
  }];
}

export async function getNewsEvidenceSummary(ticker: string, companyName?: string): Promise<NewsEvidenceSummary> {
  const upperTicker = normalizeTicker(ticker);
  if (!upperTicker) {
    return {
      ticker: upperTicker,
      status: "unsupported",
      events: [],
      driver: null,
      fetchedAt: new Date().toISOString(),
      source: "curated-material-news",
    };
  }

  // 1. Try curated move events first (authoritative, hand-curated)
  const curatedEvents = moveEventToNewsEvidence(getMoveEvent(upperTicker, companyName));
  if (curatedEvents.length > 0) {
    return {
      ticker: upperTicker,
      status: "success",
      events: curatedEvents,
      driver: buildNewsDriver(curatedEvents, upperTicker, companyName),
      fetchedAt: new Date().toISOString(),
      source: "curated-material-news",
    };
  }

  // 2. Live RSS — Yahoo first, then Google News when Yahoo is empty/off-topic
  try {
    const yahooEvents = await fetchRssNews(upperTicker, 10, companyName);
    let scoped = yahooEvents.filter((event) =>
      isCompanyRelevantHeadline(`${event.title} ${event.summary}`, upperTicker, companyName),
    );

    // Yahoo often returns a mixed “market” feed; search Google for on-topic headlines.
    if (scoped.length === 0) {
      const googleEvents = await fetchGoogleNewsRss(upperTicker, 10, companyName);
      scoped = googleEvents.filter((event) =>
        isCompanyRelevantHeadline(`${event.title} ${event.summary}`, upperTicker, companyName),
      );
    }

    if (scoped.length > 0) {
      return {
        ticker: upperTicker,
        status: "success",
        events: scoped,
        driver: buildNewsDriver(scoped, upperTicker, companyName),
        fetchedAt: new Date().toISOString(),
        source: "yahoo-finance-rss",
      };
    }
  } catch {
    // RSS fetch failed, fall through to empty
  }

  return {
    ticker: upperTicker,
    status: "empty",
    events: [],
    driver: null,
    fetchedAt: new Date().toISOString(),
    source: "yahoo-finance-rss",
  };
}
