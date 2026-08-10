"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { StockQuote } from "@/lib/market/quotes";
import type { StockHistoryPoint } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { sparklineValuesFromQuote } from "@/lib/display/sparkline";
import { StockHeatmap } from "@/components/StockHeatmap";
import { TrendingManageChips } from "@/components/TrendingManageChips";
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

  const handleRemoveTrending = (ticker: string) => {
    const next = new Set(trackedTickers);
    next.delete(ticker);
    setTrackedTickers(next);
    fetch(`/api/watchlist/${ticker}`, { method: "DELETE" }).catch(() => {});
  };

  if (trendingStatus === "loading" || trendingStatus === "idle") {
    return (
      <div className="market-moves-panel">
        <PageLoadingMotion label="Finding active names" />
      </div>
    );
  }

  if (trending.length === 0) {
    return (
      <div className="market-moves-panel">
        <div className="empty-state">
          <p>No market moves loaded right now.</p>
          <small>Market activity is temporarily unavailable.</small>
          <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="market-moves-panel">
      {addMessage ? (
        <p className={`watchlist-message ${addMessage.type}`}>
          {addMessage.text}
        </p>
      ) : null}

      <StockHeatmap
        title="Market Moves"
        subtitle=""
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
            sparkline: sparklineValuesFromQuote({
              sparkline: idea.sparkline ?? idea.quote.sparkline,
              price: live.price ?? idea.quote.price,
              previousClose: idea.quote.previousClose,
            }),
          };
        })}
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
        onRemove={handleRemoveTrending}
      />
    </div>
  );
}
