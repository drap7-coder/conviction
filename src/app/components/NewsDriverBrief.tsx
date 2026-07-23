import type { NewsDriver } from "@/lib/evidence/news-driver";

export interface NewsBriefHeadline {
  headline: string;
  url: string | null;
  date: string;
}

export function NewsDriverBrief({
  ticker,
  driver,
  headlines,
  compact = false,
}: {
  ticker: string;
  driver: NewsDriver | null;
  headlines: NewsBriefHeadline[];
  compact?: boolean;
}) {
  if (!driver && headlines.length === 0) {
    return <p className="watchlist-row-driver">No clear news catalyst found.</p>;
  }

  return (
    <section className={`news-driver-brief ${compact ? "news-driver-brief-compact" : ""}`} aria-label={`Why ${ticker} is moving`}>
      <div className="news-driver-heading">
        <span className="news-driver-eyebrow">Why it’s moving</span>
        {driver ? <span className={`news-driver-certainty news-driver-certainty-${driver.confidence}`}>{driver.confidence}</span> : null}
      </div>
      {driver ? (
        <div className="news-driver-copy">
          <strong>{driver.label}</strong>
          {driver.explanation ? <p>{driver.explanation}</p> : null}
        </div>
      ) : null}
      {headlines.length > 0 ? (
        <ol className="news-driver-headlines" aria-label={`${ticker} supporting headlines`}>
          {headlines.slice(0, 3).map((item) => (
            <li key={`${item.date}-${item.headline}`}>{item.headline}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
