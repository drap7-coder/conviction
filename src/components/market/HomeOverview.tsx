"use client";

import { useCallback, useEffect, useState } from "react";
import { PersonalDailyBrief } from "@/components/PersonalDailyBrief";
import { HomeMarketStrip } from "@/components/market/HomeMarketStrip";
import { PulseYourStocks } from "@/components/market/PulseYourStocks";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlistTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) =>
        typeof entry?.ticker === "string" ? entry.ticker.toUpperCase() : "",
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Home = for you today: personal brief → compact market strip → your names.
 * Full tape (Movers / Crypto / Intl) is /pulse — not a peer overview.
 */
export function HomeOverview() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState(false);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setWatchlistError(false);
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("watchlist unavailable");
      const payload = (await response.json()) as {
        authenticated?: boolean;
        entries?: Array<{ ticker: string }>;
      };
      const watched = payload.authenticated
        ? (payload.entries ?? []).map((entry) => entry.ticker.toUpperCase())
        : readBrowserWatchlistTickers();
      setTickers(watched);
    } catch {
      setTickers(readBrowserWatchlistTickers());
      setWatchlistError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  return (
    <div className="pulse-dashboard pulse-home home-overview">
      <PersonalDailyBrief
        tickers={tickers}
        loading={loading}
        watchlistError={watchlistError}
        onRetryWatchlist={() => void loadWatchlist()}
      />

      <HomeMarketStrip />

      <PulseYourStocks />
    </div>
  );
}
