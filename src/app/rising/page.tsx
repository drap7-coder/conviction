"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCardVerdict, getCardEvidence, type CardVerdictEntry } from "@/lib/evidence/card-verdict";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import type { WatchlistCardEvidencePill, WatchlistCardActivityLine } from "@/app/components/WatchlistCard";

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

function buildEvidencePills(entry: CardVerdictEntry, quote?: StockQuote): WatchlistCardEvidencePill[] {
  const pills: WatchlistCardEvidencePill[] = [];
  const evidence = getCardEvidence(entry);

  for (const item of evidence) {
    if (item.provider === "SEC 13F") {
      pills.push({ type: "13F", direction: item.direction === "positive" ? "positive" : item.direction === "negative" ? "negative" : "neutral" });
    } else if (item.provider === "FINRA short interest") {
      pills.push({ type: "SI", direction: item.direction === "positive" ? "positive" : "negative" });
    }
  }

  return pills;
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
          <div className="terminal-grid">
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
              const evidencePills = buildEvidencePills({
                ticker: idea.ticker,
                companyName: idea.companyName,
                addedAt: new Date().toISOString(),
                status: "active" as const,
              }, quote);

              const changeText = quote.change !== null && quote.changePercent !== null
                ? (quote.change > 0 ? "+" : "") + quote.change.toFixed(2) + " (" + (quote.changePercent > 0 ? "+" : "") + quote.changePercent.toFixed(2) + "%)"
                : null;

              return (
                <div key={idea.ticker} className="terminal-card-wrap group">
                  <Link
                    href={`/companies/${idea.ticker}`}
                    className={"terminal-card terminal-card-" + verdict.tone}
                  >
                    <div className="terminal-card-header">
                      <div className="terminal-card-header-left">
                        <LogoDisplay ticker={idea.ticker} size="card" />
                        <span className="terminal-card-ticker">{idea.ticker}</span>
                      </div>
                      <span className="terminal-card-price">
                        {quote.price !== null ? "$" + quote.price.toLocaleString(undefined, {
                          maximumFractionDigits: quote.price >= 100 ? 2 : 3,
                          minimumFractionDigits: quote.price >= 1 ? 2 : 3,
                        }) : "\u2014"}
                      </span>
                      <div className="terminal-card-conviction">
                        <span className="terminal-card-score">{verdict.strength}</span>
                        <span className="terminal-card-state">/ {verdict.state}</span>
                      </div>
                    </div>

                    {sparklinePath ? (
                      <div className={"terminal-card-sparkline " + quoteDirection} aria-label={`${idea.ticker} intraday micro chart`}>
                        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 240 42">
                          <path className="sparkline-glow" d={sparklinePath} />
                          <path className="sparkline-line" d={sparklinePath} />
                        </svg>
                      </div>
                    ) : (
                      <div className="terminal-card-sparkline terminal-card-sparkline-empty" />
                    )}

                    <div className="terminal-card-pills">
                      {evidencePills.map((pill) => (
                        <span
                          key={pill.type}
                          className={"terminal-card-pill terminal-card-pill-" + pill.type.toLowerCase() + " terminal-card-pill-" + pill.direction}
                        >
                          {pill.type}
                        </span>
                      ))}
                      {changeText && (
                        <span className={"terminal-card-change " + (quoteDirection === "positive" ? "positive" : quoteDirection === "negative" ? "negative" : "")}>
                          {changeText}
                        </span>
                      )}
                    </div>

                    <div className="terminal-card-activity">
                      <span className="terminal-card-activity-muted">#{idea.activityRank} trending · {idea.activityLabel}</span>
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
                    {isTracked ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
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