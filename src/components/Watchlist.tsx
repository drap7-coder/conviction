"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import type { StockQuote } from "@/lib/market/types";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";
import { getLivePrice } from "@/lib/market/live-quote";
import { sparklineValuesFromQuote } from "@/lib/display/sparkline";
import { loadPositions } from "@/lib/portfolio/persist";
import { StockHeatmap } from "@/components/StockHeatmap";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { ProductStage } from "@/components/ProductStage";
import {
  buildWatchlistBriefItems,
  WatchlistDailyBrief,
  type WatchlistNewsSummary,
  type WatchlistTransition,
} from "@/components/WatchlistDailyBrief";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";
const WATCHLIST_MIGRATION_KEY = "conviction-watchlist-migrated";

function formatStagePercent(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
}

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
}: {
  children?: ReactNode;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [newsByTicker, setNewsByTicker] = useState<Record<string, WatchlistNewsSummary>>({});
  const [transitions, setTransitions] = useState<WatchlistTransition[]>([]);
  const [portfolioTickers, setPortfolioTickers] = useState<string[]>([]);

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
    const readPortfolioTickers = () => {
      setPortfolioTickers(Array.from(new Set(
        loadPositions()
          .map((position) => position.ticker.trim().toUpperCase())
          .filter(Boolean),
      )));
    };
    readPortfolioTickers();
    window.addEventListener("storage", readPortfolioTickers);
    return () => window.removeEventListener("storage", readPortfolioTickers);
  }, []);

  const briefingEntries = useMemo(() => {
    const next = [...entries];
    const existing = new Set(entries.map((entry) => entry.ticker.toUpperCase()));
    for (const ticker of portfolioTickers) {
      if (existing.has(ticker)) continue;
      next.push({ ticker, companyName: ticker, addedAt: "", status: "active" });
    }
    return next;
  }, [entries, portfolioTickers]);

  useEffect(() => {
    if (briefingEntries.length === 0) {
      setQuotes({});
      return;
    }
    let cancelled = false;

    async function loadQuotes() {
      try {
        const tickers = briefingEntries.map((entry) => entry.ticker).join(",");
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
  }, [briefingEntries]);

  useEffect(() => {
    if (briefingEntries.length === 0) {
      setNewsByTicker({});
      setTransitions([]);
      setBriefLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const tickers = briefingEntries.map((entry) => entry.ticker.toUpperCase());
    const chunks: string[][] = [];
    for (let index = 0; index < tickers.length; index += 10) {
      chunks.push(tickers.slice(index, index + 10));
    }

    async function loadBriefingEvidence() {
      setBriefLoading(true);
      try {
        const [newsResults, transitionResult] = await Promise.all([
          Promise.all(chunks.map((chunk) =>
            fetchJsonWithTimeout<{ news?: Record<string, WatchlistNewsSummary> }>(
              `/api/evidence/news-batch?tickers=${encodeURIComponent(chunk.join(","))}`,
              24_000,
              controller.signal,
            ).catch(() => ({ news: {} })),
          )),
          fetchJsonWithTimeout<{ transitions?: WatchlistTransition[] }>(
            "/api/conviction/transitions",
            8_000,
            controller.signal,
          ).catch(() => ({ transitions: [] })),
        ]);
        if (cancelled) return;
        setNewsByTicker(Object.assign({}, ...newsResults.map((result) => result.news ?? {})));
        setTransitions(transitionResult.transitions ?? []);
      } finally {
        if (!cancelled) setBriefLoading(false);
      }
    }

    void loadBriefingEvidence();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [briefingEntries]);

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

  const quotedEntries = briefingEntries
    .map((entry) => quotes[entry.ticker])
    .filter((quote): quote is StockQuote => Boolean(quote));
  const sessionLabel = quotedEntries
    .map((quote) => getLivePrice(quote).label)
    .find((label): label is string => Boolean(label)) ?? "Market session";

  const moveReadings = entries
    .map((entry) => {
      const quote = quotes[entry.ticker];
      const changePercent = quote
        ? (getLivePrice(quote).changePercent ?? quote.changePercent ?? null)
        : null;
      return changePercent === null
        ? null
        : { ticker: entry.ticker, changePercent };
    })
    .filter((item): item is { ticker: string; changePercent: number } => item !== null);
  const advancing = moveReadings.filter((item) => item.changePercent > 0.05).length;
  const declining = moveReadings.filter((item) => item.changePercent < -0.05).length;
  const attentionItems = useMemo(() => buildWatchlistBriefItems({
    entries: briefingEntries,
    quotes,
    newsByTicker,
    transitions,
    portfolioTickers,
    watchlistTickers: entries.map((entry) => entry.ticker),
  }), [briefingEntries, entries, newsByTicker, portfolioTickers, quotes, transitions]);
  const biggestMove = [...moveReadings]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0] ?? null;
  const stageHeadline = briefLoading || loading
    ? "Reading what changed."
    : attentionItems.length > 0
      ? `${attentionItems.length} ${attentionItems.length === 1 ? "update" : "updates"} worth a look.`
      : entries.length === 0
        ? "Build a watchlist worth returning to."
        : moveReadings.length > 0
          ? `${advancing} higher. ${declining} lower.`
          : "You’re caught up.";
  const stageSummary = attentionItems[0]
    ? `${attentionItems[0].ticker}: ${attentionItems[0].headline}`
    : biggestMove
      ? `${biggestMove.ticker} is the largest move at ${formatStagePercent(biggestMove.changePercent)}. Open it to see what changed.`
      : entries.length > 0
        ? "No new move, evidence, or conviction change stands out right now."
        : "Add companies you care about, then return for the moves and evidence that matter.";

  return (
    <div>
      <ProductStage
        variant="watchlist"
        aria-label="Watchlist"
        eyebrow={`Watchlist · Live data · ${sessionLabel}`}
        headline={stageHeadline}
        summary={stageSummary}
        metrics={
          <>
            <div className={attentionItems.length > 0 ? "is-alert" : undefined}>
              <strong>{briefLoading || loading ? "—" : attentionItems.length}</strong>
              <span>Updates</span>
            </div>
            <div className="is-positive">
              <strong>{loading ? "—" : advancing}</strong>
              <span>Higher</span>
            </div>
            <div className="is-negative">
              <strong>{loading ? "—" : declining}</strong>
              <span>Lower</span>
            </div>
          </>
        }
      />

      <WatchlistDailyBrief
        entries={briefingEntries}
        quotes={quotes}
        newsByTicker={newsByTicker}
        transitions={transitions}
        loading={loading || briefLoading}
        sessionLabel={sessionLabel}
        portfolioTickers={portfolioTickers}
        watchlistTickers={entries.map((entry) => entry.ticker)}
      />

      {loading ? <PageLoadingMotion label="Loading watchlist" compact /> : null}

      {!loading && entries.length === 0 ? (
        <div className="empty-state">
          <p>Add companies you care about.</p>
          <small>Track names below, then tap a heatmap tile to open the company dashboard.</small>
          <Link href="/pulse" className="brief-link">
            Browse market moves →
          </Link>
        </div>
      ) : null}

      {loading || entries.length > 0 || children ? (
        <StockHeatmap
          title="Today’s move"
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
            const price = live?.price ?? quote?.price ?? null;
            const previousClose =
              quote?.previousClose
              ?? (price != null && quote?.change != null ? price - quote.change : null);
            return {
              ticker: entry.ticker,
              name: entry.companyName,
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

      {composeBar}

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

      <GuestModeBanner
        authenticated={authenticated}
        authConfigured={authConfigured}
        accountLabel={accountLabel}
      />
    </div>
  );
}
