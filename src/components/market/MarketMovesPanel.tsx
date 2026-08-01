"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { TrendingCard } from "@/components/TrendingCard";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import type { WatchlistCardHeadline as TrendingHeadline } from "@/app/components/WatchlistCard";
import type { CardVerdictShortInterest } from "@/lib/evidence/card-verdict";
import { fetchConvictionScores } from "@/app/components/fetch-conviction-score";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import { getLivePrice } from "@/lib/market/live-quote";
import { StockHeatmap } from "@/components/StockHeatmap";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";

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
  ticker: string;
  companyName: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
}

interface WatchlistCandidate {
  ticker: string;
  companyName: string;
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

export function MarketMovesPanel() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [headlines, setHeadlines] = useState<Record<string, TrendingHeadline[]>>({});
  const [newsDrivers, setNewsDrivers] = useState<Record<string, NewsDriver | null>>({});
  const [shortInterest, setShortInterest] = useState<Record<string, CardVerdictShortInterest>>({});
  const [convictionScores, setConvictionScores] = useState<Record<string, ConvictionScoreView>>({});
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
              news?: Record<string, { headlines?: TrendingHeadline[]; driver?: NewsDriver | null }>;
            }>(
              `/api/evidence/news-batch?tickers=${batch.map((company) => company.ticker).join(",")}`,
              10_000,
              controller.signal,
            ).catch(() => ({ news: {} })),
          ));
          if (!cancelled) {
            const nextHeadlines: Record<string, TrendingHeadline[]> = {};
            const nextDrivers: Record<string, NewsDriver | null> = {};
            for (const response of responses) {
              const news = response.news as Record<string, { headlines?: TrendingHeadline[]; driver?: NewsDriver | null }> | undefined;
              for (const [ticker, item] of Object.entries(news ?? {})) {
                nextHeadlines[ticker] = item.headlines ?? [];
                nextDrivers[ticker] = item.driver ?? null;
              }
            }
            setHeadlines(nextHeadlines);
            setNewsDrivers(nextDrivers);
          }
        }
      } catch (err) {
        console.warn("[market-moves] Failed to load trending companies:", err);
        if (!cancelled) setTrendingStatus(classifyClientError(err));
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  useEffect(() => {
    if (trending.length === 0) return;
    let cancelled = false;

    async function loadShortInterest() {
      const next: Record<string, CardVerdictShortInterest> = {};
      await Promise.all(trending.map(async (company) => {
        try {
          const response = await fetch(
            `/api/market/short-interest?ticker=${encodeURIComponent(company.ticker)}`,
          );
          if (!response.ok) return;
          next[company.ticker] = await response.json() as CardVerdictShortInterest;
        } catch {
          // Optional evidence for the shared card score.
        }
      }));
      if (!cancelled) setShortInterest(next);
    }

    void loadShortInterest();
    return () => {
      cancelled = true;
    };
  }, [trending]);

  useEffect(() => {
    if (trending.length === 0) {
      setConvictionScores({});
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadConvictionScores() {
      const scores = await fetchConvictionScores(
        trending.map((company) => company.ticker),
        controller.signal,
      );
      if (!cancelled) setConvictionScores(scores);
    }

    void loadConvictionScores();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trending]);

  const handleAddTrending = async (idea: WatchlistCandidate) => {
    setAddMessage(null);
    setAddingTicker(idea.ticker);

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
    <div className="market-moves-panel">
      {addMessage ? (
        <p className={`watchlist-message ${addMessage.type}`}>
          {addMessage.text}
        </p>
      ) : null}

      {trendingStatus === "success" && trending.length > 0 ? (
        <StockHeatmap
          title="Market Moves"
          subtitle="Tile size = dollar volume. Color = session move only (teal up / red down) — not the Accumulating / Holding / Distribution rings below."
          sessionLabel={
            trending
              .map((idea) => getLivePrice(idea.quote).label)
              .find((label): label is string => Boolean(label)) ?? null
          }
          items={trending.map((idea) => {
            const live = getLivePrice(idea.quote);
            return {
              ticker: idea.ticker,
              name: idea.companyName,
              price: live.price,
              changePercent: live.changePercent,
              marketCap: idea.quote.marketCap,
              sizeValue: idea.quote.dollarVolume,
              sizeLabel: idea.activityLabel,
            };
          })}
        />
      ) : null}

      <section className="trending-section" aria-label="Market moves">
        {trendingStatus === "loading" || trendingStatus === "idle" ? (
          <PageLoadingMotion label="Finding active names" />
        ) : trending.length === 0 ? (
          <div className="empty-state">
            <p>No market moves loaded right now.</p>
            <small>Market activity is temporarily unavailable.</small>
            <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="wl-list-header">
              <div className="wl-list-title-row">
                <h3 className="wl-list-title">Market Moves</h3>
                <span className="wl-list-count">
                  {trending.length} symbol{trending.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="wl-conviction-legend" aria-label="Conviction ring legend">
                <span><i className="quote-dot red" /> Distribution</span>
                <span><i className="quote-dot amber" /> Holding</span>
                <span><i className="quote-dot green" /> Accumulating</span>
              </div>
              <p className="wl-list-legend-note">
                Ring colors are conviction state. Heat tiles above are session up/down only.
              </p>
            </div>
            <div className="watchlist-list">
              {trending.map((idea) => {
                const isTracked = trackedTickers.has(idea.ticker);
                return (
                  <TrendingCard
                    key={idea.ticker}
                    ticker={idea.ticker}
                    companyName={idea.companyName}
                    rank={idea.activityRank}
                    activityLabel={idea.activityLabel}
                    quote={idea.quote}
                    sparkline={idea.sparkline ?? []}
                    headlines={headlines[idea.ticker] ?? []}
                    newsDriver={newsDrivers[idea.ticker] ?? null}
                    convictionScore={convictionScores[idea.ticker] ?? null}
                    isTracked={isTracked}
                    isAdding={addingTicker === idea.ticker}
                    onAdd={() => handleAddTrending(idea)}
                    onRemove={() => {
                      const next = new Set(trackedTickers);
                      next.delete(idea.ticker);
                      setTrackedTickers(next);
                      fetch(`/api/watchlist/${idea.ticker}`, { method: "DELETE" }).catch(() => {});
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
