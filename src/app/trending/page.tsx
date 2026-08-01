"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import type { WatchlistCardHeadline as TrendingHeadline } from "@/app/components/WatchlistCard";
import { getLivePrice } from "@/lib/market/live-quote";
import { StockHeatmap } from "@/components/StockHeatmap";
import { MoveDriversPanel } from "@/components/MoveDriversPanel";
import { TrendingManageChips } from "@/components/TrendingManageChips";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { InvestorMovesPanel } from "@/app/components/InvestorMovesPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";

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

interface WatchlistCandidate {
  ticker: string;
  companyName: string;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

const TRENDING_VIEWS = [
  {
    id: "market",
    label: "Market",
    description: "Where conviction is changing fastest in liquid names",
  },
  {
    id: "investors",
    label: "Institutions",
    description: "Tracked managers disclosing new or larger positions",
  },
  {
    id: "politicians",
    label: "Politicians",
    description: "Congressional disclosures ranked by freshness",
  },
] as const;

type TrendingView = (typeof TRENDING_VIEWS)[number]["id"];

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

export default function RisingConvictionPage() {
  const [activeView, setActiveView] = useState<TrendingView>("market");
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [headlines, setHeadlines] = useState<Record<string, TrendingHeadline[]>>({});
  const [newsDrivers, setNewsDrivers] = useState<Record<string, NewsDriver | null>>({});
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
    <div>
      <section className="market-regime-lede ink-panel" aria-label="Trending">
        <span className="market-regime-eyebrow">Trending</span>
        <strong className="market-regime-label">Where conviction is changing fastest</strong>
        <p className="market-regime-summary">
          Ranked by materiality and freshness — not by event count alone.
        </p>
      </section>

      <section className="pulse-view-picker" aria-label="Trending views">
        <div className="pulse-view-tabs" role="tablist" aria-label="Choose a Trending view">
          {TRENDING_VIEWS.map((view) => (
            <button
              key={view.id}
              id={`trending-tab-${view.id}`}
              type="button"
              role="tab"
              aria-label={`${view.label}: ${view.description}`}
              aria-selected={activeView === view.id}
              aria-controls={`trending-panel-${view.id}`}
              className={activeView === view.id ? "active" : ""}
              onClick={() => setActiveView(view.id)}
            >
              <strong>{view.label}</strong>
              <span>{view.description}</span>
            </button>
          ))}
        </div>
      </section>

      {addMessage ? (
        <p className={`watchlist-message ${addMessage.type}`}>
          {addMessage.text}
        </p>
      ) : null}

      <div
        id="trending-panel-market"
        role="tabpanel"
        aria-labelledby="trending-tab-market"
        hidden={activeView !== "market"}
      >
        {activeView === "market" && (trendingStatus === "loading" || trendingStatus === "idle") ? (
          <PageLoadingMotion label="Finding active names" />
        ) : null}

        {activeView === "market" && trendingStatus !== "loading" && trendingStatus !== "idle" && trending.length === 0 ? (
          <div className="empty-state">
            <p>No trending ideas loaded right now.</p>
            <small>Market activity is temporarily unavailable.</small>
            <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {activeView === "market" && trending.length > 0 ? (
          <>
            <StockHeatmap
              title="Trending"
              subtitle="Tap a tile for the company dashboard. Hover to see what’s driving the move. Tile size = dollar volume."
              sessionLabel={
                trending
                  .map((idea) => getLivePrice(idea.quote).label)
                  .find((label): label is string => Boolean(label)) ?? null
              }
              items={trending.map((idea) => {
                const live = getLivePrice(idea.quote);
                const driver = newsDrivers[idea.ticker]?.label ?? headlines[idea.ticker]?.[0]?.headline ?? null;
                return {
                  ticker: idea.ticker,
                  name: idea.companyName,
                  price: live.price,
                  changePercent: live.changePercent,
                  marketCap: idea.quote.marketCap,
                  sizeValue: idea.quote.dollarVolume,
                  sizeLabel: idea.activityLabel,
                  driverText: driver
                    ? `${driver}${idea.activityLabel ? ` · ${idea.activityLabel}` : ""}`
                    : idea.activityLabel,
                };
              })}
              footer={(
                <MoveDriversPanel
                  holdings={trending.map((idea) => {
                    const live = getLivePrice(idea.quote);
                    return {
                      ticker: idea.ticker,
                      companyName: idea.companyName,
                      changePercent: live.changePercent,
                    };
                  })}
                  newsByTicker={Object.fromEntries(
                    trending.map((idea) => [
                      idea.ticker.toUpperCase(),
                      {
                        driver: newsDrivers[idea.ticker] ?? null,
                        headlines: headlines[idea.ticker] ?? [],
                      },
                    ]),
                  )}
                  lede="Headlines and themes behind today’s most active names."
                />
              )}
            />
            <TrendingManageChips
              items={trending.map((idea) => ({
                ticker: idea.ticker,
                companyName: idea.companyName,
                activityLabel: idea.activityLabel,
              }))}
              trackedTickers={trackedTickers}
              addingTicker={addingTicker}
              onAdd={(item) => void handleAddTrending({
                ticker: item.ticker,
                companyName: item.companyName ?? item.ticker,
              })}
              onRemove={(ticker) => {
                const next = new Set(trackedTickers);
                next.delete(ticker);
                setTrackedTickers(next);
                fetch(`/api/watchlist/${ticker}`, { method: "DELETE" }).catch(() => {});
              }}
            />
          </>
        ) : null}
      </div>

      <div
        id="trending-panel-investors"
        role="tabpanel"
        aria-labelledby="trending-tab-investors"
        hidden={activeView !== "investors"}
      >
        <InvestorMovesPanel
          trackedTickers={trackedTickers}
          addingTicker={addingTicker}
          onAdd={handleAddTrending}
        />
      </div>

      <div
        id="trending-panel-politicians"
        role="tabpanel"
        aria-labelledby="trending-tab-politicians"
        hidden={activeView !== "politicians"}
      >
        {activeView === "politicians" ? <PoliticiansMovesPanel /> : null}
      </div>
    </div>
  );
}
