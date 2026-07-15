"use client";

import { useEffect, useState } from "react";

interface TrackCompanyButtonProps {
  ticker: string;
  companyName: string;
}

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  cik?: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
  statusMessage?: string;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlist(): WatchlistEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBrowserWatchlist(entries: WatchlistEntry[]) {
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
}

export function TrackCompanyButton({ ticker, companyName }: TrackCompanyButtonProps) {
  const [tracked, setTracked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTracked(readBrowserWatchlist().some((entry) => entry.ticker === ticker));
  }, [ticker]);

  async function toggleTracked() {
    setBusy(true);
    setMessage(null);
    try {
      if (tracked) {
        const nextEntries = readBrowserWatchlist().filter((entry) => entry.ticker !== ticker);
        writeBrowserWatchlist(nextEntries);
        setTracked(false);
        setMessage("Removed from this browser.");
        return;
      }

      const response = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? "Could not track company");

      const nextEntry: WatchlistEntry = {
        ticker: data.added?.ticker ?? ticker,
        companyName: data.added?.companyName ?? companyName,
        cik: data.added?.cik,
        addedAt: new Date().toISOString(),
        status: data.added?.status ?? "active",
        statusMessage: data.added?.statusMessage,
      };
      const nextEntries = [
        ...readBrowserWatchlist().filter((entry) => entry.ticker !== nextEntry.ticker),
        nextEntry,
      ];
      writeBrowserWatchlist(nextEntries);
      setTracked(true);
      setMessage("Saved to this browser.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update watchlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="track-company-action">
      <button className="watchlist-add-button" disabled={busy} onClick={toggleTracked} type="button">
        {busy ? "Saving..." : tracked ? "Tracked" : "Track"}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
