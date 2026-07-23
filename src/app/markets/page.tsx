"use client";

import { useEffect, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface MarketQuote {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: StockHistoryPoint[];
  description: string;
}

interface MarketGroup {
  label: string;
  items: MarketQuote[];
}

function buildSparklinePath(points: StockHistoryPoint[]) {
  if (points.length < 2) return "";
  const width = 320;
  const height = 96;
  const padding = 6;
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;
  return points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - padding * 2);
      const y = padding + ((max - p.close) / spread) * (height - padding * 2);
      return (i === 0 ? "M" : "L") + " " + x.toFixed(2) + " " + y.toFixed(2);
    })
    .join(" ");
}

function compactCurrency(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000_000) {
    return "$" + (value / 1_000_000_000).toFixed(2) + "B";
  }
  if (Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(value) >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "K";
  }
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TICKERS: MarketGroup[] = [
  {
    label: "Major Indices",
    items: [
      { ticker: "SPY", name: "S&P 500", description: "Tracks 500 large-cap US stocks — the broad market benchmark.", price: null, change: null, changePercent: null, sparkline: [] },
      { ticker: "DIA", name: "Dow Jones", description: "Follows 30 blue-chip US industrial companies.", price: null, change: null, changePercent: null, sparkline: [] },
      { ticker: "QQQ", name: "Nasdaq 100", description: "Tracks 100 of the largest non-financial Nasdaq-listed companies.", price: null, change: null, changePercent: null, sparkline: [] },
      { ticker: "IWM", name: "Russell 2000", description: "Tracks ~2,000 small-cap US stocks — a domestic economic proxy.", price: null, change: null, changePercent: null, sparkline: [] },
    ],
  },
  {
    label: "Crypto",
    items: [
      { ticker: "BTC-USD", name: "Bitcoin", description: "The largest cryptocurrency by market cap — decentralized digital gold.", price: null, change: null, changePercent: null, sparkline: [] },
      { ticker: "ETH-USD", name: "Ethereum", description: "The second-largest crypto — smart contract platform for dApps and DeFi.", price: null, change: null, changePercent: null, sparkline: [] },
    ],
  },
  {
    label: "Commodities",
    items: [
      { ticker: "GLD", name: "Gold", description: "The largest gold-backed ETF — a traditional safe-haven asset.", price: null, change: null, changePercent: null, sparkline: [] },
      { ticker: "USO", name: "Crude Oil (WTI)", description: "Tracks near-month WTI crude oil futures — a key energy price gauge.", price: null, change: null, changePercent: null, sparkline: [] },
    ],
  },
  {
    label: "Rates",
    items: [
      { ticker: "^TNX", name: "10-Year Treasury Yield", description: "The yield on 10-year US government debt — a benchmark for borrowing costs.", price: null, change: null, changePercent: null, sparkline: [] },
    ],
  },
];

export default function MarketsPage() {
  const [groups, setGroups] = useState<MarketGroup[]>(TICKERS);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const allTickers = TICKERS.flatMap((g) => g.items.map((i) => i.ticker));
        const response = await fetch(
          `/api/market/quotes?tickers=${allTickers.join(",")}`,
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json() as { quotes?: Array<{ ticker: string; price: number | null; change: number | null; changePercent: number | null; sparkline: StockHistoryPoint[] }> };
        if (cancelled) return;

        if (data.quotes) {
          const quoteMap = new Map(data.quotes.map((q) => [q.ticker, q]));
          const next: MarketGroup[] = TICKERS.map((group) => ({
            ...group,
            items: group.items.map((item) => {
              const q = quoteMap.get(item.ticker);
              return {
                ...item,
                price: q?.price ?? null,
                change: q?.change ?? null,
                changePercent: q?.changePercent ?? null,
                sparkline: q?.sparkline ?? [],
              };
            }),
          }));
          setGroups(next);
          setStatus("success");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Markets</h2>
        <span className="section-count">
          {status === "success"
            ? groups.reduce((s, g) => s + g.items.length, 0) + " instruments"
            : "Today"}
        </span>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="empty-state compact">
          <p>Loading markets...</p>
        </div>
      ) : status === "error" ? (
        <div className="empty-state">
          <p>Market data is temporarily unavailable.</p>
          <small>Data provider may be rate-limited. Retry in a moment.</small>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="industries-section" aria-label={group.label}>
            <div className="section-header">
              <h3 className="section-title">{group.label}</h3>
            </div>
            <div className="watchlist-list">
              {group.items.map((item) => {
                const sparklinePath = buildSparklinePath(item.sparkline);
                return (
                  <div key={item.ticker} className="terminal-card-wrap group">
                    <div className="watchlist-row">
                      <div className="watchlist-row-main">
                        <div className="watchlist-row-company">
                          <LogoDisplay ticker={item.ticker} size="card" />
                          <div>
                            <strong className="watchlist-row-ticker">{item.ticker}</strong>
                            <span className="watchlist-row-name">{item.name}</span>
                          </div>
                        </div>
                        <div className="watchlist-row-move">
                          <span className="watchlist-row-period">Today</span>
                          <span className="watchlist-row-move-amounts">
                            <strong>
                              {item.change !== null ? (
                                <span className={"watchlist-row-arrow " + (item.change > 0 ? "up" : "down")}>
                                  {item.change > 0 ? "▲ " : "▼ "}
                                </span>
                              ) : null}
                              {item.price != null ? `$${item.price.toLocaleString(undefined, { maximumFractionDigits: item.price >= 100 ? 2 : 3, minimumFractionDigits: item.price >= 1 ? 2 : 3 })}` : "—"}
                            </strong>
                            <span className={"watchlist-row-change " + (item.change !== null && item.change > 0 ? "positive" : item.change !== null && item.change < 0 ? "negative" : "neutral")}>
                              {item.change != null && item.changePercent != null
                                ? `${item.change > 0 ? "+" : ""}$${Math.abs(item.change).toFixed(2)} · ${item.changePercent > 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`
                                : "—"}
                            </span>
                          </span>
                        </div>
                      </div>

                      {sparklinePath ? (
                        <div className={"watchlist-row-chart price-chart " + (item.change !== null && item.change > 0 ? "positive" : item.change !== null && item.change < 0 ? "negative" : "neutral")} aria-label={item.ticker + " intraday chart"}>
                          <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
                            <path className="price-chart-glow" d={sparklinePath} />
                            <path className="price-chart-line" d={sparklinePath} />
                          </svg>
                          <span>Today</span>
                        </div>
                      ) : null}
                      {item.description ? (
                        <section className="news-driver-brief news-driver-brief-compact" aria-label={`${item.ticker} description`}>
                          <div className="news-driver-heading">
                            <span className="news-driver-eyebrow">The story</span>
                            <span className="news-driver-horizon">Instrument overview</span>
                          </div>
                          <p className="news-driver-copy">{item.description}</p>
                        </section>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}