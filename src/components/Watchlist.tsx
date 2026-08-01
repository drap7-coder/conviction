"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import type { WatchlistCardHeadline } from "@/app/components/WatchlistCard";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import type { StockQuote } from "@/lib/market/types";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";
import { getLivePrice } from "@/lib/market/live-quote";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { StockHeatmap } from "@/components/StockHeatmap";
import { MoveDriversPanel } from "@/components/MoveDriversPanel";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { MacroChainChart, buildMacroSeriesFromQuotes } from "@/components/market/MacroChainChart";

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

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ticker-suggestion-match">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function Watchlist({
  children,
  hidePurpose = false,
  composeFirst = false,
}: {
  children?: ReactNode;
  hidePurpose?: boolean;
  /** Put the Track compose bar under portfolio value / above list content. */
  composeFirst?: boolean;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [headlines, setHeadlines] = useState<Record<string, WatchlistCardHeadline[]>>({});
  const [newsDrivers, setNewsDrivers] = useState<Record<string, NewsDriver | null>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add company state
  const [addInput, setAddInput] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Type-ahead suggestion state
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "results" | "empty">("idle");
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestCacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());

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
        user?: { name?: string | null; email?: string | null };
        authConfigured?: boolean;
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
  }, []);

  useEffect(() => {
    if (entries.length === 0) return;
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
  }, [entries]);

  useEffect(() => {
    if (entries.length === 0) {
      setHeadlines({});
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function loadHeadlines() {
      const batches = Array.from(
        { length: Math.ceil(entries.length / 10) },
        (_, index) => entries.slice(index * 10, index * 10 + 10),
      );
      const responses = await Promise.all(batches.map((batch) =>
        fetchJsonWithTimeout<{
          news?: Record<string, { headlines?: WatchlistCardHeadline[]; driver?: NewsDriver | null }>;
        }>(
          `/api/evidence/news-batch?tickers=${batch.map((entry) => entry.ticker).join(",")}`,
          10_000,
          controller.signal,
        ).catch(() => ({ news: {} })),
      ));
      if (cancelled) return;

      const nextHeadlines: Record<string, WatchlistCardHeadline[]> = {};
      const nextDrivers: Record<string, NewsDriver | null> = {};
      for (const response of responses) {
        const news = response.news as Record<string, { headlines?: WatchlistCardHeadline[]; driver?: NewsDriver | null }> | undefined;
        for (const [ticker, item] of Object.entries(news ?? {})) {
          nextHeadlines[ticker] = item.headlines ?? [];
          nextDrivers[ticker] = item.driver ?? null;
        }
      }
      setHeadlines(nextHeadlines);
      setNewsDrivers(nextDrivers);
    }

    void loadHeadlines();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entries]);

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

  const handleSelectSuggestion = (suggestion: CompanySuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestStatus("idle");
    setAddInput("");
    void handleAddValue(suggestion.ticker);
  };

  const applySuggestions = (next: CompanySuggestion[]) => {
    setSuggestions(next);
    setSuggestStatus(next.length > 0 ? "results" : "empty");
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  };

  // Debounced type-ahead search against the SEC company dataset.
  useEffect(() => {
    const query = addInput.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      setSuggestStatus("idle");
      return;
    }

    // Serve from the in-session cache instantly (e.g. when backspacing).
    const cacheKey = query.toLowerCase();
    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      applySuggestions(cached);
      return;
    }

    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const controller = new AbortController();
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: CompanySuggestion[] };
        const next = data.suggestions ?? [];
        suggestCacheRef.current.set(cacheKey, next);
        applySuggestions(next);
      } catch {
        // Type-ahead is best-effort; fall back to typing the full ticker/name.
      }
    }, 150);

    return () => {
      controller.abort();
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [addInput]);

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
    if (showSuggestions && e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
      return;
    }
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestion]);
        return;
      }
    }
    if (e.key === "Enter") handleAdd();
  };

  const watchlistMacroSeries = useMemo(() => {
    const ranked = [...entries]
      .map((entry) => {
        const quote = quotes[entry.ticker];
        return {
          ticker: entry.ticker,
          label: entry.ticker,
          marketCap: quote?.marketCap ?? 0,
          values: (quote?.sparkline ?? []).map((point) => point.close),
        };
      })
      .filter((item) => item.values.length >= 2)
      .sort((a, b) => b.marketCap - a.marketCap);
    return buildMacroSeriesFromQuotes(ranked, 5);
  }, [entries, quotes]);

  // Shortcut: press K to focus Track compose.
  useEffect(() => {
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
  }, []);

  const composeBar = (
    <section className="list-compose ink-panel" aria-label="Track a company">
      <div className="list-compose-copy">
        <strong className="list-compose-title">Track a company</strong>
      </div>
      <div className="watchlist-add list-compose-fields">
        <div className="watchlist-input-wrap">
          <input
            ref={addInputRef}
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={handleAddKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 120); }}
            placeholder="Ticker or company name"
            disabled={adding}
            className="watchlist-input"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            autoComplete="off"
          />
          {showSuggestions && suggestStatus === "results" && suggestions.length > 0 ? (
            <ul className="ticker-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.ticker}-${s.cik}`}
                  role="option"
                  aria-selected={i === activeSuggestion}
                  className={`ticker-suggestion ${i === activeSuggestion ? "active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                >
                  <span className="ticker-suggestion-ticker">{highlightMatch(s.ticker, addInput)}</span>
                  <span className="ticker-suggestion-name">{highlightMatch(s.name, addInput)}</span>
                </li>
              ))}
            </ul>
          ) : showSuggestions && suggestStatus === "empty" ? (
            <div className="ticker-suggestions ticker-suggestions-empty">
              No matches — press Enter to search anyway
            </div>
          ) : null}
        </div>
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

  return (
    <div>
      {!hidePurpose ? (
        <div className="page-purpose">
          <span className="page-purpose-eyebrow">Watchlist</span>
          <h2 className="page-purpose-title">What changed in the companies you follow?</h2>
        </div>
      ) : null}

      {composeFirst ? composeBar : null}

      <GuestModeBanner
        authenticated={authenticated}
        authConfigured={authConfigured}
        accountLabel={accountLabel}
      />

      {!composeFirst ? composeBar : null}

      {loading ? <PageLoadingMotion label="Loading watchlist" compact /> : null}

      {!loading && entries.length === 0 ? (
        <div className="empty-state">
          <p>Add companies you care about.</p>
          <small>Track names above, then tap a heatmap tile to open the company dashboard.</small>
          <Link href="/pulse" className="brief-link">
            Browse market moves →
          </Link>
        </div>
      ) : null}

      {/* Heatmap-first watchlist: tiles are the list; hover shows what’s driving the move. */}
      {loading || entries.length > 0 || children ? (
        <StockHeatmap
          title="Watchlist"
          subtitle=""
          loading={loading}
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
            const driver = newsDrivers[entry.ticker];
            const topHeadline = headlines[entry.ticker]?.[0]?.headline ?? null;
            return {
              ticker: entry.ticker,
              name: entry.companyName,
              price: live?.price ?? quote?.price ?? null,
              changePercent: live?.changePercent ?? quote?.changePercent ?? null,
              marketCap: quote?.marketCap ?? null,
              driverText: driver?.label ?? topHeadline,
            };
          })}
          footer={(
            <>
              {entries.length > 0 ? (
                <MoveDriversPanel
                  holdings={entries.map((entry) => {
                    const quote = quotes[entry.ticker];
                    const live = quote ? getLivePrice(quote) : null;
                    return {
                      ticker: entry.ticker,
                      companyName: entry.companyName,
                      changePercent: live?.changePercent ?? quote?.changePercent ?? null,
                    };
                  })}
                  newsByTicker={Object.fromEntries(
                    entries.map((entry) => [
                      entry.ticker.toUpperCase(),
                      {
                        driver: newsDrivers[entry.ticker] ?? null,
                        headlines: headlines[entry.ticker] ?? [],
                      },
                    ]),
                  )}
                  nested
                />
              ) : null}
              {children}
            </>
          )}
        />
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="wl-manage-row" aria-label="Manage watchlist names">
          <span className="wl-manage-label">
            {entries.length} symbol{entries.length === 1 ? "" : "s"}
          </span>
          <div className="wl-manage-chips">
            {entries.map((entry) => (
              <span key={entry.ticker} className="wl-manage-chip">
                <Link href={`/companies/${encodeURIComponent(entry.ticker)}`}>
                  {entry.ticker}
                </Link>
                <button
                  type="button"
                  className="wl-manage-remove"
                  onClick={() => void handleRemove(entry.ticker)}
                  disabled={removing === entry.ticker}
                  aria-label={`Remove ${entry.ticker} from watchlist`}
                >
                  {removing === entry.ticker ? "…" : "×"}
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && watchlistMacroSeries.length > 0 ? (
        <MacroChainChart
          series={watchlistMacroSeries}
          title="Watchlist Chain"
          subtitle=""
        />
      ) : null}
    </div>
  );
}
