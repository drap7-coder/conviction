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
  const width = 320;
  const height = 96;
  const padding = 6;
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
        <h2 className="section-title">S&amp;P Sector Overview</h2>
        <span className="section-count">{status === "success" ? sectors.length + " sectors" : "S&P 500"}</span>
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
          <div className="watchlist-list">
            {sectors.map((sector) => {
              const quote = sector.quote;
              const qChange: number | null = quote?.change ?? null;
              const qChangePct: number | null = quote?.changePercent ?? null;
              const quoteDirection = !qChange
                ? "neutral"
                : qChange > 0
                  ? "positive"
                  : "negative";
              const sparklinePath = buildSparklinePath(sector.sparkline);
              return (
                <div key={sector.ticker} className="terminal-card-wrap group">
                  <Link
                    href={"/industries/" + sector.ticker}
                    className="watchlist-row"
                  >
                    <div className="watchlist-row-main">
                      <div className="watchlist-row-company">
                        <LogoDisplay ticker={sector.ticker} size="card" />
                        <div>
                          <strong className="watchlist-row-ticker">{sector.ticker}</strong>
                          <span className="watchlist-row-name">{sector.name}</span>
                        </div>
                      </div>
                      <div className="watchlist-row-move">
                        <span className="watchlist-row-period">Today</span>
                        <span className="watchlist-row-move-amounts">
                          <strong>
                            {qChange !== null && qChange !== undefined ? (
                              <span className={"watchlist-row-arrow " + (qChange > 0 ? "up" : "down")}>
                                {qChange > 0 ? "▲ " : "▼ "}
                              </span>
                            ) : null}
                            {quote?.price != null ? `$${quote.price.toLocaleString(undefined, { maximumFractionDigits: quote.price >= 100 ? 2 : 3, minimumFractionDigits: quote.price >= 1 ? 2 : 3 })}` : "—"}
                          </strong>
                          <span className={"watchlist-row-change " + (qChange !== null && qChange > 0 ? "positive" : qChange !== null && qChange < 0 ? "negative" : "neutral")}>
                            {qChange != null && qChangePct != null
                              ? `${qChange > 0 ? "+" : ""}$${Math.abs(qChange).toFixed(2)} · ${qChangePct > 0 ? "+" : ""}${qChangePct.toFixed(2)}%`
                              : "—"}
                          </span>
                        </span>
                      </div>
                      <span className="watchlist-row-state watchlist-row-state-quiet">Sector ETF</span>
                    </div>

                    {sparklinePath ? (
                      <div className={"watchlist-row-chart price-chart " + quoteDirection} aria-label={sector.ticker + " intraday chart"}>
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
                          <path className="price-chart-glow" d={sparklinePath} />
                          <path className="price-chart-line" d={sparklinePath} />
                        </svg>
                        <span>Today</span>
                      </div>
                    ) : null}

                    {sector.description ? (
                      <section className="news-driver-brief news-driver-brief-compact" aria-label={`${sector.ticker} sector story`}>
                        <div className="news-driver-heading">
                          <span className="news-driver-eyebrow">The story</span>
                          <span className="news-driver-horizon">Sector overview</span>
                        </div>
                        <p className="news-driver-copy">{sector.description}</p>
                      </section>
                    ) : null}

                    <div className="watchlist-row-evidence">
                      <span className="watchlist-row-evidence-item"><b>Leaders</b> · {sector.representativeTickers.slice(0, 4).join(", ")}</span>
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
