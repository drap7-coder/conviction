"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getCardVerdict, getCardEvidence, type CardVerdictShortInterest, type CardVerdictEntry } from "@/lib/evidence/card-verdict";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import { WatchlistCard, type WatchlistCardEvidencePill, type WatchlistCardActivityLine, type WatchlistCardHeadline } from "@/app/components/WatchlistCard";
import { NeedsYourAttention } from "@/app/components/NeedsYourAttention";
import type { WatchlistEntry, ThesisStatus, WatchlistThesis } from "@/lib/watchlist/types";
import { getPriorityReviewItems, normalizeEntryForThesis } from "@/lib/watchlist/priority-review";
import { removeGuestThesis } from "@/lib/watchlist/guest-persistence";
import { calculateRelativeVolatility } from "@/lib/market/volatility";

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dollarVolume: number | null;
  currency: string | null;
  marketState: string | null;
  sparkline: Array<{ date: string; close: number }>;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";
const WATCHLIST_MIGRATION_KEY = "conviction-watchlist-migrated";

// Extend WatchlistEntry to include optional thesis field from localStorage
interface WatchlistEntryWithThesis extends WatchlistEntry {
  thesis?: WatchlistThesis;
}

function buildSparklinePath(points: Array<{ close: number }>) {
  if (points.length < 2) return "";
  const width = 320;
  const height = 96;
  const padding = 6;
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

function buildEvidencePills(entry: CardVerdictEntry, shortInterest?: CardVerdictShortInterest): WatchlistCardEvidencePill[] {
  const pills: WatchlistCardEvidencePill[] = [];
  const evidence = getCardEvidence(entry, shortInterest);

  for (const item of evidence) {
    if (item.provider === "SEC 13F") {
      pills.push({
        type: "13F",
        text: item.text,
        direction: item.direction === "positive" ? "positive" : item.direction === "negative" ? "negative" : "neutral",
      });
    } else if (item.provider === "FINRA short interest") {
      pills.push({
        type: "SI",
        text: item.text,
        direction: item.direction === "positive" ? "positive" : "negative",
      });
    }
  }

  return pills;
}

function buildActivityLine(recency: string, insight: string, source: string): WatchlistCardActivityLine | null {
  if (!insight || insight.startsWith("No high-conviction") || insight.startsWith("SEC coverage is limited")) {
    return null;
  }

  // Shorten the insight to fit a single line
  const short = insight.replace(/\.$/, "");
  const sourceLabel = source === "SEC 13F"
    ? "13F"
    : source === "FINRA short interest"
      ? "SI"
      : source;
  return { timestamp: recency, text: short, source: sourceLabel };
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntryWithThesis[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [headlines, setHeadlines] = useState<Record<string, WatchlistCardHeadline[]>>({});
  const [shortInterest, setShortInterest] = useState<Record<string, CardVerdictShortInterest>>({});
  const [indexQuotes, setIndexQuotes] = useState<Record<string, StockQuote>>({});
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

  // Removal state
  const [removing, setRemoving] = useState<string | null>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const [focusedTicker, setFocusedTicker] = useState<string | null>(null);
  const watchlistListRef = useRef<HTMLDivElement>(null);

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
          news?: Record<string, { headlines?: WatchlistCardHeadline[] }>;
        }>(
          `/api/evidence/news-batch?tickers=${batch.map((entry) => entry.ticker).join(",")}`,
          10_000,
          controller.signal,
        ).catch(() => ({ news: {} })),
      ));
      if (cancelled) return;

      const nextHeadlines: Record<string, WatchlistCardHeadline[]> = {};
      for (const response of responses) {
        const news = response.news as Record<string, { headlines?: WatchlistCardHeadline[] }> | undefined;
        for (const [ticker, item] of Object.entries(news ?? {})) {
          nextHeadlines[ticker] = item.headlines ?? [];
        }
      }
      setHeadlines(nextHeadlines);
    }

    void loadHeadlines();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entries]);

  useEffect(() => {
    let cancelled = false;

    async function loadIndexQuotes() {
      try {
        // Fetch quotes for a major index like SPX
        const response = await fetch(`/api/market/quotes?tickers=${encodeURIComponent('^SPX')}`);
        if (!response.ok) return;
        const data = (await response.json()) as { quotes?: StockQuote[] };
        if (cancelled) return;
        const nextQuotes: Record<string, StockQuote> = {};
        for (const quote of data.quotes ?? []) {
          nextQuotes[quote.ticker] = quote;
        }
        setIndexQuotes(nextQuotes);
      } catch {
        if (!cancelled) setIndexQuotes({});
      }
    }

    void loadIndexQuotes();
    return () => {
      cancelled = true;
    };
  }, []); // Run once on component mount

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

  const handleAdd = async () => {
    await handleAddValue();
  };

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    const nextEntries = entries.filter((entry) => entry.ticker !== ticker);
    setEntries(nextEntries);

    // Remove thesis data from localStorage when removing from guest watchlist
    removeGuestThesis(ticker);

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

  const sortedEntries = [...entries].sort((a, b) => {
    const aVerdict = getCardVerdict(a, quotes[a.ticker], shortInterest[a.ticker]);
    const bVerdict = getCardVerdict(b, quotes[b.ticker], shortInterest[b.ticker]);
    return bVerdict.sortScore - aVerdict.sortScore || a.ticker.localeCompare(b.ticker);
  });

  const filteredEntries = useMemo(() => {
    if (!addInput) return sortedEntries;
    const lowerCaseInput = addInput.toLowerCase();
    return sortedEntries.filter(
      (entry) =>
        entry.ticker.toLowerCase().includes(lowerCaseInput) ||
        entry.companyName.toLowerCase().includes(lowerCaseInput)
    );
  }, [sortedEntries, addInput]);

  // Get entries with normalized thesis for NeedsYourAttention
  const entriesForAttention = useMemo(() => {
    return entries.map(normalizeEntryForThesis);
  }, [entries]);

  const priorityItems = useMemo(() => {
    return getPriorityReviewItems(entriesForAttention);
  }, [entriesForAttention]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'K' || event.key === 'k') {
        event.preventDefault();
        addInputRef.current?.focus();
      } else if (['ArrowUp', 'ArrowDown', 'j', 'k'].includes(event.key)) {
        event.preventDefault();

        setFocusedCardIndex((prevIndex) => {
          let newIndex = prevIndex;
          const maxIndex = filteredEntries.length - 1;

          if (event.key === 'j' || event.key === 'ArrowDown') {
            newIndex = Math.min(prevIndex + 1, maxIndex);
          } else if (event.key === 'k' || event.key === 'ArrowUp') {
            newIndex = Math.max(prevIndex - 1, 0);
          }

          // Ensure index is valid for current filtered list
          if (maxIndex < 0) return -1; // No cards to focus
          if (newIndex > maxIndex) newIndex = maxIndex; // Adjust if filtered list is shorter
          if (newIndex < 0) newIndex = 0;

          // Scroll the focused card into view
          if (watchlistListRef.current && newIndex !== prevIndex) {
            const focusedCardElement = watchlistListRef.current.children[newIndex] as HTMLElement;
            if (focusedCardElement) {
              focusedCardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          return newIndex;
        });
      } else if (event.key === 'Enter' && focusedCardIndex !== -1 && filteredEntries[focusedCardIndex]) {
        setFocusedTicker(filteredEntries[focusedCardIndex].ticker);
      } else if (event.key === 'Escape') {
        setFocusedTicker(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [addInputRef, filteredEntries, focusedCardIndex, focusedTicker, watchlistListRef]);

  return (
    <div>
      <div className="watchlist-header">
        <h2 className="section-title">Watchlist</h2>
        <div className="watchlist-meta">
          <span className="section-count">{entries.length} companies</span>
          <span className="storage-note" title={authenticated ? "Synced privately across devices" : "Saved in this browser only"}>
            {authenticated ? "Private sync" : "Saved here"}
          </span>
        </div>
      </div>

      <NeedsYourAttention entries={entriesForAttention} />

      <GuestModeBanner
        authenticated={authenticated}
        authConfigured={authConfigured}
        accountLabel={accountLabel}
      />

      {entries.length === 0 ? (
        <div className="product-brief">
          <div>
            <span className="institutional-eyebrow">Conviction engine</span>
            <h2>Where sophisticated capital is building conviction.</h2>
          </div>
          <Link href="/rising" className="brief-link">
            View trending →
          </Link>
        </div>
      ) : null}

      <div className="watchlist-add">
        <div className="watchlist-input-wrap">
          <input
            ref={addInputRef}
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
      ) : focusedTicker ? (
        <div className="focused-card-container">
          {filteredEntries
            .filter((entry) => entry.ticker === focusedTicker)
            .map((entry) => {
              const quote = quotes[entry.ticker];
              const quoteDirection = quote?.change === null || quote?.change === undefined
                ? "neutral"
                : quote.change > 0
                  ? "positive"
                  : quote.change < 0
                    ? "negative"
                    : "neutral";
              const verdict = getCardVerdict(entry, quote, shortInterest[entry.ticker]);
              const sparklinePath = buildSparklinePath(quote?.sparkline ?? []);
              const evidencePills = buildEvidencePills(entry, shortInterest[entry.ticker]);
              const activityLine = buildActivityLine(verdict.recency, verdict.insight, verdict.source);

              return (
                <WatchlistCard
                  key={entry.ticker}
                  ticker={entry.ticker}
                  companyName={entry.companyName}
                  price={quote?.price ?? null}
                  change={quote?.change ?? null}
                  changePercent={quote?.changePercent ?? null}
                  convictionState={verdict.state}
                  convictionTone={verdict.tone}
                  evidencePills={evidencePills}
                  activityLine={activityLine}
                  headlines={headlines[entry.ticker] ?? []}
                  sparklinePath={sparklinePath}
                  sparklineDirection={quoteDirection}
                  onRemove={handleRemove}
                  isRemoving={removing === entry.ticker}
                  thesisStatus={entry.thesis?.status}
                  macroCorrelationHighlight={calculateRelativeVolatility(quote, indexQuotes['^SPX'])}
                  isFocused={true}
                />
              );
            })}
        </div>
      ) : (
        <div className="watchlist-list" ref={watchlistListRef}>
          {filteredEntries.map((entry, index) => {
            const quote = quotes[entry.ticker];
            const quoteDirection = quote?.change === null || quote?.change === undefined
              ? "neutral"
              : quote.change > 0
                ? "positive"
                : quote.change < 0
                  ? "negative"
                  : "neutral";
            const verdict = getCardVerdict(entry, quote, shortInterest[entry.ticker]);
            const sparklinePath = buildSparklinePath(quote?.sparkline ?? []);
            const evidencePills = buildEvidencePills(entry, shortInterest[entry.ticker]);
            const activityLine = buildActivityLine(verdict.recency, verdict.insight, verdict.source);

            const isCardFocused = focusedCardIndex === index;

            return (
              <WatchlistCard
                key={entry.ticker}
                ticker={entry.ticker}
                companyName={entry.companyName}
                price={quote?.price ?? null}
                change={quote?.change ?? null}
                changePercent={quote?.changePercent ?? null}
                convictionState={verdict.state}
                convictionTone={verdict.tone}
                evidencePills={evidencePills}
                activityLine={activityLine}
                headlines={headlines[entry.ticker] ?? []}
                sparklinePath={sparklinePath}
                sparklineDirection={quoteDirection}
                onRemove={handleRemove}
                isRemoving={removing === entry.ticker}
                thesisStatus={entry.thesis?.status}
                macroCorrelationHighlight={calculateRelativeVolatility(quote, indexQuotes['^SPX'])}
                isFocused={isCardFocused}
              />
            );
          })}
        </div>
      )}

      <p className="watchlist-footnote">
        Powered by SEC EDGAR primary-source filings
      </p>
    </div>
  );
}
