"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import type { StockQuote } from "@/lib/market/types";
import { getLivePrice } from "@/lib/market/live-quote";
import { sparklineValuesFromQuote } from "@/lib/display/sparkline";
import { shortenCompanyName } from "@/lib/display/company-name";
import { CompanyTypeahead } from "@/components/CompanyTypeahead";
import { StockHeatmap } from "@/components/StockHeatmap";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";

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

export default function Watchlist({
  children,
  mode = "view",
}: {
  children?: ReactNode;
  mode?: "view" | "manage";
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add company state
  const [addInput, setAddInput] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Removal state
  const [removing, setRemoving] = useState<string | null>(null);

  // Search state
  const [searchResult, setSearchResult] = useState<{ type: "navigate" | "filter" | "unrecognized"; text: string } | null>(null);

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
        guestEntries?: WatchlistEntry[];
        persistence?: "browser" | "neon" | "unconfigured";
      }>("/api/watchlist", 8_000);

      const isAuthenticated = Boolean(data.authenticated);
      let nextEntries = isAuthenticated
        ? (data.entries ?? [])
        : (browserEntries ?? data.guestEntries ?? data.entries ?? []);

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
  }, []);

  useEffect(() => {
    if (mode === "manage") {
      setQuotes({});
      return;
    }
    if (entries.length === 0) {
      setQuotes({});
      return;
    }
    let cancelled = false;

    async function loadQuotes() {
      try {
        const tickers = entries.map((entry) => entry.ticker).join(",");
        const response = await fetch(
          `/api/market/quotes?tickers=${encodeURIComponent(tickers)}`,
          { cache: "no-store" },
        );
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
    const refreshInterval = window.setInterval(() => {
      void loadQuotes();
    }, 60_000);

    function refreshVisibleDashboard() {
      if (document.visibilityState === "visible") void loadQuotes();
    }

    document.addEventListener("visibilitychange", refreshVisibleDashboard);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
    };
  }, [entries, mode]);

  const handleAddValue = async (value?: string) => {
    const input = (value ?? addInput).trim();
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
        if (!value) setAddInput("");

        if (data.initialSync?.skipped) {
          setAddMessage({ type: "info", text: data.initialSync.reason });
        } else if (data.initialSync?.failed) {
          setAddMessage({
            type: "error",
            text: `${data.added.ticker} added, but ownership data is still loading: ${data.initialSync.errors?.join("; ")}`,
          });
        } else {
          const syncMsg = data.initialSync?.newTransactions > 0
            ? `Found ${data.initialSync.newTransactions} new ownership update${data.initialSync.newTransactions === 1 ? "" : "s"}.`
            : "No new ownership updates yet.";
          setAddMessage({ type: "success", text: `${data.added.companyName} (${data.added.ticker}) added. ${syncMsg}` });
        }
      }
    } catch {
      setAddMessage({ type: "error", text: "Network error — try again" });
    } finally {
      setAdding(false);
    }
  };

  const handleAdd = async () => {
    // Natural language search support
    const input = addInput.trim().toLowerCase();

    // Exact ticker in watchlist -> navigate to it
    if (
      entries.some(
        (e) => e.ticker.toLowerCase() === input && input.length <= 5 && /^[a-z]+$/.test(input),
      )
    ) {
      window.location.href = `/companies/${input.toUpperCase()}`;
      return;
    }

    // "Why is [ticker] moving?" or "What changed for [ticker]?"
    const whyMatch = input.match(/^(why\s+is\s+|what\s+changed\s+for\s+)([a-z]+)/);
    if (whyMatch && entries.some((e) => e.ticker.toLowerCase() === whyMatch[2])) {
      window.location.href = `/companies/${whyMatch[2].toUpperCase()}`;
      return;
    }

    // Unrecognized natural language query
    if (input.length > 5 && !/^[a-z0-9.]+$/.test(input)) {
      setSearchResult({
        type: "unrecognized",
        text: "Search accepts ticker symbols and company names. Try a ticker like \"AAPL\" or a name like \"Apple\".",
      });
      setTimeout(() => setSearchResult(null), 4000);
      return;
    }

    await handleAddValue();
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

  // Shortcut: press K to focus Track compose.
  useEffect(() => {
    if (mode !== "manage") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "K" || event.key === "k") {
        event.preventDefault();
        addInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  const composeBar = (
    <section className="list-compose ink-panel" aria-label="Track a company">
      <div className="list-compose-copy">
        <strong className="list-compose-title">Track a company</strong>
      </div>
      <div className="watchlist-add list-compose-fields">
        <CompanyTypeahead
          value={addInput}
          onChange={setAddInput}
          onSelect={(suggestion) => {
            setAddInput("");
            void handleAddValue(suggestion.ticker);
          }}
          onEnter={() => void handleAdd()}
          placeholder="Ticker or company name"
          disabled={adding}
          className="watchlist-input"
          wrapperClassName="watchlist-input-wrap"
          inputRef={addInputRef}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !addInput.trim()}
          className="watchlist-add-button list-compose-cta"
        >
          {adding ? "Adding…" : "Track"}
        </button>
      </div>
      {searchResult ? (
        <p className={`watchlist-message info list-compose-message`}>{searchResult.text}</p>
      ) : null}
      {addMessage ? (
        <p className={`watchlist-message ${addMessage.type} list-compose-message`}>
          {addMessage.text}
        </p>
      ) : null}
    </section>
  );

  if (mode === "manage") {
    return (
      <section id="watchlist" className="data-manager-section" aria-labelledby="manage-watchlist-title">
        <header className="data-manager-section-head">
          <div>
            <span className="data-manager-eyebrow">Watchlist</span>
            <h2 id="manage-watchlist-title">Names you follow</h2>
          </div>
          <span className="data-manager-count">
            {entries.length} symbol{entries.length === 1 ? "" : "s"}
          </span>
        </header>

        {composeBar}

        {loading ? (
          <PageLoadingMotion
            label="Loading watchlist"
            compact
            showLabel={false}
            showSubtitle={false}
            speed="slow"
          />
        ) : entries.length > 0 ? (
          <div className="data-manager-list" aria-label="Watchlist names">
            {entries.map((entry) => (
              <div key={entry.ticker} className="data-manager-row">
                <div className="data-manager-row-copy">
                  <Link href={`/companies/${encodeURIComponent(entry.ticker)}`} className="data-manager-ticker">
                    {entry.ticker}
                  </Link>
                  <span>{entry.companyName}</span>
                </div>
                <button
                  type="button"
                  className="data-manager-action is-danger"
                  onClick={() => void handleRemove(entry.ticker)}
                  disabled={removing === entry.ticker}
                  aria-label={`Remove ${entry.ticker} from watchlist`}
                >
                  {removing === entry.ticker ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="data-manager-empty">
            <strong>No watchlist names yet.</strong>
            <span>Use the field above to track your first company.</span>
          </div>
        )}

      </section>
    );
  }

  return (
    <div>
      {loading ? (
        <PageLoadingMotion
          label="Loading watchlist"
          compact
          showLabel={false}
          showSubtitle={false}
          speed="slow"
        />
      ) : null}

      {!loading && entries.length === 0 ? (
        <div className="empty-state">
          <p>Your watchlist is empty.</p>
          <small>Add companies from the Manage page, then return here for the daily view.</small>
          <Link href="/manage#watchlist" className="brief-link">
            Add watchlist names →
          </Link>
        </div>
      ) : null}

      {loading || entries.length > 0 || children ? (
        <StockHeatmap
          title="Today’s move"
          subtitle=""
          headerAction={(
            <Link href="/manage#watchlist" className="data-edit-pill">
              Edit watchlist
            </Link>
          )}
          loading={loading}
          showStatusDot={false}
          showPrice
          uniform
          sessionLabel={
            entries
              .map((entry) => {
                const quote = quotes[entry.ticker];
                return quote ? getLivePrice(quote).label : null;
              })
              .find((label): label is string => Boolean(label)) ?? null
          }
          items={entries.map((entry) => {
            const quote = quotes[entry.ticker];
            const live = quote ? getLivePrice(quote) : null;
            const price = live?.price ?? quote?.price ?? null;
            const previousClose =
              quote?.previousClose
              ?? (price != null && quote?.change != null ? price - quote.change : null);
            return {
              ticker: entry.ticker,
              name: shortenCompanyName(entry.companyName),
              price,
              changePercent: live?.changePercent ?? quote?.changePercent ?? null,
              marketCap: quote?.marketCap ?? null,
              sparkline: sparklineValuesFromQuote({
                sparkline: quote?.sparkline,
                price,
                previousClose,
              }),
            };
          })}
          footer={children}
        />
      ) : null}

    </div>
  );
}
