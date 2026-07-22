"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPositions, upsertPosition, removePosition, savePositions, type PersistedPosition } from "@/lib/portfolio/persist";
import { computePortfolioMetrics, computePositionMetrics, getDailyContributors, computeConcentration, computeSectorAllocation } from "@/lib/portfolio/calculations";
import { getSectorForCompany } from "@/lib/market/industries";
import type { PortfolioPosition } from "@/lib/portfolio/types";
import type { StockQuote } from "@/lib/market/quotes";
import { getLogoUrl } from "@/lib/market/logos";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";

// ── Helpers ─────────────────────────────────────────────────────────────────

function currency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compactCurrency(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(1) + "K";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ── Color palette for allocation bar segments ────────────────────────────────

const SEGMENT_COLORS = [
  "#5eead4", "#2dd4bf", "#22d3ee", "#38bdf8", "#818cf8",
  "#a78bfa", "#c084fc", "#e879f9", "#fb7185", "#f87171",
  "#fb923c", "#fbbf24", "#a3e635", "#4ade80",
];

// ── Convert persisted positions to PortfolioPosition with live prices ───────

function enrichWithPrices(
  persisted: PersistedPosition[],
  quotes: StockQuote[],
): PortfolioPosition[] {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  return persisted.map((p) => {
    const ticker = p.ticker.toUpperCase();
    const quote = quoteMap.get(ticker);
    return {
      companyId: ticker,
      ticker,
      shares: p.shares,
      averageCost: p.averageCost,
      currentPrice: quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
      note: p.note,
    };
  });
}

function buildWeightMap(positions: PortfolioPosition[]) {
  const metrics = computePortfolioMetrics(positions);
  const total = metrics.totalMarketValue ?? 0;
  const map = new Map<string, { name: string; weight: number }>();

  for (const pos of positions) {
    const mv = pos.currentPrice != null ? pos.shares * pos.currentPrice : 0;
    const ticker = pos.companyId.toUpperCase();
    const weight = total > 0 ? (mv / total) * 100 : 0;
    map.set(ticker, { name: ticker, weight: round2(weight) });
  }

  return map;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Add form state ──
  const [formTicker, setFormTicker] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);

  // Load positions from localStorage on mount
  useEffect(() => {
    setPositions(loadPositions());
  }, []);

  // Fetch live quotes
  const fetchQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/market/quotes?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch quotes whenever positions change
  useEffect(() => {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    const unique = Array.from(new Set(tickers));
    if (unique.length > 0) {
      fetchQuotes(unique);
    } else {
      setQuotes([]);
      setLoading(false);
    }
  }, [positions, fetchQuotes]);

  // ── Derived data ──

  const enriched = useMemo(() => enrichWithPrices(positions, quotes), [positions, quotes]);
  const portfolioMetrics = useMemo(() => computePortfolioMetrics(enriched), [enriched]);
  const weightMap = useMemo(() => buildWeightMap(enriched), [enriched]);
  const sectorAllocation = useMemo(() => {
    const cmap = new Map<string, { id: string; ticker: string; name: string; assetType: "stock" | "etf" | "other"; sector?: string; industry?: string }>();
    for (const p of enriched) {
      const ticker = p.companyId.toUpperCase();
      if (cmap.has(ticker)) continue;
      const sector = getSectorForCompany(ticker);
      cmap.set(ticker, {
        id: ticker,
        ticker,
        name: ticker,
        assetType: "stock",
        sector: sector?.name,
        industry: undefined,
      });
    }
    return computeSectorAllocation(enriched, cmap);
  }, [enriched]);
  const contributors = useMemo(
    () => getDailyContributors(enriched, portfolioMetrics.dailyChange),
    [portfolioMetrics.dailyChange],
  );
  const hasData = enriched.length > 0;

  // ── Allocation bar data ──

  const allocationSegments = useMemo(() => {
    const total = portfolioMetrics.totalMarketValue ?? 0;
    if (total <= 0) return [];
    return enriched
      .map((pos, i) => {
        const mv = pos.currentPrice != null ? pos.shares * pos.currentPrice : 0;
        const w = total > 0 ? (mv / total) * 100 : 0;
        return {
          ticker: pos.companyId.toUpperCase(),
          weight: round2(w),
          color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [enriched, portfolioMetrics.totalMarketValue]);

  // ── Handlers ──

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ticker = formTicker.trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
      setFormError("Enter a valid ticker symbol (1–5 letters)");
      return;
    }

    const shares = parseFloat(formShares);
    if (isNaN(shares) || shares <= 0) {
      setFormError("Enter a valid number of shares");
      return;
    }

    const cost = formCost.trim() ? parseFloat(formCost) : undefined;
    if (cost !== undefined && (isNaN(cost) || cost <= 0)) {
      setFormError("Enter a valid average cost");
      return;
    }

    const updated = upsertPosition({ ticker, shares, averageCost: cost });
    setPositions(updated);
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setShowAddForm(false);
  }

  function handleRemove(ticker: string) {
    const updated = removePosition(ticker);
    setPositions(updated);
  }

  function handleRefresh() {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    fetchQuotes(Array.from(new Set(tickers)));
  }

  function handleClearAll() {
    savePositions([]);
    setPositions([]);
    setQuotes([]);
  }

  function handleStartEdit(ticker: string) {
    const pos = positions.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase());
    if (!pos) return;
    setFormTicker(pos.ticker);
    setFormShares(String(pos.shares));
    setFormCost(pos.averageCost != null ? String(pos.averageCost) : "");
    setEditingTicker(ticker);
    setFormError(null);
    setShowAddForm(true);
  }

  function handleCancelEdit() {
    setEditingTicker(null);
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setFormError(null);
    setShowAddForm(false);
  }

  // ── Render ──

  return (
    <div className="pf">
      {/* ── Empty state ── */}
      {!hasData && !loading && (
        <div className="pf-empty">
          <p className="pf-empty-text">No positions yet.</p>
          <button className="pf-add-toggle" onClick={() => setShowAddForm(true)}>
            + Add position
          </button>
          {showAddForm && (
            <div className="pf-add-form-wrap">
              <AddForm
                editingTicker={editingTicker}
                formTicker={formTicker}
                formShares={formShares}
                formCost={formCost}
                formError={formError}
                onTickerChange={setFormTicker}
                onSharesChange={setFormShares}
                onCostChange={setFormCost}
                onSubmit={handleAdd}
                onCancel={handleCancelEdit}
              />
            </div>
          )}
        </div>
      )}

      {hasData && (
        <>
          {/* ── Hero ── */}
          <div className="pf-hero">
            <span className="pf-hero-label">Portfolio</span>
            <div className="pf-hero-value">
              {currency(portfolioMetrics.totalMarketValue)}
              {(portfolioMetrics.dailyChange ?? null) !== null && (
                <span className={`pf-hero-change ${(portfolioMetrics.dailyChange ?? 0) >= 0 ? "up" : "down"}`}>
                  {currency(portfolioMetrics.dailyChange)}{" "}
                  {percent(portfolioMetrics.dailyChangePercent)}
                </span>
              )}
            </div>
          </div>

          {/* ── Loading / Error / Refresh ── */}
          <div className="pf-toolbar">
            {loading && <span className="pf-loading">Loading prices…</span>}
            {error && <span className="pf-error">{error}</span>}
            <button className="pf-refresh-btn" onClick={handleRefresh} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* ── Daily Contributors ── */}
          {contributors.positive.length > 0 || contributors.negative.length > 0 ? (
            <div className="pf-section">
              <h2 className="pf-section-title">Today&apos;s Biggest Movers</h2>
              <div className="pf-contrib-list">
                {[...contributors.positive, ...contributors.negative]
                  .sort((a, b) => Math.abs(b.dollarChange) - Math.abs(a.dollarChange))
                  .slice(0, 3)
                  .map((c) => (
                    <div key={c.ticker} className="pf-contrib-row">
                      <span className="pf-contrib-ticker">{c.ticker}</span>
                      <span className={`pf-contrib-dollar ${c.dollarChange >= 0 ? "up" : "down"}`}>
                        {currency(c.dollarChange)}
                      </span>
                      <span className={`pf-contrib-pct ${c.dollarChange >= 0 ? "up" : "down"}`}>
                        {percent(c.percentChange)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {/* ── Allocation Bar ── */}
          {allocationSegments.length > 0 && (
            <div className="pf-section">
              <h2 className="pf-section-title">Allocation</h2>
              <div className="pf-stacked-bar">
                {allocationSegments.map((seg) => (
                  <div
                    key={seg.ticker}
                    className="pf-stacked-bar-seg"
                    style={{
                      flex: seg.weight,
                      backgroundColor: seg.color,
                      minWidth: seg.weight > 0 ? 2 : 0,
                    }}
                    title={`${seg.ticker} ${seg.weight.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="pf-stacked-legend">
                {allocationSegments.map((seg) => (
                  <div key={seg.ticker} className="pf-stacked-legend-item">
                    <span className="pf-stacked-legend-dot" style={{ backgroundColor: seg.color }} />
                    <span className="pf-stacked-legend-ticker">{seg.ticker}</span>
                    <span className="pf-stacked-legend-weight">{seg.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sector Allocation (only when data exists) ── */}
          {sectorAllocation.sectors.length > 0 && (
            <div className="pf-section">
              <h2 className="pf-section-title">Sectors</h2>
              {sectorAllocation.sectors.map((s) => (
                <div key={s.sector} className="pf-sector-row">
                  <span className="pf-sector-name">{s.sector}</span>
                  <div className="pf-sector-bar-wrap">
                    <div className="pf-sector-bar" style={{ width: `${Math.max(s.weight, 2)}%` }} />
                  </div>
                  <span className="pf-sector-weight">{s.weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Positions header + add toggle ── */}
          <div className="pf-positions-header">
            <h2 className="pf-section-title">Positions</h2>
            <button className="pf-add-toggle" onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? "–" : "+"} Add position
            </button>
          </div>

          {/* ── Add / Edit Form (collapsible) ── */}
          {showAddForm && (
            <div className="pf-add-form-wrap">
              <AddForm
                editingTicker={editingTicker}
                formTicker={formTicker}
                formShares={formShares}
                formCost={formCost}
                formError={formError}
                onTickerChange={setFormTicker}
                onSharesChange={setFormShares}
                onCostChange={setFormCost}
                onSubmit={handleAdd}
                onCancel={handleCancelEdit}
              />
            </div>
          )}

          {/* ── Holdings Table ── */}
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="pf-num">Price</th>
                  <th className="pf-num">Chg</th>
                  <th className="pf-num">Value</th>
                  <th className="pf-num">Alloc</th>
                  <th className="pf-num">Cost</th>
                  <th className="pf-num">Gain/Loss</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((pos) => {
                  const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
                  const dailyPct = pos.currentPrice != null && pos.previousClose != null
                    ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
                    : null;
                  const logoUrl = getLogoUrl(pos.companyId);

                  return (
                    <tr key={pos.companyId}>
                      <td className="pf-cell-name">
                        <div className="pf-cell-name-inner">
                          {logoUrl && (
                            <img src={logoUrl} alt="" className="pf-logo" width={18} height={18} />
                          )}
                          <span className="pf-ticker">{pos.companyId.toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="pf-num">{pos.currentPrice != null ? compactCurrency(pos.currentPrice) : "—"}</td>
                      <td className={`pf-num ${(dailyPct ?? 0) >= 0 ? "up" : "down"}`}>
                        {dailyPct != null ? percent(dailyPct) : "—"}
                      </td>
                      <td className="pf-num">{metrics.marketValue != null ? compactCurrency(metrics.marketValue) : "—"}</td>
                      <td className="pf-num">{metrics.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</td>
                      <td className="pf-num">{metrics.totalCost != null ? compactCurrency(metrics.totalCost) : "—"}</td>
                      <td className={`pf-num ${(metrics.totalGainLoss ?? 0) >= 0 ? "up" : "down"}`}>
                        {metrics.totalGainLoss != null ? compactCurrency(metrics.totalGainLoss) : "—"}
                      </td>
                      <td className="pf-cell-actions">
                        <button className="pf-action-btn" onClick={() => handleStartEdit(pos.companyId)} title="Edit">✎</button>
                        <button className="pf-action-btn pf-action-remove" onClick={() => handleRemove(pos.companyId)} title="Remove">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="pf-cards-mobile">
            {enriched.map((pos) => {
              const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
              const dailyPct = pos.currentPrice != null && pos.previousClose != null
                ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
                : null;
              const logoUrl = getLogoUrl(pos.companyId);

              return (
                <div key={pos.companyId} className="pf-card">
                  <div className="pf-card-top">
                    <div className="pf-card-name">
                      {logoUrl && (
                        <img src={logoUrl} alt="" className="pf-logo" width={18} height={18} />
                      )}
                      <span className="pf-ticker">{pos.companyId.toUpperCase()}</span>
                    </div>
                    <div className="pf-card-actions">
                      <button className="pf-action-btn" onClick={() => handleStartEdit(pos.companyId)}>✎</button>
                      <button className="pf-action-btn pf-action-remove" onClick={() => handleRemove(pos.companyId)}>✕</button>
                    </div>
                  </div>
                  <div className="pf-card-stats">
                    <div className="pf-card-stat">
                      <span className="pf-card-stat-label">Price</span>
                      <span className="pf-card-stat-value">{pos.currentPrice != null ? compactCurrency(pos.currentPrice) : "—"}</span>
                    </div>
                    <div className="pf-card-stat">
                      <span className="pf-card-stat-label">Daily</span>
                      <span className={`pf-card-stat-value ${(dailyPct ?? 0) >= 0 ? "up" : "down"}`}>
                        {dailyPct != null ? percent(dailyPct) : "—"}
                      </span>
                    </div>
                    <div className="pf-card-stat">
                      <span className="pf-card-stat-label">Alloc</span>
                      <span className="pf-card-stat-value">{metrics.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="pf-card-stat">
                      <span className="pf-card-stat-label">Value</span>
                      <span className="pf-card-stat-value">{metrics.marketValue != null ? compactCurrency(metrics.marketValue) : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Clear all ── */}
          {positions.length > 0 && (
            <div className="pf-clear-wrap">
              <button className="pf-clear-btn" onClick={handleClearAll}>Clear All</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Add Form Sub-component ──────────────────────────────────────────────────

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

function AddForm({
  editingTicker,
  formTicker,
  formShares,
  formCost,
  formError,
  onTickerChange,
  onSharesChange,
  onCostChange,
  onSubmit,
  onCancel,
}: {
  editingTicker: string | null;
  formTicker: string;
  formShares: string;
  formCost: string;
  formError: string | null;
  onTickerChange: (v: string) => void;
  onSharesChange: (v: string) => void;
  onCostChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  // Type-ahead state
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "results" | "empty">("idle");
  const suggestCacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const applySuggestions = (next: CompanySuggestion[]) => {
    setSuggestions(next);
    setSuggestStatus(next.length > 0 ? "results" : "empty");
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  };

  // Debounced type-ahead search
  useEffect(() => {
    const query = formTicker.trim();
    if (query.length < 1 || editingTicker != null) {
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
  }, [formTicker, editingTicker]);

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
        const s = suggestions[activeSuggestion];
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveSuggestion(-1);
        setSuggestStatus("idle");
        onTickerChange(s.ticker);
        return;
      }
    }
  };

  return (
    <form className="pf-add-form" onSubmit={onSubmit}>
      <div className="pf-add-field" style={{ position: "relative" }}>
        <label className="pf-add-label">Ticker</label>
        <input
          className="pf-add-input"
          type="text"
          placeholder="AAPL"
          value={formTicker}
          onChange={(e) => onTickerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 120); }}
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          disabled={editingTicker != null}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
        />
        {showSuggestions && suggestStatus === "results" && suggestions.length > 0 ? (
          <ul className="ticker-suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={`${s.ticker}-${s.cik}`}
                role="option"
                aria-selected={i === activeSuggestion}
                className={`ticker-suggestion ${i === activeSuggestion ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowSuggestions(false);
                  setSuggestions([]);
                  setActiveSuggestion(-1);
                  setSuggestStatus("idle");
                  onTickerChange(s.ticker);
                }}
                onMouseEnter={() => setActiveSuggestion(i)}
              >
                <span className="ticker-suggestion-ticker">{highlightMatch(s.ticker, formTicker)}</span>
                <span className="ticker-suggestion-name">{highlightMatch(s.name, formTicker)}</span>
              </li>
            ))}
          </ul>
        ) : showSuggestions && suggestStatus === "empty" ? (
          <div className="ticker-suggestions ticker-suggestions-empty">
            No matches
          </div>
        ) : null}
      </div>
      <div className="pf-add-field">
        <label className="pf-add-label">Shares</label>
        <input
          className="pf-add-input"
          type="number"
          placeholder="10"
          min="0"
          step="any"
          value={formShares}
          onChange={(e) => onSharesChange(e.target.value)}
        />
      </div>
      <div className="pf-add-field">
        <label className="pf-add-label">Avg Cost</label>
        <input
          className="pf-add-input"
          type="number"
          placeholder="150.00"
          min="0"
          step="any"
          value={formCost}
          onChange={(e) => onCostChange(e.target.value)}
        />
      </div>
      <div className="pf-add-actions">
        <button type="submit" className="pf-add-btn">
          {editingTicker ? "Update" : "Add"}
        </button>
        <button type="button" className="pf-add-cancel" onClick={onCancel}>Cancel</button>
      </div>
      {formError && <p className="pf-add-error">{formError}</p>}
    </form>
  );
}