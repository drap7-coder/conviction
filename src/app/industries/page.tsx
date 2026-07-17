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

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return null;
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2) + " (" + sign + percent.toFixed(2) + "%)";
}

export default function IndustriesPage() {
  const [sectors, setSectors] = useState<SectorCard[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

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
          <div className="terminal-grid">
            {sectors.map((sector) => {
              const quote = sector.quote;
              const quoteDirection = !quote || !quote.change
                ? "neutral"
                : quote.change > 0
                  ? "positive"
                  : "negative";
              const sparklinePath = buildSparklinePath(sector.sparkline);
              const changeText = formatChange(quote?.change ?? null, quote?.changePercent ?? null);

              return (
                <div key={sector.ticker} className="terminal-card-wrap group">
                  <Link
                    href={"/industries/" + sector.ticker}
                    className="terminal-card"
                  >
                    <div className="terminal-card-header">
                      <div className="terminal-card-header-left">
                        <LogoDisplay ticker={sector.ticker} size="card" />
                        <span className="terminal-card-ticker">{sector.ticker}</span>
                      </div>
                      <span className="terminal-card-price">
                        {quote?.price !== null && quote?.price !== undefined ? "$" + quote.price.toFixed(2) : "\u2014"}
                      </span>
                      <span className="terminal-card-conviction">
                        <span className="terminal-card-score">{sector.name}</span>
                      </span>
                    </div>

                    {sparklinePath ? (
                      <div className={"terminal-card-sparkline " + quoteDirection} aria-label={sector.ticker + " intraday chart"}>
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 240 42">
                          <path className="sparkline-glow" d={sparklinePath} />
                          <path className="sparkline-line" d={sparklinePath} />
                        </svg>
                      </div>
                    ) : (
                      <div className="terminal-card-sparkline terminal-card-sparkline-empty" />
                    )}

                    <div className="terminal-card-pills">
                      {changeText && (
                        <span className={"terminal-card-change " + (quoteDirection === "positive" ? "positive" : quoteDirection === "negative" ? "negative" : "")}>
                          {changeText}
                        </span>
                      )}
                    </div>

                    <div className="terminal-card-activity">
                      <span className="terminal-card-activity-muted">
                        {sector.representativeTickers.slice(0, 4).join(", ")}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}