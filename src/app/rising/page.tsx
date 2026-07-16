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
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export default function RisingConvictionPage() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
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
        <p>Active market names to inspect, then click into the evidence trail. Trending is discovery, not conviction by itself.</p>
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
          <div className="trending-grid">
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
                status: "active",
              }, quote);
              const sparklinePath = buildSparklinePath(idea.sparkline ?? []);

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

                    <div className={`trending-sparkline ${quoteDirection}`} aria-label={`${idea.ticker} intraday micro chart`}>
                      {sparklinePath ? (
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 240 42">
                          <path className="sparkline-glow" d={sparklinePath} />
                          <path className="sparkline-line" d={sparklinePath} />
                        </svg>
                      ) : (
                        <span>Chart loading</span>
                      )}
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
                      {isTracked ? (
                        <span className="card-action muted">Added</span>
                      ) : (
                        <button
                          className="card-action add"
                          disabled={addingTicker === idea.ticker}
                          onClick={() => handleAddTrending(idea)}
                          type="button"
                        >
                          {addingTicker === idea.ticker ? "Adding..." : "Add"}
                        </button>
                      )}
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
