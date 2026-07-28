"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import { fmtPrice, fmtPercent, fmtCompactCurrency, isFiniteNumber } from "@/lib/display/format";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { NewsDriverBrief } from "@/app/components/NewsDriverBrief";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";

interface QuoteResult {
  quote: StockQuote;
  headlines: Array<{ headline: string; url: string | null; date: string }>;
  driver: NewsDriver | null;
}

export default function MarketsPage() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);

  // Type-ahead suggestion state
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "results" | "empty">("idle");
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestCacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());

  // Load quote + news for a ticker
  const lookupTicker = useCallback(async (ticker: string) => {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);

    try {
      const quoteRes = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
        `/api/market/quotes?tickers=${encodeURIComponent(cleaned)}`,
        8_000,
      );
      const quote = quoteRes.quotes?.[0];
      if (!quote) {
        setError(`No quote data found for "${cleaned}".`);
        setLoading(false);
        return;
      }

      const newsRes = await fetchJsonWithTimeout<{
        news?: Record<string, { headlines?: Array<{ headline: string; url: string | null; date: string }>; driver?: NewsDriver | null }>;
      }>(
        `/api/evidence/news-batch?tickers=${encodeURIComponent(cleaned)}`,
        10_000,
      );

      const news = newsRes.news?.[cleaned];
      setResult({
        quote,
        headlines: news?.headlines ?? [],
        driver: news?.driver ?? null,
      });
    } catch {
      setError("Failed to load data. Check the ticker and try again.");
    } finally {
      setLoading(false);
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
    void lookupTicker(suggestion.ticker);
  };

  // Debounced type-ahead search
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
  const arrow = live?.change !== null && live !== null
    ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
    : null;

  return (
    <div>
      <div className="page-purpose">
        <span className="page-purpose-eyebrow">Markets</span>
        <h2 className="page-purpose-title">Look up a quote, see what&rsquo;s moving.</h2>
      </div>

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
            placeholder="Enter ticker (e.g. AAPL, NVDA, SPY)"
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
                  key={`${s.ticker}-${s.cik}`}
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
        <PageLoadingMotion label="Loading market data" />
      ) : error ? (
        <div className="market-error">
          <p>{error}</p>
        </div>
      ) : result ? (
        <div className="market-result">
          {/* ── Quote card ── */}
          <div className="market-quote-card">
            <div className="market-quote-header">
              <div>
                <strong className="market-quote-ticker">{result.quote.ticker}</strong>
                {result.quote.marketState && (
                  <span className="market-quote-state">{result.quote.marketState}</span>
                )}
              </div>
            </div>

            <div className="market-quote-price-area">
              <span className={`market-quote-price ${changeClass}`}>
                {live?.price != null ? `$${fmtPrice(live.price)}` : "—"}
              </span>
              {arrow && (
                <span className={`market-quote-arrow ${changeClass}`}>{arrow}</span>
              )}
              <span className={`market-quote-change ${changeClass}`}>
                {live && isFiniteNumber(live.change) && isFiniteNumber(live.changePercent)
                  ? `${live.change >= 0 ? "+" : ""}$${Math.abs(live.change).toFixed(2)} (${fmtPercent(live.changePercent)})`
                  : "—"}
              </span>
            </div>

            {live?.label && (
              <div className="market-quote-session">
                <span className="market-quote-session-badge">{live.label}</span>
                {isFiniteNumber(result.quote.price) && (
                  <span className="market-quote-session-close">
                    Close: ${fmtPrice(result.quote.price)}
                  </span>
                )}
              </div>
            )}

            <div className="market-quote-details">
              {isFiniteNumber(result.quote.previousClose) && (
                <div className="market-quote-detail">
                  <span className="market-quote-detail-label">Previous close</span>
                  <span className="market-quote-detail-value">${fmtPrice(result.quote.previousClose!)}</span>
                </div>
              )}
              {isFiniteNumber(result.quote.volume) && (
                <div className="market-quote-detail">
                  <span className="market-quote-detail-label">Volume</span>
                  <span className="market-quote-detail-value">{result.quote.volume!.toLocaleString()}</span>
                </div>
              )}
              {isFiniteNumber(result.quote.marketCap) && (
                <div className="market-quote-detail">
                  <span className="market-quote-detail-label">Market cap</span>
                  <span className="market-quote-detail-value">{fmtCompactCurrency(result.quote.marketCap)}</span>
                </div>
              )}
              {result.quote.currency && (
                <div className="market-quote-detail">
                  <span className="market-quote-detail-label">Currency</span>
                  <span className="market-quote-detail-value">{result.quote.currency}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── News section ── */}
          <div className="market-news-section">
            <h3 className="market-news-heading">News &amp; context</h3>
            <NewsDriverBrief
              ticker={result.quote.ticker}
              driver={result.driver}
              headlines={result.headlines}
            />

            {result.headlines.length > 0 && (
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
                    {item.date && (
                      <span className="market-news-date">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="market-empty">
          <p>Enter a ticker above to pull up the current quote and headlines.</p>
        </div>
      )}
    </div>
  );
}
