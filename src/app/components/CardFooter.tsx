"use client";

import Link from "next/link";

interface CardFooterNews {
  headline: string | null;
  url: string | null;
  date: string | null;
}

interface CardFooterProps {
  ticker: string;
  /** Recency text from verdict (e.g. "3 days ago") */
  recency: string;
  /** Source label from verdict (e.g. "SEC 13F") */
  source: string;
  /** Insight text from verdict (e.g. "Tiger Global initiated position") */
  insight: string;
  /** Batch news result for this ticker (may be null/empty) */
  news?: CardFooterNews | null;
}

/**
 * Signal hierarchy footer:
 * 1. Material evidence (insight from verdict) → link to company page
 * 2. Yahoo Finance headline (if valid, recent) → external link
 * 3. Metadata fallback → plain text "[recency] · [source]"
 *
 * Occupies exactly one line. Truncates gracefully.
 */
export function CardFooter({ ticker, recency, source, insight, news }: CardFooterProps) {
  // Priority 1: Material evidence signal
  const hasEvidence = insight && !insight.startsWith("No high-conviction") && !insight.startsWith("SEC coverage is limited");
  if (hasEvidence) {
    return (
      <div className="card-recency">
        <Link
          href={`/companies/${ticker}`}
          className="card-footer-link"
          onClick={(e) => e.stopPropagation()}
          title={insight}
        >
          <span className="card-footer-evidence">{recency} — {insight}</span>
        </Link>
      </div>
    );
  }

  // Priority 2: Yahoo Finance headline
  if (news?.headline && news?.url) {
    return (
      <div className="card-recency">
        <a
          href={news.url}
          target="_blank"
          rel="noreferrer"
          className="card-footer-link"
          onClick={(e) => e.stopPropagation()}
          title={news.headline}
        >
          <span className="card-footer-news">{news.headline}</span>
        </a>
      </div>
    );
  }

  // Priority 3: Metadata fallback
  return (
    <div className="card-recency">
      <span className="card-footer-meta">{recency} · {source}</span>
    </div>
  );
}