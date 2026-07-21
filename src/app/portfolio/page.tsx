"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPositions, upsertPosition, removePosition, savePositions, type PersistedPosition } from "@/lib/portfolio/persist";
import { computePortfolioMetrics, computePositionMetrics, getDailyContributors, computeConcentration, computeSectorAllocation } from "@/lib/portfolio/calculations";
import { getSectorForCompany } from "@/lib/market/industries";
import type { PortfolioPosition } from "@/lib/portfolio/types";
import type { StockQuote } from "@/lib/market/quotes";

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

function percent(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

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
  const concentration = useMemo(() => computeConcentration(weightMap, 15), [weightMap]);
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
  }

  function handleCancelEdit() {
    setEditingTicker(null);
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setFormError(null);
  }

  // ── Render ──

  return (
    <div>
      {/* ── Add / Edit Position Form ── */}
      <div className="portfolio-add-card">
        <h2 className="portfolio-add-title">{editingTicker ? "Edit Position" : "Add Position"}</h2>
        <form className="portfolio-add-form" onSubmit={handleAdd}>
          <div className="portfolio-add-field">
            <label className="portfolio-add-label" htmlFor="ticker">Ticker</label>
            <input
              id="ticker"
              className="portfolio-add-input"
              type="text"
              placeholder="AAPL"
              value={formTicker}
              onChange={(e) => setFormTicker(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={5}
              disabled={editingTicker != null}
            />
          </div>
          <div className="portfolio-add-field">
            <label className="portfolio-add-label" htmlFor="shares">Shares</label>
            <input
              id="shares"
              className="portfolio-add-input"
              type="number"
              placeholder="10"
              min="0"
              step="any"
              value={formShares}
              onChange={(e) => setFormShares(e.target.value)}
            />
          </div>
          <div className="portfolio-add-field">
            <label className="portfolio-add-label" htmlFor="cost">Avg Cost (optional)</label>
            <input
              id="cost"
              className="portfolio-add-input"
              type="number"
              placeholder="150.00"
              min="0"
              step="any"
              value={formCost}
              onChange={(e) => setFormCost(e.target.value)}
            />
          </div>
          <button type="submit" className="portfolio-add-btn">
            {editingTicker ? "Update" : "Add"}
          </button>
          {editingTicker && (
            <button type="button" className="portfolio-cancel-btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
        </form>
        {formError && <p className="portfolio-add-error">{formError}</p>}
      </div>

      {/* ── Empty state ── */}
      {!hasData && !loading && (
        <div className="portfolio-empty-state">
          <p className="portfolio-empty-text">No positions yet. Add one above to see your portfolio.</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ── Portfolio Summary ── */}
          <div className="portfolio-summary">
            <div className="portfolio-summary-card">
              <span className="portfolio-summary-label">Total Value</span>
              <strong className="portfolio-summary-value">{currency(portfolioMetrics.totalMarketValue)}</strong>
            </div>
            <div className="portfolio-summary-card">
              <span className="portfolio-summary-label">Daily Change</span>
              <strong className={`portfolio-summary-value ${(portfolioMetrics.dailyChange ?? 0) >= 0 ? "positive" : "negative"}`}>
                {currency(portfolioMetrics.dailyChange)}
                <span className="portfolio-summary-pct">{percent(portfolioMetrics.dailyChangePercent)}</span>
              </strong>
            </div>
            <div className="portfolio-summary-card">
              <span className="portfolio-summary-label">Positions</span>
              <strong className="portfolio-summary-value">{portfolioMetrics.positionCount}</strong>
            </div>
          </div>

          {/* ── Loading / Error / Refresh ── */}
          <div className="portfolio-toolbar">
            {loading && <span className="portfolio-loading">Loading prices…</span>}
            {error && <span className="portfolio-error">{error}</span>}
            <button className="portfolio-refresh-btn" onClick={handleRefresh} disabled={loading}>
              {loading ? "Loading…" : "Refresh Prices"}
            </button>
          </div>

          {/* ── Daily Contributors ── */}
          {contributors.positive.length > 0 || contributors.negative.length > 0 ? (
            <div className="portfolio-contributors">
              <div className="section-header">
                <h2 className="section-title">Today&apos;s Contributors</h2>
              </div>
              <div className="portfolio-contributor-grid">
                {contributors.positive.length > 0 && (
                  <div className="portfolio-contributor-group">
                    <h3 className="portfolio-contributor-heading positive">Largest Gains</h3>
                    {contributors.positive.slice(0, 3).map((c) => (
                      <div key={c.ticker} className="portfolio-contributor-row">
                        <span className="portfolio-contributor-ticker">{c.ticker}</span>
                        <span className="portfolio-contributor-value positive">{currency(c.dollarChange)}</span>
                        <span className="portfolio-contributor-pct positive">{percent(c.percentChange)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {contributors.negative.length > 0 && (
                  <div className="portfolio-contributor-group">
                    <h3 className="portfolio-contributor-heading negative">Largest Losses</h3>
                    {contributors.negative.slice(0, 3).map((c) => (
                      <div key={c.ticker} className="portfolio-contributor-row">
                        <span className="portfolio-contributor-ticker">{c.ticker}</span>
                        <span className="portfolio-contributor-value negative">{currency(c.dollarChange)}</span>
                        <span className="portfolio-contributor-pct negative">{percent(c.percentChange)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* ── Concentration ── */}
          <div className="portfolio-section">
            <div className="section-header">
              <h2 className="section-title">Concentration</h2>
            </div>
            <div className="portfolio-stat-grid">
              {concentration.largestPosition && (
                <div className="portfolio-stat-card">
                  <span className="portfolio-stat-label">Largest Position</span>
                  <strong className="portfolio-stat-value">
                    {concentration.largestPosition.ticker} — {concentration.largestPosition.weight.toFixed(1)}%
                  </strong>
                </div>
              )}
              <div className="portfolio-stat-card">
                <span className="portfolio-stat-label">Top 3 Holdings</span>
                <strong className="portfolio-stat-value">{concentration.topThreeWeight.toFixed(1)}%</strong>
              </div>
              <div className="portfolio-stat-card">
                <span className="portfolio-stat-label">Top 5 Holdings</span>
                <strong className="portfolio-stat-value">{concentration.topFiveWeight.toFixed(1)}%</strong>
              </div>
            </div>
            {concentration.positionsAboveThreshold.length > 0 && (
              <p className="portfolio-insight">
                {concentration.positionsAboveThreshold.length === 1
                  ? `${concentration.positionsAboveThreshold[0].ticker} exceeds the ${concentration.threshold}% concentration display threshold at ${concentration.positionsAboveThreshold[0].weight.toFixed(1)}%.`
                  : `${concentration.positionsAboveThreshold.map((p) => `${p.ticker} (${p.weight.toFixed(1)}%)`).join(", ")} exceed the ${concentration.threshold}% concentration display threshold.`}
              </p>
            )}
          </div>

          {/* ── Sector Allocation ── */}
          <div className="portfolio-section">
            <div className="section-header">
              <h2 className="section-title">Sector Allocation</h2>
            </div>
            {sectorAllocation.sectors.length > 0 ? (
              <div className="portfolio-sector-list">
                {sectorAllocation.sectors.map((s) => (
                  <div key={s.sector} className="portfolio-sector-row">
                    <span className="portfolio-sector-name">{s.sector}</span>
                    <div className="portfolio-sector-bar-wrap">
                      <div
                        className="portfolio-sector-bar"
                        style={{ width: `${Math.max(s.weight, 2)}%` }}
                      />
                    </div>
                    <span className="portfolio-sector-weight">{s.weight.toFixed(1)}%</span>
                    <span className="portfolio-sector-count">{s.positionCount} position{s.positionCount !== 1 ? "s" : ""}</span>
                  </div>
                ))}
                {sectorAllocation.unclassifiedPositionCount > 0 && (
                  <div className="portfolio-sector-row">
                    <span className="portfolio-sector-name">Unclassified</span>
                    <div className="portfolio-sector-bar-wrap">
                      <div
                        className="portfolio-sector-bar portfolio-sector-bar-unclassified"
                        style={{ width: `${Math.max(sectorAllocation.unclassifiedWeight, 2)}%` }}
                      />
                    </div>
                    <span className="portfolio-sector-weight">{sectorAllocation.unclassifiedWeight.toFixed(1)}%</span>
                    <span className="portfolio-sector-count">{sectorAllocation.unclassifiedPositionCount} position{sectorAllocation.unclassifiedPositionCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="portfolio-empty">Sector data not available.</p>
            )}
            {sectorAllocation.sectors.length > 0 && (
              <p className="portfolio-insight">
                The three largest sectors represent {sectorAllocation.sectors.slice(0, 3).reduce((s, sec) => s + sec.weight, 0).toFixed(0)}% of your portfolio.
              </p>
            )}
          </div>

          {/* ── Holdings Table ── */}
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Price</th>
                  <th>Change</th>
                  <th>Mkt Value</th>
                  <th>Alloc</th>
                  <th>Cost</th>
                  <th>Gain/Loss</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((pos) => {
                  const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
                  const dailyPct = pos.currentPrice != null && pos.previousClose != null
                    ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
                    : null;

                  return (
                    <tr key={pos.companyId}>
                      <td className="portfolio-cell-company">
                        <strong className="portfolio-ticker">{pos.companyId.toUpperCase()}</strong>
                        {pos.note && <span className="portfolio-name">{pos.note}</span>}
                      </td>
                      <td className="portfolio-cell-num">{pos.currentPrice != null ? currency(pos.currentPrice) : "—"}</td>
                      <td className={`portfolio-cell-num ${(dailyPct ?? 0) >= 0 ? "positive" : "negative"}`}>
                        {dailyPct != null ? percent(dailyPct) : "—"}
                      </td>
                      <td className="portfolio-cell-num">{metrics.marketValue != null ? currency(metrics.marketValue) : "—"}</td>
                      <td className="portfolio-cell-num">{metrics.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</td>
                      <td className="portfolio-cell-num">{metrics.totalCost != null ? currency(metrics.totalCost) : "—"}</td>
                      <td className={`portfolio-cell-num ${(metrics.totalGainLoss ?? 0) >= 0 ? "positive" : "negative"}`}>
                        {metrics.totalGainLoss != null ? currency(metrics.totalGainLoss) : "—"}
                      </td>
                      <td>
                        <div className="portfolio-row-actions">
                          <button className="portfolio-edit-btn" onClick={() => handleStartEdit(pos.companyId)} title="Edit shares/cost">✎</button>
                          <button className="portfolio-remove-btn" onClick={() => handleRemove(pos.companyId)} title="Remove position">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="portfolio-cards-mobile">
            {enriched.map((pos) => {
              const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
              const dailyPct = pos.currentPrice != null && pos.previousClose != null
                ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
                : null;

              return (
                <div key={pos.companyId} className="portfolio-card">
                  <div className="portfolio-card-header">
                    <div className="portfolio-card-company">
                      <strong className="portfolio-ticker">{pos.companyId.toUpperCase()}</strong>
                      {pos.note && <span className="portfolio-name">{pos.note}</span>}
                    </div>
                    <div className="portfolio-row-actions">
                      <button className="portfolio-edit-btn" onClick={() => handleStartEdit(pos.companyId)} title="Edit shares/cost">✎</button>
                      <button
                        className="portfolio-remove-btn"
                        onClick={() => handleRemove(pos.companyId)}
                        title="Remove position"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="portfolio-card-stats">
                    <div className="portfolio-card-stat">
                      <span className="portfolio-card-stat-label">Price</span>
                      <span className="portfolio-card-stat-value">{pos.currentPrice != null ? currency(pos.currentPrice) : "—"}</span>
                    </div>
                    <div className="portfolio-card-stat">
                      <span className="portfolio-card-stat-label">Daily</span>
                      <span className={`portfolio-card-stat-value ${(dailyPct ?? 0) >= 0 ? "positive" : "negative"}`}>
                        {dailyPct != null ? percent(dailyPct) : "—"}
                      </span>
                    </div>
                    <div className="portfolio-card-stat">
                      <span className="portfolio-card-stat-label">Alloc</span>
                      <span className="portfolio-card-stat-value">{metrics.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="portfolio-card-stat">
                      <span className="portfolio-card-stat-label">Value</span>
                      <span className="portfolio-card-stat-value">{metrics.marketValue != null ? currency(metrics.marketValue) : "—"}</span>
                    </div>
                  </div>
                  {metrics.totalGainLoss != null && (
                    <div className={`portfolio-card-gl ${metrics.totalGainLoss >= 0 ? "positive" : "negative"}`}>
                      {metrics.totalGainLoss >= 0 ? "+" : ""}{currency(metrics.totalGainLoss)}
                      {metrics.totalGainLossPercent != null ? ` (${metrics.totalGainLossPercent >= 0 ? "+" : ""}${metrics.totalGainLossPercent.toFixed(1)}%)` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Clear all ── */}
          {positions.length > 0 && (
            <div className="portfolio-clear-wrap">
              <button className="portfolio-clear-btn" onClick={handleClearAll}>
                Clear All Positions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}