"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCardVerdict } from "@/lib/evidence/card-verdict";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { LogoDisplay } from "@/app/components/LogoDisplay";

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

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  sparkline?: StockHistoryPoint[];
  activityRank: number;
  activityLabel: string;
}

interface TrendingHeadline {
  headline: string;
  url: string | null;
  date: string;
}

interface WatchlistEntry {
  id?: string;
  ticker: string;
  companyName: string;
  cik?: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
  statusMessage?: string;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is WatchlistEntry =>
      typeof entry?.ticker === "string" &&
      typeof entry?.companyName === "string" &&
      typeof entry?.addedAt === "string" &&
      ["active", "unsupported", "error"].includes(entry?.status),
    );
  } catch {
    return [];
  }
}

function writeBrowserWatchlist(entries: WatchlistEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Browser persistence is best-effort.
  }
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
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export default function RisingConvictionPage() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [headlines, setHeadlines] = useState<Record<string, TrendingHeadline[]>>({});
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadWatchlist() {
      try {
        const data = await fetchJsonWithTimeout<{
          authenticated?: boolean;
          entries?: WatchlistEntry[];
          guestEntries?: WatchlistEntry[];
        }>("/api/watchlist", 8_000, controller.signal);
        if (cancelled) return;
        const entries = data.authenticated
          ? data.entries ?? []
          : data.guestEntries ?? data.entries ?? [];
        setTrackedTickers(new Set(entries.map((entry) => entry.ticker)));
      } catch {
        if (!cancelled) setTrackedTickers(new Set());
      }
    }

    void loadWatchlist();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTrending() {
      setTrendingStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingCompany[] }>(
          "/api/market/trending?limit=24",
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          const companies = data.companies ?? [];
          setTrending(companies);
          setTrendingStatus(companies.length > 0 ? "success" : "empty");

          const batches = Array.from(
            { length: Math.ceil(companies.length / 10) },
            (_, index) => companies.slice(index * 10, index * 10 + 10),
          );
          const responses = await Promise.all(batches.map((batch) =>
            fetchJsonWithTimeout<{
              news?: Record<string, { headlines?: TrendingHeadline[] }>;
            }>(
              `/api/evidence/news-batch?tickers=${batch.map((company) => company.ticker).join(",")}`,
              10_000,
              controller.signal,
            ).catch(() => ({ news: {} })),
          ));
          if (!cancelled) {
            const nextHeadlines: Record<string, TrendingHeadline[]> = {};
            for (const response of responses) {
              const news = response.news as Record<string, { headlines?: TrendingHeadline[] }> | undefined;
              for (const [ticker, item] of Object.entries(news ?? {})) {
                nextHeadlines[ticker] = item.headlines ?? [];
              }
            }
            setHeadlines(nextHeadlines);
          }
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

  const handleAddTrending = async (idea: TrendingCompany) => {
    setAddingTicker(idea.ticker);
    setAddMessage(null);

    try {
      const response = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: idea.ticker }),
      });
      const data = await response.json();

      if (!data.success) {
        setAddMessage({ type: "error", text: data.error || `Could not add ${idea.ticker}` });
        return;
      }

      setTrackedTickers((current) => new Set([...current, data.added?.ticker ?? idea.ticker]));
      if (data.persistence === "browser" && data.added) {
        const currentEntries = readBrowserWatchlist();
        const nextEntries = [
          ...currentEntries.filter((entry) => entry.ticker !== data.added.ticker),
          data.added as WatchlistEntry,
        ];
        writeBrowserWatchlist(nextEntries);
      }
      setAddMessage({ type: "success", text: `${idea.ticker} added to Watchlist.` });
    } catch {
      setAddMessage({ type: "error", text: `Could not add ${idea.ticker}.` });
    } finally {
      setAddingTicker(null);
    }
  };

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
      </div>

      {addMessage ? (
        <p className={`watchlist-message ${addMessage.type}`}>
          {addMessage.text}
        </p>
      ) : null}

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
          <div className="watchlist-list">
            {trending.map((idea) => {
              const isTracked = trackedTickers.has(idea.ticker);
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
                status: "active" as const,
              }, quote);
              const sparklinePath = buildSparklinePath(idea.sparkline ?? []);
              const ideaHeadlines = headlines[idea.ticker] ?? [];
              return (
                <div key={idea.ticker} className="terminal-card-wrap group">
                  <Link
                    href={`/companies/${idea.ticker}`}
                    className={"watchlist-row watchlist-row-" + verdict.tone}
                  >
                    <div className="watchlist-row-main">
                      <div className="watchlist-row-company">
                        <LogoDisplay ticker={idea.ticker} size="card" />
                        <div>
                          <strong className="watchlist-row-ticker">{idea.ticker}</strong>
                          <span className="watchlist-row-name">{idea.companyName}</span>
                        </div>
                      </div>
                      <div className="watchlist-row-move">
                        <span className="watchlist-row-period">Today</span>
                        <strong className={quoteDirection}>{quote.price != null ? `$${quote.price.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : "—"}</strong>
                        <span>
                          {quote.change != null && quote.changePercent != null
                            ? `${quote.change > 0 ? "+" : quote.change < 0 ? "-" : ""}$${Math.abs(quote.change).toFixed(2)} · ${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                            : "—"}
                        </span>
                      </div>
                      <span className={`watchlist-row-state watchlist-row-state-${verdict.tone}`}>#{idea.activityRank} Trending</span>
                    </div>

                    {sparklinePath ? (
                      <div className={"watchlist-row-chart price-chart " + quoteDirection} aria-label={`${idea.ticker} intraday chart`}>
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
                          <path className="price-chart-glow" d={sparklinePath} />
                          <path className="price-chart-line" d={sparklinePath} />
                        </svg>
                        <span>Today</span>
                      </div>
                    ) : null}

                    {ideaHeadlines.length > 0 ? (
                      <ol className="summary-headlines" aria-label={`${idea.ticker} recent headlines`}>
                        {ideaHeadlines.slice(0, 3).map((item) => (
                          <li key={`${item.date}-${item.headline}`}>{item.headline}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="watchlist-row-driver">Recent headlines unavailable.</p>
                    )}
                    <div className="watchlist-row-evidence">
                      <span className="watchlist-row-evidence-item"><b>Signal</b> · {verdict.state}</span>
                    </div>
                  </Link>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isTracked) handleAddTrending(idea);
                    }}
                    disabled={addingTicker === idea.ticker}
                    title={isTracked ? "Already tracked" : "Add " + idea.ticker}
                    className={"terminal-card-delete " + (isTracked ? "terminal-card-delete-added" : "")}
                    aria-label={isTracked ? idea.ticker + " is tracked" : "Add " + idea.ticker}
                  >
                    {isTracked ? "[✓]" : "[ADD]"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
