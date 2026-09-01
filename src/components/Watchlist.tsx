"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import type { StockQuote } from "@/lib/market/types";
import { getExtendedSessionQuote, getLivePrice } from "@/lib/market/live-quote";
import { shortenCompanyName } from "@/lib/display/company-name";
import { CompanyTypeahead } from "@/components/CompanyTypeahead";
import { TickerCaptureActions } from "@/components/TickerCaptureActions";
import {
  MarketMoversBoard,
  sessionLabelFromQuotes,
} from "@/components/market/MarketMoversBoard";
import {
  isOffHoursMoversSession,
  moversInsufficientDataLabel,
  moversSessionDisplayLabel,
  resolveMoversActiveSession,
  splitMarketMovers,
} from "@/lib/market/market-movers";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { SurfaceSlicer, type SurfaceSlicerOption } from "@/components/SurfaceSlicer";
import { subscribeMarketData } from "@/lib/market/client-market-data";
import { sanitizeWatchlistInput, isWatchlistSymbolFormat } from "@/lib/watchlist/sanitize-ticker";
import {
  createMutationQueue,
  flushBrowserWatchlistWrite,
  scheduleBrowserWatchlistWrite,
  writeBrowserWatchlistNow,
} from "@/lib/watchlist/sync-guard";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";
const WATCHLIST_MIGRATION_KEY = "conviction-watchlist-migrated";

type PerformanceSlice = "all" | "leaders" | "laggards";

const PERFORMANCE_SLICES: SurfaceSlicerOption[] = [
  { id: "all", label: "All Assets" },
  { id: "leaders", label: "Leaders", tone: "up" },
  { id: "laggards", label: "Laggards", tone: "down" },
];

function parsePerformanceSlice(value: string): PerformanceSlice {
  if (value === "leaders" || value === "laggards") return value;
  return "all";
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
  const authenticatedRef = useRef(false);
  authenticatedRef.current = authenticated;
  const [persistence, setPersistence] = useState<"browser" | "neon" | "unconfigured">("browser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add company state
  const [addInput, setAddInput] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Removal state — confirm before wipe; serialize sync
  const [removing, setRemoving] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const enqueueMutation = useMemo(() => createMutationQueue(), []);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Search state
  const [searchResult, setSearchResult] = useState<{ type: "navigate" | "filter" | "unrecognized"; text: string } | null>(null);
  const [performanceSlice, setPerformanceSlice] = useState<PerformanceSlice>("all");

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
      // Guests own localStorage only — never adopt the ops/seed sync universe.
      if (!isAuthenticated && browserEntries) writeBrowserWatchlistNow(nextEntries);
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
  }, [loadWatchlist]);

  useEffect(() => {
    return () => {
      flushBrowserWatchlistWrite();
    };
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

    const tickers = entries.map((entry) => entry.ticker);
    const subscription = subscribeMarketData({
      quoteTickers: tickers,
      onQuotes: (next) => {
        const mapped: Record<string, StockQuote> = {};
        for (const quote of next) {
          mapped[quote.ticker] = quote;
        }
        setQuotes(mapped);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [entries, mode]);

  const handleAddValue = async (value?: string) => {
    const input = sanitizeWatchlistInput(value ?? addInput);
    if (!input) {
      setAddMessage({ type: "error", text: "Please enter a valid ticker or company name." });
      return;
    }

    if (entriesRef.current.some((entry) => entry.ticker === input)) {
      setAddMessage({ type: "info", text: `${input} is already in your watchlist.` });
      return;
    }

    setAdding(true);
    setAddMessage(null);

    await enqueueMutation(async () => {
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
          const current = entriesRef.current;
          const nextEntries = authenticatedRef.current
            ? data.entries
            : [
                ...current.filter((entry) => entry.ticker !== data.added.ticker),
                data.added,
              ];
          setEntries(nextEntries);
          if (!authenticatedRef.current) scheduleBrowserWatchlistWrite(nextEntries);
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
    });
  };

  const handleAdd = async () => {
    const sanitized = sanitizeWatchlistInput(addInput);
    const rawLower = addInput.trim().toLowerCase();

    // Exact ticker in watchlist -> navigate to it
    if (
      sanitized &&
      isWatchlistSymbolFormat(sanitized) &&
      entries.some((e) => e.ticker === sanitized)
    ) {
      window.location.href = `/companies/${encodeURIComponent(sanitized)}`;
      return;
    }

    // "Why is [ticker] moving?" or "What changed for [ticker]?"
    const whyMatch = rawLower.match(/^(why\s+is\s+|what\s+changed\s+for\s+)([a-z0-9.\-]+)/);
    if (whyMatch) {
      const whyTicker = sanitizeWatchlistInput(whyMatch[2]);
      if (whyTicker && entries.some((e) => e.ticker === whyTicker)) {
        window.location.href = `/companies/${encodeURIComponent(whyTicker)}`;
        return;
      }
    }

    // Unrecognized natural language query (not a ticker / company-shaped string)
    if (rawLower.length > 5 && !/^[a-z0-9.\-\s&']+$/i.test(addInput.trim())) {
      setSearchResult({
        type: "unrecognized",
        text: "Search accepts ticker symbols and company names. Try a ticker like \"AAPL\" or a name like \"Apple\".",
      });
      setTimeout(() => setSearchResult(null), 4000);
      return;
    }

    await handleAddValue();
  };

  const executeRemove = async (ticker: string) => {
    const previous = entriesRef.current;
    const nextEntries = previous.filter((entry) => entry.ticker !== ticker);
    setPendingRemoval(null);
    setRemoving(ticker);
    setEntries(nextEntries);

    if (!authenticatedRef.current) {
      scheduleBrowserWatchlistWrite(nextEntries);
      setRemoving(null);
      return;
    }

    await enqueueMutation(async () => {
      try {
        const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.success) {
          setEntries(data.entries);
        } else {
          setEntries(previous);
          setAddMessage({
            type: "error",
            text: data.error || `Failed to remove ${ticker}.`,
          });
        }
      } catch {
        setEntries(previous);
        setAddMessage({ type: "error", text: `Failed to remove ${ticker}.` });
      } finally {
        setRemoving(null);
      }
    });
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
    <section
      id="manage-compose"
      className="data-manager-compose list-compose surface-well"
      aria-label="Track a company"
    >
      <div className="list-compose-copy">
        <span className="list-compose-eyebrow">Compose</span>
        <strong className="list-compose-title">Track a company</strong>
        <span className="data-manager-compose-hint">
          Type a ticker or company — mic sits in the field.
        </span>
      </div>
      <div className="watchlist-add list-compose-fields">
        <label className="data-manager-compose-ticker">
          <span className="sr-only">Ticker or company</span>
          <CompanyTypeahead
            value={addInput}
            onChange={setAddInput}
            onSelect={(suggestion) => {
              setAddInput("");
              void handleAddValue(suggestion.ticker);
            }}
            onEnter={() => void handleAdd()}
            placeholder="Ticker or company name"
            inputAriaLabel="Ticker or company name"
            disabled={adding}
            className="watchlist-input"
            wrapperClassName="watchlist-input-wrap"
            inputRef={addInputRef}
            trailing={(
              <TickerCaptureActions
                disabled={adding}
                onResolved={(suggestion) => {
                  setAddInput("");
                  setSearchResult(null);
                  void handleAddValue(suggestion.ticker);
                }}
                onQuery={(query) => setAddInput(query)}
                onStatus={(message) => {
                  setSearchResult(message ? { type: "unrecognized", text: message } : null);
                }}
              />
            )}
          />
        </label>
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

  const watchlistSession = useMemo(() => {
    const hint = entries
      .map((entry) => {
        const quote = quotes[entry.ticker];
        if (!quote) return null;
        const extended = getExtendedSessionQuote(quote);
        const live = getLivePrice(quote);
        return {
          sessionLabel: extended.sessionLabel ?? live.label,
          clockSession: live.session,
        };
      })
      .find((entry) => entry && (Boolean(entry.sessionLabel) || entry.clockSession !== "regular"));
    return resolveMoversActiveSession({
      sessionLabel: hint?.sessionLabel ?? null,
      clockSession: hint?.clockSession ?? null,
    });
  }, [entries, quotes]);

  const watchlistSessionLabel = moversSessionDisplayLabel(watchlistSession)
    ?? sessionLabelFromQuotes(
      entries.map((entry) => {
        const quote = quotes[entry.ticker];
        if (!quote) return null;
        return getExtendedSessionQuote(quote).sessionLabel ?? getLivePrice(quote).label;
      }),
    );

  const { top: watchlistTop, bottom: watchlistBottom } = useMemo(() => {
    const rows = entries.map((entry) => {
      const quote = quotes[entry.ticker];
      const live = quote ? getLivePrice(quote) : null;
      const extended = quote ? getExtendedSessionQuote(quote) : null;
      const inExtended = Boolean(extended?.sessionLabel);
      const price = inExtended
        ? (quote?.price ?? null)
        : (live?.price ?? quote?.price ?? null);
      const changePercent = quote?.changePercent ?? live?.changePercent ?? null;
      return {
        ticker: entry.ticker,
        name: shortenCompanyName(entry.companyName),
        changePercent,
        price,
        change: quote?.change ?? null,
        extendedPrice: extended?.price ?? null,
        extendedChange: extended?.change ?? null,
        extendedChangePercent: extended?.changePercent ?? null,
        extendedNoTrades: extended?.noTrades ?? false,
        sessionLabel: extended?.sessionLabel ?? null,
      };
    });
    return splitMarketMovers(rows, Math.max(rows.length, 1), {
      session: watchlistSession,
    });
  }, [entries, quotes, watchlistSession]);

  const watchlistEmptyLabel = isOffHoursMoversSession(watchlistSession)
    ? moversInsufficientDataLabel(watchlistSession)
    : null;

  if (mode === "manage") {
    return (
      <section
        id="watchlist"
        className="data-manager-section surface-shell"
        aria-labelledby="manage-watchlist-title"
      >
        <header className="data-manager-section-head">
          <div>
            <span className="data-manager-eyebrow">Watchlist</span>
            <h2 id="manage-watchlist-title">Names you follow</h2>
            <p className="data-manager-lede">
              Names you follow day to day. Add above, remove here.
            </p>
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
          <div className="data-manager-list surface-well" aria-label="Watchlist names">
            {entries.map((entry) => {
              const confirming = pendingRemoval === entry.ticker;
              const busy = removing === entry.ticker;
              return (
              <div key={entry.ticker} className="data-manager-row">
                <div className="data-manager-row-copy">
                  <span className="data-manager-logo" aria-hidden="true">
                    <LogoDisplay ticker={entry.ticker} size="card" />
                  </span>
                  <Link
                    href={`/companies/${encodeURIComponent(entry.ticker)}`}
                    className="data-manager-id"
                  >
                    <strong className="data-manager-ticker">{entry.ticker}</strong>
                    <span>{entry.companyName}</span>
                  </Link>
                </div>
                {confirming ? (
                  <div className="data-manager-confirm-actions" role="group" aria-label={`Confirm remove ${entry.ticker}`}>
                    <span className="data-manager-confirm">Remove?</span>
                    <button
                      type="button"
                      className="data-manager-action is-danger"
                      onClick={() => void executeRemove(entry.ticker)}
                      disabled={busy}
                    >
                      {busy ? "Removing…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      className="data-manager-action"
                      onClick={() => setPendingRemoval(null)}
                      disabled={busy}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="data-manager-action is-danger"
                    onClick={() => setPendingRemoval(entry.ticker)}
                    disabled={busy || adding}
                    aria-label={`Remove ${entry.ticker} from watchlist`}
                  >
                    {busy ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          <div className="data-manager-empty">
            <strong>Your watchlist is empty.</strong>
            <span>Start with a ticker or company name in the field above.</span>
            <span className="data-manager-empty-hint">Mic works in the ticker field too.</span>
          </div>
        )}

      </section>
    );
  }

  return (
    <div className="watchlist-daily">
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
          <Link href="/manage?view=watchlist" className="brief-link">
            Add watchlist names →
          </Link>
        </div>
      ) : null}

      {loading || entries.length > 0 || children ? (
        <>
          <SurfaceSlicer
            label="Watchlist performance"
            options={PERFORMANCE_SLICES}
            activeId={performanceSlice}
            onChange={(id) => setPerformanceSlice(parsePerformanceSlice(id))}
            className="watchlist-performance-slicer"
          />
          <MarketMoversBoard
            title="Today’s move"
            headerAction={(
              <Link href="/manage?view=watchlist" className="data-edit-pill">
                Edit watchlist
              </Link>
            )}
            sessionLabel={watchlistSessionLabel}
            top={watchlistTop}
            bottom={watchlistBottom}
            columns={
              performanceSlice === "leaders"
                ? "top"
                : performanceSlice === "laggards"
                  ? "bottom"
                  : "both"
            }
            showWhenEmpty={entries.length > 0 || Boolean(children)}
            topEmptyLabel={watchlistEmptyLabel ?? "No gainers yet."}
            bottomEmptyLabel={watchlistEmptyLabel ?? "No losers yet."}
            footer={children}
          />
        </>
      ) : null}

    </div>
  );
}
