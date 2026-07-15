"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCardVerdict } from "@/lib/evidence/card-verdict";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume?: number | null;
  dollarVolume?: number | null;
  currency: string | null;
  marketState: string | null;
}

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  activityRank: number;
  activityLabel: string;
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return "Quote unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} · ${sign}${percent.toFixed(2)}%`;
}

export default function RisingConvictionPage() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTrending() {
      setTrendingStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingCompany[] }>(
          "/api/market/trending?limit=8",
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          setTrending(data.companies ?? []);
          setTrendingStatus((data.companies ?? []).length > 0 ? "success" : "empty");
        }
      } catch (err) {
        console.warn("[rising] Failed to load trending companies:", err);
        if (!cancelled) setTrendingStatus(classifyClientError(err));
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Trending</h2>
        <span className="section-count">
          {trendingStatus === "loading" || trendingStatus === "idle" ? "..." : `${trending.length} ideas`}
        </span>
      </div>

      <div className="leaderboard-brief">
        <h1>Daily idea flow.</h1>
        <p>Active market names to inspect, then click into the evidence trail. Trending is discovery, not conviction by itself.</p>
      </div>

      <section className="trending-section" aria-label="Trending companies">
        {trendingStatus === "loading" || trendingStatus === "idle" ? (
          <div className="empty-state compact">
            <p>Finding active names...</p>
          </div>
        ) : trending.length === 0 ? (
          <div className="empty-state">
            <p>No trending ideas loaded right now.</p>
            <small>Market activity is temporarily unavailable.</small>
            <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : (
          <div className="watchlist-carousel trending-carousel">
            <div className="carousel-hint" aria-hidden="true">
              <span>Daily ideas</span>
              <strong>Scroll trending →</strong>
            </div>
            <div className="watchlist-scroll" aria-label="Trending companies carousel">
              <div className="company-grid">
                {trending.map((idea) => {
                  const quote = idea.quote;
                  const quoteDirection = quote.change === null || quote.change === undefined
                    ? "neutral"
                    : quote.change > 0
                      ? "positive"
                      : quote.change < 0
                      ? "negative"
                      : "neutral";
                  const verdict = getCardVerdict({
                    ticker: idea.ticker,
                    companyName: idea.companyName,
                    addedAt: new Date().toISOString(),
                    status: "active",
                  }, quote);

                  return (
                    <div key={idea.ticker} className="company-card-wrap">
                      <div className="company-card trending-card">
                        <div className="card-header">
                          <div>
                            <span className="card-rank">#{idea.activityRank} trending</span>
                            <span className="card-ticker">{idea.ticker}</span>
                            <span className="card-name">{idea.companyName}</span>
                          </div>
                          <span className="card-arrow" aria-hidden="true">→</span>
                        </div>

                        <div className="card-quote">
                          <span className="card-price">
                            ${formatPrice(quote.price)}
                          </span>
                          <span className={`card-quote-change ${quoteDirection}`}>
                            {formatChange(quote.change, quote.changePercent)}
                          </span>
                        </div>

                        <div className={`card-verdict ${verdict.tone}`}>
                          <div className="verdict-line">
                            <span>Conviction: {verdict.state}</span>
                            <strong>{verdict.strength}%</strong>
                          </div>
                          <div className="verdict-meter" aria-hidden="true">
                            <span style={{ width: `${verdict.strength}%` }} />
                          </div>
                          <div className="verdict-evidence">
                            {idea.activityLabel} · {verdict.support} support · {verdict.contra} contra
                          </div>
                        </div>

                        <div className="card-implication">
                          {verdict.insight}
                        </div>

                        <div className="card-recency">
                          <span>Market activity today</span>
                          <span>{verdict.source}</span>
                        </div>

                        <div className="card-actions">
                          <Link href={`/companies/${idea.ticker}`} className="card-action primary">
                            More detail
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
