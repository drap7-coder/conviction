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
    return <p className="watchlist-row-driver">Story still forming.</p>;
  }

  return (
    <section className={`news-driver-brief ${compact ? "news-driver-brief-compact" : ""}`} aria-label={`${ticker} investment story`}>
      <div className="news-driver-heading">
        <span className="news-driver-eyebrow">The story</span>
        <span className="news-driver-horizon">Multi-week view</span>
      </div>
      {driver ? (
        <div className="news-driver-copy">
          <strong>{driver.label}</strong>
          {driver.explanation ? <p>{driver.explanation}</p> : null}
        </div>
      ) : null}
      {headlines.length > 0 ? (
        <ol className="news-driver-headlines" aria-label={`${ticker} latest developments`}>
          {headlines.slice(0, 3).map((item) => (
            <li key={`${item.date}-${item.headline}`}>{item.headline}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
