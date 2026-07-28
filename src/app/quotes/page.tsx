"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import { fmtPrice, fmtPercent, fmtCompactCurrency, isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { GaugeRing } from "@/components/GaugeRing";
import { NewsDriverBrief } from "@/app/components/NewsDriverBrief";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import {
  rangePosition,
  scoreInstitutionalConviction,
  volumeVsAverage,
  type ConvictionRingScore,
} from "@/lib/market/quote-gauges";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

interface BrowserWatchlistEntry {
  ticker: string;
  companyName: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
}

interface QuoteResult {
  quote: StockQuote;
  companyName: string;
  headlines: Array<{ headline: string; url: string | null; date: string }>;
  driver: NewsDriver | null;
  averageVolume: number | null;
  conviction: ConvictionRingScore;
}

function readBrowserWatchlist(): BrowserWatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is BrowserWatchlistEntry =>
      typeof entry?.ticker === "string" &&
      typeof entry?.companyName === "string" &&
      typeof entry?.addedAt === "string" &&
      ["active", "unsupported", "error"].includes(entry?.status),
    );
  } catch {
    return [];
  }
}

function writeBrowserWatchlist(entries: BrowserWatchlistEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // best-effort
  }
}

function marketStateLabel(state: string | null): string {
  if (state === "PRE") return "PRE-MARKET";
  if (state === "POST" || state === "POSTPOST") return "AFTER HOURS";
  if (state === "REGULAR") return "MARKET OPEN";
  return "MARKET CLOSED";
}

function formatRange(low: number | null, high: number | null): string {
  if (!isFiniteNumber(low) || !isFiniteNumber(high)) return "—";
  return `$${fmtPrice(low)}—$${fmtPrice(high)}`;
}

function toneForRange(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 70) return "green";
  if (pct <= 30) return "red";
  return "amber";
}

function toneForVolume(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 100) return "green";
  if (pct >= 70) return "amber";
  return "red";
}

export default function QuotesPage() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [convictionLoading, setConvictionLoading] = useState(false);
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [addingTicker, setAddingTicker] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "results" | "empty">("idle");
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestCacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function loadWatchlist() {
      try {
        const data = await fetchJsonWithTimeout<{
          authenticated?: boolean;
          entries?: BrowserWatchlistEntry[];
          guestEntries?: BrowserWatchlistEntry[];
        }>("/api/watchlist", 8_000);
        if (cancelled) return;
        const entries = data.authenticated
          ? data.entries ?? []
          : data.guestEntries ?? data.entries ?? readBrowserWatchlist();
        setTrackedTickers(new Set(entries.map((entry) => entry.ticker)));
      } catch {
        if (!cancelled) {
          setTrackedTickers(new Set(readBrowserWatchlist().map((entry) => entry.ticker)));
        }
      }
    }
    void loadWatchlist();
    return () => { cancelled = true; };
  }, []);

  const handleTrack = useCallback(async () => {
    if (!result) return;
    const ticker = result.quote.ticker;
    setWatchlistMessage(null);
    setAddingTicker(true);
    try {
      const response = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await response.json();
      if (!data.success) {
        setWatchlistMessage(data.error || `Could not add ${ticker}`);
        return;
      }
      setTrackedTickers((current) => new Set([...current, data.added?.ticker ?? ticker]));
      if (data.persistence === "browser" && data.added) {
        const currentEntries = readBrowserWatchlist();
        writeBrowserWatchlist([
          ...currentEntries.filter((entry) => entry.ticker !== data.added.ticker),
          data.added as BrowserWatchlistEntry,
        ]);
      }
      setWatchlistMessage(`${ticker} added to Watchlist`);
    } catch {
      setWatchlistMessage(`Could not add ${ticker}`);
    } finally {
      setAddingTicker(false);
    }
  }, [result]);

  const handleUntrack = useCallback(async () => {
    if (!result) return;
    const ticker = result.quote.ticker;
    setTrackedTickers((current) => {
      const next = new Set(current);
      next.delete(ticker);
      return next;
    });
    writeBrowserWatchlist(readBrowserWatchlist().filter((entry) => entry.ticker !== ticker));
    setWatchlistMessage(`${ticker} removed from Watchlist`);
    try {
      await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    } catch {
      // optimistic local remove already applied
    }
  }, [result]);

  const lookupTicker = useCallback(async (ticker: string, companyNameHint?: string) => {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);
    setConvictionLoading(true);
    setWatchlistMessage(null);

    try {
      const [quoteRes, newsRes, shortRes] = await Promise.all([
        fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(cleaned)}`,
          8_000,
        ),
        fetchJsonWithTimeout<{
          news?: Record<string, { headlines?: Array<{ headline: string; url: string | null; date: string }>; driver?: NewsDriver | null }>;
        }>(
          `/api/evidence/news-batch?tickers=${encodeURIComponent(cleaned)}`,
          10_000,
        ).catch(() => ({ news: {} })),
        fetchJsonWithTimeout<{
          status?: string;
          latest?: { averageDailyVolume?: number } | null;
        }>(
          `/api/market/short-interest?ticker=${encodeURIComponent(cleaned)}`,
          8_000,
        ).catch(() => ({ status: "empty", latest: null })),
      ]);

      const quote = quoteRes.quotes?.[0];
      if (!quote) {
        setError(`No quote data found for "${cleaned}".`);
        setLoading(false);
        setConvictionLoading(false);
        return;
      }

      const newsMap = (newsRes.news ?? {}) as Record<
        string,
        { headlines?: Array<{ headline: string; url: string | null; date: string }>; driver?: NewsDriver | null }
      >;
      const news = newsMap[cleaned];
      const averageVolume =
        shortRes.status === "success" && isFiniteNumber(shortRes.latest?.averageDailyVolume)
          ? shortRes.latest!.averageDailyVolume!
          : null;

      const companyName = companyNameHint || quote.name || cleaned;

      setResult({
        quote,
        companyName,
        headlines: news?.headlines ?? [],
        driver: news?.driver ?? null,
        averageVolume,
        conviction: {
          score: null,
          tone: "neutral",
          label: "Unavailable",
          detail: "Loading institutional filings…",
          added: 0,
          reduced: 0,
          newPositions: 0,
          filingQuarter: null,
        },
      });
      setLoading(false);

      // Institutional 13F can be slow — load after the quote shell paints.
      try {
        const inst = await fetchJsonWithTimeout<{
          results?: InstitutionalAccumulation[];
          status?: string;
        }>(
          `/api/evidence/institutional?ticker=${encodeURIComponent(cleaned)}`,
          22_000,
        );
        const conviction = scoreInstitutionalConviction(inst.results ?? []);
        setResult((current) =>
          current && current.quote.ticker === cleaned
            ? { ...current, conviction }
            : current,
        );
      } catch {
        setResult((current) =>
          current && current.quote.ticker === cleaned
            ? {
                ...current,
                conviction: {
                  score: null,
                  tone: "neutral",
                  label: "Unavailable",
                  detail: "Institutional filings could not be loaded.",
                  added: 0,
                  reduced: 0,
                  newPositions: 0,
                  filingQuarter: null,
                },
              }
            : current,
        );
      } finally {
        setConvictionLoading(false);
      }
    } catch {
      setError("Failed to load data. Check the ticker and try again.");
      setLoading(false);
      setConvictionLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupTicker(input);
  };

  const handleSelectSuggestion = (suggestion: CompanySuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestStatus("idle");
    setInput("");
    void lookupTicker(suggestion.ticker, suggestion.name);
  };

  useEffect(() => {
    const query = input.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      setSuggestStatus("idle");
      return;
    }

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
        // Type-ahead is best-effort
      }
    }, 150);

    return () => {
      controller.abort();
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [input]);

  const applySuggestions = (next: CompanySuggestion[]) => {
    setSuggestions(next);
    setSuggestStatus(next.length > 0 ? "results" : "empty");
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  const live = result ? getLivePrice(result.quote) : null;
  const changeClass = live && isFiniteNumber(live.change)
    ? (live.change >= 0 ? "up" : "down")
    : "neutral";
  const arrow = live && isFiniteNumber(live.change)
    ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
    : null;

  const dayPct = result
    ? rangePosition(live?.price ?? result.quote.price, result.quote.dayLow, result.quote.dayHigh)
    : null;
  const weekPct = result
    ? rangePosition(
        live?.price ?? result.quote.price,
        result.quote.fiftyTwoWeekLow,
        result.quote.fiftyTwoWeekHigh,
      )
    : null;
  const volumePct = result
    ? volumeVsAverage(result.quote.volume, result.averageVolume)
    : null;
  const isTracked = result ? trackedTickers.has(result.quote.ticker) : false;

  return (
    <div>
      <form onSubmit={handleSubmit} className="market-lookup-form">
        <div className="market-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 120); }}
            placeholder="Enter ticker (e.g. AAPL, NVDA, SCHD)"
            disabled={loading}
            className="market-input"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            autoComplete="off"
          />
          {showSuggestions && suggestStatus === "results" && suggestions.length > 0 ? (
            <ul className="ticker-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.ticker}-${s.cik || s.name}`}
                  role="option"
                  aria-selected={i === activeSuggestion}
                  className={`ticker-suggestion ${i === activeSuggestion ? "active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                >
                  <span className="ticker-suggestion-ticker">{s.ticker}</span>
                  <span className="ticker-suggestion-name">{s.name}</span>
                </li>
              ))}
            </ul>
          ) : showSuggestions && suggestStatus === "empty" ? (
            <div className="ticker-suggestions ticker-suggestions-empty">
              No matches — press Enter to look up anyway
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="market-lookup-button"
        >
          {loading ? "Loading..." : "Look up"}
        </button>
      </form>

      {loading ? (
        <PageLoadingMotion label="Loading quote" />
      ) : error ? (
        <div className="market-error">
          <p>{error}</p>
        </div>
      ) : result ? (
        <div className="quote-page">
          {/* ── Header ── */}
          <header className="quote-header">
            <div className="quote-header-top">
              <span className="quote-eyebrow">Quotes · Quote</span>
              <span className="quote-session-badge">
                {marketStateLabel(result.quote.marketState)}
              </span>
            </div>

            <div className="quote-identity-row">
              <LogoDisplay ticker={result.quote.ticker} size="detail" />
              <div className="quote-identity">
                <h1 className="quote-ticker">{result.quote.ticker}</h1>
                <p className="quote-company">
                  {result.companyName}
                  {result.quote.exchange ? ` · ${result.quote.exchange}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={`quote-track-button${isTracked ? " tracked" : ""}`}
                disabled={addingTicker}
                onClick={() => {
                  if (isTracked) void handleUntrack();
                  else void handleTrack();
                }}
              >
                {addingTicker ? "Saving…" : isTracked ? "Tracked" : "Add to Watchlist"}
              </button>
            </div>

            {watchlistMessage ? (
              <p className="quote-track-message">{watchlistMessage}</p>
            ) : null}

            <div className="quote-price-row">
              <div className="quote-price-block">
                <span className="quote-price">
                  {live?.price != null ? `$${fmtPrice(live.price)}` : "—"}
                </span>
                <span className={`quote-change ${changeClass}`}>
                  {arrow ? <span className="quote-change-arrow">{arrow}</span> : null}
                  {live && isFiniteNumber(live.change) && isFiniteNumber(live.changePercent)
                    ? `${live.change >= 0 ? "+" : ""}$${Math.abs(live.change).toFixed(2)} (${fmtPercent(live.changePercent)})`
                    : "—"}
                </span>
                {live?.label ? (
                  <span className="quote-session-note">
                    {live.label}
                    {isFiniteNumber(result.quote.price)
                      ? ` · Close $${fmtPrice(result.quote.price)}`
                      : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </header>

          {/* ── Chart with range tabs ── */}
          <section className="quote-card quote-chart-card" aria-label="Price chart">
            <PriceTrendCard
              key={result.quote.ticker}
              ticker={result.quote.ticker}
              showQuote={false}
            />
          </section>

          {/* ── Signal gauges ── */}
          <section className="quote-card" aria-label="Signal gauges">
            <div className="quote-card-header">
              <span className="quote-card-eyebrow">Signal gauges</span>
            </div>
            <div className="quote-signal-gauges">
              <GaugeRing
                value={dayPct}
                label={dayPct !== null ? `${Math.round(dayPct)}%` : "—"}
                detail={formatRange(result.quote.dayLow, result.quote.dayHigh)}
                caption="Day range"
                tone={toneForRange(dayPct)}
              />
              <GaugeRing
                value={weekPct}
                label={weekPct !== null ? `${Math.round(weekPct)}%` : "—"}
                detail={formatRange(result.quote.fiftyTwoWeekLow, result.quote.fiftyTwoWeekHigh)}
                caption="52-week range"
                tone={toneForRange(weekPct)}
              />
              <GaugeRing
                value={volumePct !== null ? Math.min(100, volumePct) : null}
                label={volumePct !== null ? `${Math.round(volumePct)}%` : "—"}
                detail={result.averageVolume ? "vs avg volume" : "Avg unavailable"}
                caption="Volume"
                tone={toneForVolume(volumePct)}
              />
            </div>
          </section>

          {/* ── Institutional conviction ── */}
          <section className="quote-card quote-conviction-card" aria-label="Institutional conviction">
            <div className="quote-card-header">
              <span className="quote-card-title">Institutional conviction</span>
              <span className="quote-card-meta">
                {result.conviction.filingQuarter
                  ? `${result.conviction.filingQuarter} 13F FILINGS`
                  : "13F FILINGS"}
              </span>
            </div>

            <div className="quote-conviction-ring-wrap">
              <GaugeRing
                size="lg"
                value={result.conviction.score}
                label={
                  convictionLoading
                    ? "…"
                    : result.conviction.score !== null
                      ? String(result.conviction.score)
                      : "—"
                }
                sublabel={
                  convictionLoading
                    ? "LOADING"
                    : result.conviction.label.toUpperCase()
                }
                caption=""
                tone={result.conviction.tone}
                ariaLabel={`Institutional conviction ${result.conviction.score ?? "unavailable"}: ${result.conviction.label}`}
              />
            </div>

            <div className="quote-conviction-legend" aria-hidden="true">
              <span><i className="quote-dot red" /> Distribution</span>
              <span><i className="quote-dot amber" /> Holding</span>
              <span><i className="quote-dot green" /> Accumulating</span>
            </div>

            <div className="quote-conviction-stats">
              <div className="quote-stat">
                <strong className="up">{result.conviction.added}</strong>
                <span>Institutions added</span>
              </div>
              <div className="quote-stat">
                <strong className="down">{result.conviction.reduced}</strong>
                <span>Institutions reduced</span>
              </div>
              <div className="quote-stat">
                <strong className="teal">{result.conviction.newPositions}</strong>
                <span>New positions</span>
              </div>
            </div>
          </section>

          {/* ── Numbers card ── */}
          <section className="quote-card" aria-label="Quote details">
            <div className="quote-card-header">
              <span className="quote-card-eyebrow">Quote details</span>
            </div>
            <div className="quote-details-grid">
              <div className="quote-detail">
                <span className="quote-detail-label">Previous close</span>
                <span className="quote-detail-value">
                  {isFiniteNumber(result.quote.previousClose)
                    ? `$${fmtPrice(result.quote.previousClose)}`
                    : "—"}
                </span>
              </div>
              <div className="quote-detail">
                <span className="quote-detail-label">Volume</span>
                <span className="quote-detail-value">
                  {isFiniteNumber(result.quote.volume)
                    ? result.quote.volume.toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="quote-detail">
                <span className="quote-detail-label">Market cap</span>
                <span className="quote-detail-value">
                  {fmtCompactCurrency(result.quote.marketCap)}
                </span>
              </div>
              <div className="quote-detail">
                <span className="quote-detail-label">Day range</span>
                <span className="quote-detail-value">
                  {formatRange(result.quote.dayLow, result.quote.dayHigh)}
                </span>
              </div>
              <div className="quote-detail">
                <span className="quote-detail-label">52-week range</span>
                <span className="quote-detail-value">
                  {formatRange(result.quote.fiftyTwoWeekLow, result.quote.fiftyTwoWeekHigh)}
                </span>
              </div>
              <div className="quote-detail">
                <span className="quote-detail-label">Currency</span>
                <span className="quote-detail-value">
                  {result.quote.currency ?? "—"}
                </span>
              </div>
            </div>
          </section>

          {/* ── News ── */}
          <section className="quote-card" aria-label="News and context">
            <div className="quote-card-header">
              <span className="quote-card-title">News &amp; context</span>
            </div>
            <NewsDriverBrief
              ticker={result.quote.ticker}
              driver={result.driver}
              headlines={result.headlines}
            />
            {result.headlines.length > 0 ? (
              <ul className="market-news-list">
                {result.headlines.map((item, i) => (
                  <li key={i} className="market-news-item">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="market-news-link"
                      >
                        {item.headline}
                      </a>
                    ) : (
                      <span className="market-news-text">{item.headline}</span>
                    )}
                    {item.date ? (
                      <span className="market-news-date">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="market-empty">
          <p>Enter a ticker to see range gauges, volume, and institutional conviction.</p>
        </div>
      )}
    </div>
  );
}
