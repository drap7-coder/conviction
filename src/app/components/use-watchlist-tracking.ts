"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

export interface WatchlistCandidate {
  ticker: string;
  companyName: string;
}

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
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
    // best-effort
  }
}

export function useWatchlistTracking() {
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [addingTicker, setAddingTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadWatchlist() {
      try {
        const data = await fetchJsonWithTimeout<{
          authenticated?: boolean;
          entries?: WatchlistEntry[];
          persistence?: string;
        }>("/api/watchlist", 8_000, controller.signal);
        if (cancelled) return;
        const entries = data.authenticated
          ? data.entries ?? []
          : readBrowserWatchlist();
        setTrackedTickers(new Set(entries.map((entry) => entry.ticker.toUpperCase())));
      } catch {
        if (!cancelled) {
          setTrackedTickers(new Set(readBrowserWatchlist().map((e) => e.ticker.toUpperCase())));
        }
      }
    }

    void loadWatchlist();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const addToWatchlist = useCallback(async (idea: WatchlistCandidate) => {
    setAddingTicker(idea.ticker);
    try {
      const response = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: idea.ticker }),
      });
      const data = await response.json();
      if (!data.success) return;
      setTrackedTickers((current) => new Set([...current, (data.added?.ticker ?? idea.ticker).toUpperCase()]));
      if (data.persistence === "browser" && data.added) {
        const currentEntries = readBrowserWatchlist();
        writeBrowserWatchlist([
          ...currentEntries.filter((entry) => entry.ticker !== data.added.ticker),
          data.added as WatchlistEntry,
        ]);
      }
    } finally {
      setAddingTicker(null);
    }
  }, []);

  return { trackedTickers, addingTicker, addToWatchlist };
}
