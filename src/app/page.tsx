"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getCardVerdict, type CardVerdictShortInterest } from "@/lib/evidence/card-verdict";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

interface WatchlistEntry {
  id?: string;
  ticker: string;
  companyName: string;
  cik?: string;
  note?: string;
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

interface ConvictionTransition {
  id: string;
  ticker: string;
  type: "status_upgrade" | "new_signal_type" | "manager_breadth_increase" | "status_downgrade" | "signal_expired";
  previousStatus: string;
  currentStatus: string;
  reason: string;
  createdAt: string;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";
const WATCHLIST_MIGRATION_KEY = "conviction-watchlist-migrated";

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

function hasMigratedBrowserWatchlist() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(WATCHLIST_MIGRATION_KEY) === "1";
}

function markBrowserWatchlistMigrated() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCHLIST_MIGRATION_KEY, "1");
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
  const [shortInterest, setShortInterest] = useState<Record<string, CardVerdictShortInterest>>({});
  const [transitions, setTransitions] = useState<ConvictionTransition[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
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
      const data = await fetchJsonWithTimeout<{
        authenticated?: boolean;
        entries?: WatchlistEntry[];
        user?: { name?: string | null; email?: string | null };
        authConfigured?: boolean;
        persistence?: "browser" | "neon" | "unconfigured";
      }>("/api/watchlist", 8_000);

      const isAuthenticated = Boolean(data.authenticated);
      let nextEntries = isAuthenticated
        ? (data.entries ?? [])
        : (browserEntries ?? []);

      if (isAuthenticated && browserEntries?.length && !hasMigratedBrowserWatchlist()) {
        const migrateResponse = await fetch("/api/watchlist/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: browserEntries }),
        });
        if (migrateResponse.ok) {
          const migrated = await migrateResponse.json();
          nextEntries = migrated.entries ?? nextEntries;
          markBrowserWatchlistMigrated();
        }
      }

      setEntries(nextEntries);
      if (!isAuthenticated) writeBrowserWatchlist(nextEntries);
      setAuthenticated(isAuthenticated);
      setAuthConfigured(Boolean(data.authConfigured));
      setAccountLabel(data.user?.name ?? data.user?.email ?? null);
      setPersistence(data.persistence ?? (isAuthenticated ? "neon" : "browser"));
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
    let cancelled = false;

    async function loadTransitions() {
      try {
        const data = await fetchJsonWithTimeout<{ transitions?: ConvictionTransition[] }>(
          "/api/conviction/transitions",
          8_000,
        );
        if (!cancelled) setTransitions(data.transitions ?? []);
      } catch {
        if (!cancelled) setTransitions([]);
      }
    }

    void loadTransitions();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (entries.length === 0) return;
    let cancelled = false;

    async function loadShortInterest() {
      const nextShortInterest: Record<string, CardVerdictShortInterest> = {};
      await Promise.all(entries.map(async (entry) => {
        try {
          const response = await fetch(`/api/market/short-interest?ticker=${encodeURIComponent(entry.ticker)}`);
          if (!response.ok) return;
          nextShortInterest[entry.ticker] = await response.json() as CardVerdictShortInterest;
        } catch {
          // Short interest is optional evidence; don't block the card.
        }
      }));
      if (!cancelled) setShortInterest(nextShortInterest);
    }

    void loadShortInterest();
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
        const nextEntries = authenticated
          ? data.entries
          : [
              ...entries.filter((entry) => entry.ticker !== data.added.ticker),
              data.added,
            ];
        setEntries(nextEntries);
        if (!authenticated) writeBrowserWatchlist(nextEntries);
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
    if (!authenticated) {
      writeBrowserWatchlist(nextEntries);
      setRemoving(null);
      return;
    }

    try {
      const res = await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
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

  const handleNoteChange = (ticker: string, note: string) => {
    setEntries((current) =>
      current.map((entry) => entry.ticker === ticker ? { ...entry, note } : entry),
    );
  };

  const handleNoteBlur = async (ticker: string, note: string) => {
    if (!authenticated) return;

    try {
      const res = await fetch(`/api/watchlist/${ticker}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (data.success) setEntries(data.entries);
    } catch {
      setAddMessage({ type: "error", text: `Could not save ${ticker} note` });
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    const aVerdict = getCardVerdict(a, quotes[a.ticker], shortInterest[a.ticker]);
    const bVerdict = getCardVerdict(b, quotes[b.ticker], shortInterest[b.ticker]);
    return bVerdict.sortScore - aVerdict.sortScore || a.ticker.localeCompare(b.ticker);
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Conviction watchlist</h2>
        <div className="watchlist-meta">
          <span className="section-count">{entries.length} companies</span>
          <span className="storage-note" title={authenticated ? "Synced privately across devices" : "Saved in this browser only"}>
            {authenticated ? "Private sync" : "Saved here"}
          </span>
        </div>
      </div>

      <div className={`auth-strip ${entries.length > 0 ? "compact" : ""}`}>
        <div>
          <strong>{authenticated ? "Signed in" : "Guest mode"}</strong>
          <span>
            {authenticated
              ? `${accountLabel ?? "Your account"} · private tickers and notes`
              : "Browse freely. Sign in to save a private watchlist across devices."}
          </span>
        </div>
        {authenticated || authConfigured ? (
          <a className="auth-button" href={authenticated ? "/api/auth/signout" : "/api/auth/signin/github"}>
            {authenticated ? "Sign out" : "Sign in"}
          </a>
        ) : (
          <span className="auth-button disabled" aria-disabled="true">
            Sign in coming soon
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="product-brief">
          <div>
            <span className="institutional-eyebrow">Conviction engine</span>
            <h2>Where sophisticated capital is building conviction.</h2>
          </div>
          <Link href="/rising" className="brief-link">
            View leaderboard →
          </Link>
        </div>
      ) : null}

      {transitions.length > 0 ? (
        <section className="rising-strip" aria-label="Rising conviction">
          <div className="rising-strip-header">
            <div>
              <span className="institutional-eyebrow">Rising conviction</span>
              <h2>New evidence shifts</h2>
            </div>
            <Link href="/rising" className="brief-link">
              View board →
            </Link>
          </div>
          <div className="rising-strip-list">
            {transitions.slice(0, 3).map((transition) => (
              <Link href={`/companies/${transition.ticker}`} className={`rising-strip-card ${transition.type}`} key={transition.id}>
                <span>{transition.type.replace(/_/g, " ")}</span>
                <strong>{transition.ticker}: {transition.previousStatus} → {transition.currentStatus}</strong>
                <p>{transition.reason}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
          <small>Add a ticker above to track primary-source evidence.</small>
        </div>
      ) : (
        <div className="watchlist-carousel">
          <div className="carousel-hint" aria-hidden="true">
            <span>Saved companies</span>
            <strong>Scroll cards →</strong>
          </div>
          <div className="watchlist-scroll" aria-label="Tracked companies carousel">
            <div className="company-grid">
              {sortedEntries.map((entry) => {
              const isLimited = entry.status !== "active";
              const quote = quotes[entry.ticker];
              const quoteDirection = quote?.change === null || quote?.change === undefined
                ? "neutral"
                : quote.change > 0
                  ? "positive"
                  : quote.change < 0
                  ? "negative"
                  : "neutral";
              const verdict = getCardVerdict(entry, quote, shortInterest[entry.ticker]);

              return (
                <div key={entry.ticker} className="company-card-wrap">
                  <div className={`company-card card-tone-${verdict.tone} ${isLimited ? "limited" : ""}`}>
                    <div className="card-header">
                      <div>
                        <span className="card-ticker">{entry.ticker}</span>
                        <span className="card-name">{entry.companyName}</span>
                      </div>
                      <span className="card-arrow" aria-hidden="true">→</span>
                    </div>

                    <div className="card-quote">
                      <span className="card-price">
                        {quote ? `$${formatPrice(quote.price)}` : "Quote pending"}
                      </span>
                      <span className={`card-quote-change ${quoteDirection}`}>
                        {quote ? formatChange(quote.change, quote.changePercent) : "Market data loading"}
                      </span>
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
                        {verdict.support} support · {verdict.contra} contra
                      </div>
                    </div>

                    <div className="card-implication">
                      {verdict.insight}
                    </div>

                    <div className="card-recency">
                      <span>{verdict.recency}</span>
                      <span>{verdict.source}</span>
                    </div>

                    <div className="card-actions">
                      <Link href={`/companies/${entry.ticker}`} className="card-action primary">
                        More detail
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemove(entry.ticker);
                        }}
                        disabled={removing === entry.ticker}
                        title={`Remove ${entry.ticker}`}
                        className="card-action danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {authenticated ? (
                    <textarea
                      className="watchlist-note"
                      value={entry.note ?? ""}
                      onChange={(e) => handleNoteChange(entry.ticker, e.target.value)}
                      onBlur={(e) => handleNoteBlur(entry.ticker, e.target.value)}
                      placeholder={`Private note on ${entry.ticker}`}
                      rows={2}
                    />
                  ) : null}
                </div>
              );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="watchlist-footnote">
        Powered by SEC EDGAR primary-source filings
      </p>
    </div>
  );
}
