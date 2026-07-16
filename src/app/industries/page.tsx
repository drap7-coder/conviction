"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { LogoDisplay } from "@/app/components/LogoDisplay";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface SectorCard {
  ticker: string;
  name: string;
  description: string;
  representativeTickers: string[];
  quote: { price: number | null; change: number | null; changePercent: number | null } | null;
  sparkline: StockHistoryPoint[];
  representativeQuotes: Array<{
    ticker: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
  }>;
}

interface IndustriesResponse {
  sectors: SectorCard[];
  fetchedAt: string;
}

function formatPrice(value: number | null) {
  if (value === null) return "\u2014";
  return "$" + value.toFixed(value >= 100 ? 2 : 2);
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return "";
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2) + " \u00b7 " + sign + percent.toFixed(2) + "%";
}

function buildSparklinePath(points: StockHistoryPoint[]) {
  if (points.length < 2) return "";
  const width = 240;
  const height = 42;
  const padding = 3;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + ((max - point.close) / spread) * (height - padding * 2);
    return (index === 0 ? "M" : "L") + " " + x.toFixed(2) + " " + y.toFixed(2);
  }).join(" ");
}

export default function IndustriesPage() {
  const [sectors, setSectors] = useState<SectorCard[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [batchNews, setBatchNews] = useState<Record<string, { headline: string | null; url: string | null }>>({});

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<IndustriesResponse>(
          "/api/market/industries",
          15_000,
          controller.signal,
        );
        if (!cancelled) {
          setSectors(data.sectors);
          setStatus(data.sectors.length > 0 ? "success" : "empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Fetch batch news for sector tickers
  useEffect(() => {
    if (sectors.length === 0) return;
    let cancelled = false;

    async function loadNews() {
      const tickers = sectors.map((s) => s.ticker).join(",");
      try {
        const res = await fetch("/api/evidence/news-batch?tickers=" + encodeURIComponent(tickers));
        if (!res.ok) return;
        const data = await res.json() as { news: Record<string, { headline: string | null; url: string | null; date: string | null }> };
        if (!cancelled) {
          const newsMap: Record<string, { headline: string | null; url: string | null }> = {};
          for (const [t, n] of Object.entries(data.news)) {
            newsMap[t] = { headline: n?.headline ?? null, url: n?.url ?? null };
          }
          setBatchNews(newsMap);
        }
      } catch {
        // silent degradation
      }
    }

    void loadNews();
    return () => { cancelled = true; };
  }, [sectors]);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Industries</h2>
        <span className="section-count">{status === "success" ? sectors.length + " sectors" : "S&P 500"}</span>
      </div>

      <div className="leaderboard-brief">
        <h1>S&P sector overview.</h1>
        <p>Real-time quotes and intraday sparklines for every major sector.</p>
      </div>

      <section className="industries-section" aria-label="S&P industry sectors">
        {status === "loading" || status === "idle" ? (
          <div className="empty-state compact">
            <p>Loading sectors...</p>
          </div>
        ) : status === "error" || sectors.length === 0 ? (
          <div className="empty-state">
            <p>Sector data is temporarily unavailable.</p>
            <small>Market data provider may be rate-limited. Retry in a moment.</small>
          </div>
        ) : (
          <div className="industries-grid">
            {sectors.map((sector) => {
              const quote = sector.quote;
              const quoteDirection = !quote || !quote.change
                ? "neutral"
                : quote.change > 0
                  ? "positive"
                  : "negative";
              const sparklinePath = buildSparklinePath(sector.sparkline);
              const isPositive = quoteDirection === "positive";

              return (
                <div
                  key={sector.ticker}
                  className="industry-card-link"
                  onClick={() => { window.location.href = "/industries/" + sector.ticker; }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") window.location.href = "/industries/" + sector.ticker; }}
                >
                <div className="industry-card">
                  <div className="card-header">
                    <div className="card-header-left">
                      <LogoDisplay ticker={sector.ticker} size="card" />
                      <div>
                        <span className="card-ticker">{sector.ticker}</span>
                        <span className="card-name">{sector.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-quote">
                    <span className="card-price">
                      {quote ? formatPrice(quote.price) : "Quote pending"}
                    </span>
                    <span className={"card-quote-change " + quoteDirection}>
                      {quote ? formatChange(quote.change, quote.changePercent) : "Loading"}
                    </span>
                  </div>

                  <div
                    className={"trending-sparkline " + (isPositive ? "positive" : "negative")}
                    aria-label={sector.ticker + " intraday chart"}
                  >
                    {sparklinePath ? (
                      <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 240 42">
                        <path className="sparkline-glow" d={sparklinePath} />
                        <path className="sparkline-line" d={sparklinePath} />
                      </svg>
                    ) : (
                      <span>Chart loading</span>
                    )}
                  </div>

                  <p className="industry-description">{sector.description}</p>

                  <div className="industry-news-footer">
                    {batchNews[sector.ticker]?.headline ? (
                      <a
                        href={batchNews[sector.ticker].url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="industry-news-link"
                        title={batchNews[sector.ticker].headline ?? undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {batchNews[sector.ticker].headline}
                      </a>
                    ) : (
                      <span className="industry-news-empty">{sector.ticker} — sector ETF</span>
                    )}
                  </div>

                  <div className="industry-reps">
                    <span className="industry-reps-label">Representative</span>
                    <div className="industry-rep-tickers">
                      {sector.representativeQuotes.map((rq) => {
                        const rqDirection = !rq.change
                          ? "neutral"
                          : rq.change > 0
                            ? "positive"
                            : "negative";
                        return (
                          <Link
                            key={rq.ticker}
                            href={"/companies/" + rq.ticker}
                            className={"industry-rep-chip " + rqDirection}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rq.ticker}
                            <span className="industry-rep-change">
                              {rq.changePercent !== null
                                ? (rq.changePercent > 0 ? "+" : "") + rq.changePercent.toFixed(1) + "%"
                                : "\u2014"}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}