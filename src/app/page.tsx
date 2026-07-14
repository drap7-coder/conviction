"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  cik?: string;
  addedAt: string;
  lastSyncedAt?: string;
  status: "active" | "unsupported" | "error";
  statusMessage?: string;
}

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  marketState: string | null;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlist(): WatchlistEntry[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((entry): entry is WatchlistEntry =>
      typeof entry?.ticker === "string" &&
      typeof entry?.companyName === "string" &&
      typeof entry?.addedAt === "string" &&
      ["active", "unsupported", "error"].includes(entry?.status),
    );
  } catch {
    return null;
  }
}

function writeBrowserWatchlist(entries: WatchlistEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Browser persistence is best-effort; server persistence still runs.
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

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [kvEnabled, setKvEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add company state
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Removal state
  const [removing, setRemoving] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    const browserEntries = readBrowserWatchlist();
    if (browserEntries) {
      setEntries(browserEntries);
      setLoading(false);
    }

    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();

      const serverEntries = data.entries ?? [];
      const nextEntries = data.kvEnabled || !browserEntries
        ? serverEntries
        : browserEntries;

      setEntries(nextEntries);
      writeBrowserWatchlist(nextEntries);
      setKvEnabled(data.kvEnabled ?? false);
    } catch {
      if (!browserEntries) {
        setError("Failed to load watchlist");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    if (entries.length === 0) return;
    let cancelled = false;

    async function loadQuotes() {
      try {
        const tickers = entries.map((entry) => entry.ticker).join(",");
        const response = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickers)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { quotes?: StockQuote[] };
        if (cancelled) return;
        const nextQuotes: Record<string, StockQuote> = {};
        for (const quote of data.quotes ?? []) {
          nextQuotes[quote.ticker] = quote;
        }
        setQuotes(nextQuotes);
      } catch {
        if (!cancelled) setQuotes({});
      }
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const handleAdd = async () => {
    const input = addInput.trim();
    if (!input) return;

    setAdding(true);
    setAddMessage(null);

    try {
      const res = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: input }),
      });

      const data = await res.json();

      if (!data.success) {
        setAddMessage({ type: "error", text: data.error || "Failed to add" });
      } else {
        setEntries(data.entries);
        writeBrowserWatchlist(data.entries);
        setAddInput("");

        if (data.initialSync?.skipped) {
          setAddMessage({ type: "info", text: data.initialSync.reason });
        } else if (data.initialSync?.failed) {
          setAddMessage({
            type: "error",
            text: `${data.added.ticker} added but initial sync failed: ${data.initialSync.errors?.join("; ")}`,
          });
        } else {
          const syncMsg = data.initialSync?.newTransactions > 0
            ? `Found ${data.initialSync.newTransactions} new transaction(s).`
            : "No new transactions found.";
          setAddMessage({ type: "success", text: `${data.added.companyName} (${data.added.ticker}) added. ${syncMsg}` });
        }

      }
    } catch {
      setAddMessage({ type: "error", text: "Network error — try again" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    const nextEntries = entries.filter((entry) => entry.ticker !== ticker);
    setEntries(nextEntries);
    writeBrowserWatchlist(nextEntries);

    try {
      const res = await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success && kvEnabled) {
        setEntries(data.entries);
        writeBrowserWatchlist(data.entries);
      }
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Institutional watchlist</h2>
        <div className="watchlist-meta">
          <span className="section-count">{entries.length} companies</span>
          {!kvEnabled && (
            <span className="storage-note" title="Saved in this browser when server storage is unavailable">
              Saved here
            </span>
          )}
        </div>
      </div>

      <div className="product-brief">
        <div>
          <span className="institutional-eyebrow">Conviction engine</span>
          <h2>Where sophisticated capital is building conviction.</h2>
        </div>
        <Link href="/rising" className="brief-link">
          View leaderboard →
        </Link>
      </div>

      <div className="watchlist-add">
        <div className="watchlist-input-wrap">
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="Add company (ticker or name)"
            disabled={adding}
            className="watchlist-input"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !addInput.trim()}
          className="watchlist-add-button"
        >
          {adding ? "Adding..." : "Track"}
        </button>
      </div>

      {addMessage && (
        <p className={`watchlist-message ${addMessage.type}`}>
          {addMessage.text}
        </p>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Loading watchlist...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>Your watchlist is empty.</p>
          <small>Add a ticker above to track institutional 13F changes.</small>
        </div>
      ) : (
        <div className="watchlist-scroll" aria-label="Tracked companies">
          <div className="company-grid">
            {entries.map((entry) => {
              const isLimited = entry.status !== "active";
              const quote = quotes[entry.ticker];
              const quoteDirection = quote?.change === null || quote?.change === undefined
                ? "neutral"
                : quote.change > 0
                  ? "positive"
                  : quote.change < 0
                    ? "negative"
                    : "neutral";
              const statusText = isLimited
                ? "Institutional 13F still available. Insider Form 4 may be limited."
                : "Open the company page for recent catalysts and manager changes.";

              return (
                <div key={entry.ticker} className="company-card-wrap">
                  <Link href={`/companies/${entry.ticker}`} className={`company-card ${isLimited ? "limited" : ""}`}>
                    <div className="card-header">
                      <div>
                        <span className="card-ticker">{entry.ticker}</span>
                        <span className="card-name">{entry.companyName}</span>
                      </div>
                      <span className="card-arrow" aria-hidden="true">→</span>
                    </div>

                    <div className="card-quote">
                      <span className="card-price">
                        {quote ? `$${formatPrice(quote.price)}` : "Loading quote"}
                      </span>
                      <span className={`card-quote-change ${quoteDirection}`}>
                        {quote ? formatChange(quote.change, quote.changePercent) : "Checking market"}
                      </span>
                    </div>

                    <div className={`card-change ${isLimited ? "limited" : ""}`}>
                      Institutional conviction
                    </div>

                    <div className="card-implication">
                      {statusText}
                    </div>

                    <div className="card-metrics">
                      <span className="metric">
                        <span className="metric-label">primary</span>
                        <span className="metric-value">
                          13F accumulation
                        </span>
                      </span>
                      <span className="metric">
                        <span className="metric-label">move</span>
                        <span className="metric-value">
                          catalyst check
                        </span>
                      </span>
                      {isLimited && (
                        <span className="metric">
                          <span className="metric-label">insiders</span>
                          <span className="metric-value warning">limited</span>
                        </span>
                      )}
                    </div>
                  </Link>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(entry.ticker);
                    }}
                    disabled={removing === entry.ticker}
                    title={`Remove ${entry.ticker}`}
                    className="remove-company"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="watchlist-footnote">
        Powered by SEC EDGAR Form 13F institutional data
      </p>
    </div>
  );
}
