"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPositions, upsertPosition, removePosition, savePositions, type PersistedPosition } from "@/lib/portfolio/persist";
import {
  computePortfolioMetrics,
  computePositionMetrics,
  computeSectorAllocation,
  computeRiskFlags,
} from "@/lib/portfolio/calculations";
import type { PortfolioPosition, PortfolioRiskFlags } from "@/lib/portfolio/types";
import type { StockQuote } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { fetchConvictionScores } from "@/app/components/fetch-conviction-score";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import SectorDonut from "@/components/SectorDonut";
import { isFiniteNumber } from "@/lib/display/format";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { StockHeatmap } from "@/components/StockHeatmap";
import { PortfolioHoldingCard } from "@/components/PortfolioHoldingCard";
import { notifyPortfolioChanged, usePortfolioData } from "@/components/PortfolioData";
import { MacroChainChart, buildMacroSeriesFromQuotes } from "@/components/market/MacroChainChart";
import { SplitFlapMetric } from "@/app/components/SplitFlapMetric";

// ── Helpers ─────────────────────────────────────────────────────────────────

function currency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function signedCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  return `${value > 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compactCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(value) >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "K";
  }
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function weightPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value.toFixed(0)}%`;
}

// ── Sort types ──────────────────────────────────────────────────────────────

type SortKey = "ticker" | "value" | "weight" | "dayGl" | "totalGl";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
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
    const live = quote ? getLivePrice(quote) : null;
    return {
      companyId: ticker,
      ticker,
      shares: p.shares,
      averageCost: p.averageCost,
      // Mark to live session price so hero / day P&L track premarket & AH.
      currentPrice: live?.price ?? quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
      note: p.note,
    };
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Portfolio({
  hideHero = false,
  composeFirst = false,
}: {
  hideHero?: boolean;
  /** Keep Add position open under portfolio value / above holdings. */
  composeFirst?: boolean;
}) {
  const { quotes, data: sharedData, refresh: refreshSharedQuotes } = usePortfolioData();
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [sectorProfiles, setSectorProfiles] = useState<Record<string, { sector: string | null; marketCap: number | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(composeFirst);
  const [sort, setSort] = useState<SortState>({ key: "value", dir: "desc" });
  // Track whether data has ever loaded successfully (for data-quality states)
  const [quotesEverLoaded, setQuotesEverLoaded] = useState(false);

  // ── Add form state ──
  const [formTicker, setFormTicker] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [convictionScores, setConvictionScores] = useState<Record<string, ConvictionScoreView>>({});
  const [pendingScores, setPendingScores] = useState<Record<string, true>>({});

  // Load positions from localStorage on mount
  useEffect(() => {
    setPositions(loadPositions());
  }, []);

  const convictionTickerKey = positions.map((position) => position.ticker).join(",");

  useEffect(() => {
    if (!convictionTickerKey) {
      setConvictionScores({});
      setPendingScores({});
      return;
    }
    let cancelled = false;
    const tickers = convictionTickerKey.split(",").filter(Boolean);
    const initialPending: Record<string, true> = {};
    for (const ticker of tickers) initialPending[ticker] = true;
    setPendingScores(initialPending);

    async function loadConvictionScores() {
      await fetchConvictionScores(tickers, undefined, (partial, settled) => {
        if (cancelled) return;
        setConvictionScores((prev) => ({ ...prev, ...partial }));
        if (settled) {
          setPendingScores((prev) => {
            if (!prev[settled.ticker]) return prev;
            const next = { ...prev };
            delete next[settled.ticker];
            return next;
          });
        }
      });
      if (!cancelled) setPendingScores({});
    }

    void loadConvictionScores();
    return () => {
      cancelled = true;
    };
  }, [convictionTickerKey]);

  // Share quotes from PortfolioDataProvider (one Yahoo fan-out for hero + holdings).
  useEffect(() => {
    if (sharedData.loading) {
      setLoading(true);
      return;
    }
    setLoading(false);
    if (quotes.length > 0) setQuotesEverLoaded(true);
    if (sharedData.error) setError(sharedData.error);
    else setError(null);
  }, [quotes, sharedData.loading, sharedData.error]);

  // Sector profiles only (quotes come from shared provider)
  const fetchSectorProfiles = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setSectorProfiles({});
      return;
    }
    try {
      const profileRes = await fetch(`/api/market/sector-profile?tickers=${tickers.join(",")}`);
      if (!profileRes.ok) return;
      const profileData = await profileRes.json();
      const profileMap: Record<string, { sector: string | null; marketCap: number | null }> = {};
      for (const p of (profileData.profiles ?? [])) {
        profileMap[p.ticker] = { sector: p.sector, marketCap: p.marketCap };
      }
      setSectorProfiles(profileMap);
    } catch {
      // Sector labels are optional enrichment.
    }
  }, []);

  // Fetch sector profiles whenever positions change
  useEffect(() => {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    const unique = Array.from(new Set(tickers));
    void fetchSectorProfiles(unique);
  }, [positions, fetchSectorProfiles]);

  // ── Derived data ──

  const enriched = useMemo(() => enrichWithPrices(positions, quotes), [positions, quotes]);
  const portfolioMetrics = useMemo(() => computePortfolioMetrics(enriched), [enriched]);
  const sectorAllocation = useMemo(() => {
    const cmap = new Map<string, { id: string; ticker: string; name: string; assetType: "stock" | "etf" | "other"; sector?: string; industry?: string }>();
    for (const p of enriched) {
      const ticker = p.companyId.toUpperCase();
      if (cmap.has(ticker)) continue;
      const profile = sectorProfiles[ticker];
      cmap.set(ticker, {
        id: ticker,
        ticker,
        name: ticker,
        assetType: "stock",
        sector: profile?.sector ?? undefined,
        industry: undefined,
      });
    }
    return computeSectorAllocation(enriched, cmap);
  }, [enriched, sectorProfiles]);
  const sectorDonutData = useMemo(() => {
    if (sectorAllocation.unclassifiedWeight <= 0) {
      return sectorAllocation.sectors;
    }

    return [
      ...sectorAllocation.sectors,
      {
        sector: "Other",
        weight: sectorAllocation.unclassifiedWeight,
        marketValue: sectorAllocation.unclassifiedMarketValue,
        positionCount: sectorAllocation.unclassifiedPositionCount,
      },
    ];
  }, [sectorAllocation]);
  const hasData = enriched.length > 0;

  // ── Portfolio Intelligence V1 derived data ──

  const riskFlags = useMemo(
    () => computeRiskFlags(enriched, portfolioMetrics, sectorAllocation),
    [enriched, portfolioMetrics, sectorAllocation],
  );

  // ── Sorted positions ──

  const sortedPositions = useMemo(() => {
    const rows = enriched.map((pos) => {
      const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
      const dailyPct = pos.currentPrice != null && pos.previousClose != null
        ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
        : null;
      return { pos, metrics, dailyPct };
    });

    rows.sort((a, b) => {
      let cmp = 0;
      const dir = sort.dir === "desc" ? -1 : 1;
      switch (sort.key) {
        case "ticker":
          cmp = a.pos.companyId.localeCompare(b.pos.companyId);
          break;
        case "value":
          cmp = (a.metrics.marketValue ?? 0) - (b.metrics.marketValue ?? 0);
          break;
        case "weight":
          cmp = (a.metrics.weight ?? 0) - (b.metrics.weight ?? 0);
          break;
        case "dayGl":
          cmp = (a.metrics.dailyChange ?? 0) - (b.metrics.dailyChange ?? 0);
          break;
        case "totalGl":
          cmp = (a.metrics.totalGainLoss ?? 0) - (b.metrics.totalGainLoss ?? 0);
          break;
      }
      return cmp * dir;
    });

    return rows;
  }, [enriched, portfolioMetrics, sort]);

  const portfolioHeatmapItems = useMemo(() => sortedPositions.map(({ pos, metrics, dailyPct }) => {
    const quote = quotes.find((item) => item.ticker.toUpperCase() === pos.companyId.toUpperCase());
    const live = quote ? getLivePrice(quote) : null;
    return {
      ticker: pos.companyId.toUpperCase(),
      name: quote?.name ?? pos.companyId.toUpperCase(),
      price: live?.price ?? pos.currentPrice ?? null,
      changePercent: live?.changePercent ?? dailyPct,
      marketCap: quote?.marketCap ?? null,
      sizeValue: metrics.marketValue,
      sizeLabel: `${metrics.marketValue !== null ? compactCurrency(metrics.marketValue) : "—"} position · ${metrics.weight !== null ? weightPct(metrics.weight) : "—"} of portfolio`,
    };
  }), [quotes, sortedPositions]);

  const portfolioHeatmapSession = useMemo(() => {
    for (const quote of quotes) {
      const label = getLivePrice(quote).label;
      if (label) return label;
    }
    return null;
  }, [quotes]);

  const portfolioMacroSeries = useMemo(() => {
    const ranked = sortedPositions.map(({ pos, metrics }) => {
      const quote = quotes.find((item) => item.ticker.toUpperCase() === pos.companyId.toUpperCase());
      return {
        ticker: pos.companyId.toUpperCase(),
        label: pos.companyId.toUpperCase(),
        weight: metrics.weight ?? 0,
        values: (quote?.sparkline ?? []).map((point) => point.close),
      };
    })
      .filter((item) => item.values.length >= 2)
      .sort((a, b) => b.weight - a.weight);
    return buildMacroSeriesFromQuotes(ranked, 5);
  }, [quotes, sortedPositions]);

  // ── Data-quality states ──

  const hasQuotes = quotes.length > 0;
  const quoteFetchFailed = !loading && error !== null;
  const partialQuotes = hasQuotes && portfolioMetrics.positionsMissingPrice > 0;
  const missingCost = portfolioMetrics.positionsMissingCost > 0;
  const calcFailed = portfolioMetrics.totalMarketValue === null && hasData && !loading && !quoteFetchFailed;

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
    notifyPortfolioChanged();
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setEditingTicker(null);
    // Keep the compose bar open when it lives under portfolio value.
    setShowAddForm(composeFirst);
  }

  function handleRemove(ticker: string) {
    const updated = removePosition(ticker);
    setPositions(updated);
    notifyPortfolioChanged();
  }

  function handleRefresh() {
    refreshSharedQuotes();
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    void fetchSectorProfiles(Array.from(new Set(tickers)));
  }

  function handleClearAll() {
    savePositions([]);
    setPositions([]);
    notifyPortfolioChanged();
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

  function toggleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  function sortArrow(key: SortKey): string {
    if (sort.key !== key) return "";
    return sort.dir === "desc" ? " ↓" : " ↑";
  }

  const composeBar = (
    <section className="list-compose ink-panel" aria-label="Add a position">
      <div className="list-compose-copy">
        <span className="list-compose-eyebrow">Portfolio</span>
        <strong className="list-compose-title">
          {editingTicker ? `Edit ${editingTicker}` : "Add a position"}
        </strong>
        <p className="list-compose-help">
          {hasData
            ? "Enter ticker, shares, and average cost to update holdings."
            : "Add your first holding to start tracking portfolio value."}
        </p>
      </div>
      {(composeFirst || showAddForm || !hasData) ? (
        <div className="pf-add-form-wrap list-compose-fields">
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
      ) : (
        <button
          type="button"
          className="list-compose-cta pf-add-toggle"
          onClick={() => setShowAddForm(true)}
        >
          + Add position
        </button>
      )}
    </section>
  );

  // ── Render ──

  return (
    <div className="pf">
      {loading ? <PageLoadingMotion label="Loading portfolio prices" compact /> : null}

      {composeFirst ? composeBar : null}

      {/* ── Empty state ── */}
      {!hasData && !loading && !composeFirst && (
        <div className="pf-empty">
          <p className="pf-empty-text">No positions yet.</p>
          {composeBar}
        </div>
      )}

      {!hasData && !loading && composeFirst ? (
        <p className="pf-empty-text list-compose-empty-note">No positions yet — add one above to build your book.</p>
      ) : null}

      {hasData && (
        <>
          {/* ── Hero (split-flap value; usually rendered by MyListShell PortfolioHero) ── */}
          {!hideHero && (
            <section className="pf-hero ink-panel" aria-label="Portfolio value">
              <div className="pf-hero-flap">
                <SplitFlapMetric
                  variant="hero"
                  label="Portfolio value"
                  value={currency(portfolioMetrics.totalMarketValue)}
                  change={
                    portfolioMetrics.dailyChange !== null
                      ? `${signedCurrency(portfolioMetrics.dailyChange)} ${percent(portfolioMetrics.dailyChangePercent)}`
                      : undefined
                  }
                  isPositive={
                    portfolioMetrics.dailyChange === null
                      ? undefined
                      : (portfolioMetrics.dailyChange ?? 0) >= 0
                  }
                />
                {portfolioHeatmapSession ? (
                  <span className="pf-hero-session-chip">{portfolioHeatmapSession}</span>
                ) : null}
              </div>
              {portfolioMetrics.totalUnrealizedGL !== null && (
                <div className={`pf-hero-secondary ${(portfolioMetrics.totalUnrealizedGL ?? 0) >= 0 ? "up" : "down"}`}>
                  Unrealized {signedCurrency(portfolioMetrics.totalUnrealizedGL)}
                  {portfolioMetrics.totalUnrealizedGLPercent !== null && (
                    <> ({percent(portfolioMetrics.totalUnrealizedGLPercent)})</>
                  )}
                  {missingCost && (
                    <span className="pf-hero-note"> · partial (cost basis missing for {portfolioMetrics.positionsMissingCost})</span>
                  )}
                </div>
              )}
            </section>
          )}

          {!composeFirst ? composeBar : null}

          {/* ── Loading / Error / Refresh ── */}
          <div className="pf-toolbar">
            {loading && <span className="pf-loading">Loading portfolio prices</span>}
            {error && <span className="pf-error">{error}</span>}
            <button className="pf-refresh-btn" onClick={handleRefresh} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* ── Calculation failure state ── */}
          {calcFailed && (
            <div className="pf-state-card pf-state-warn">
              Portfolio value could not be calculated. Prices may be unavailable.
              <button className="pf-refresh-btn" onClick={handleRefresh} style={{ marginLeft: 10 }}>
                Retry
              </button>
            </div>
          )}

          {/* ── Partial quote warning ── */}
          {partialQuotes && !calcFailed && (
            <div className="pf-state-card pf-state-warn">
              Prices are unavailable for {portfolioMetrics.positionsMissingPrice} position{portfolioMetrics.positionsMissingPrice > 1 ? "s" : ""}. Displayed totals and changes reflect only positions with current prices.
            </div>
          )}

          {/* ── Missing cost basis note ── */}
          {missingCost && portfolioMetrics.totalUnrealizedGL !== null && !calcFailed && (
            <div className="pf-state-card pf-state-info">
              Return calculations cover {portfolioMetrics.positionsWithCost} of {portfolioMetrics.positionCount} positions. Add an average cost to {portfolioMetrics.positionsMissingCost} position{portfolioMetrics.positionsMissingCost > 1 ? "s" : ""} for full coverage.
            </div>
          )}

          {/* ── Portfolio heatmap ── */}
          {!calcFailed && portfolioHeatmapItems.length > 0 && (
            <StockHeatmap
              title="Portfolio"
              subtitle="Tile size reflects position value; color reflects the current market move."
              items={portfolioHeatmapItems}
              sessionLabel={portfolioHeatmapSession}
            />
          )}

          {!calcFailed && portfolioMacroSeries.length > 0 ? (
            <MacroChainChart
              series={portfolioMacroSeries}
              title="Portfolio Chain"
              subtitle="Top holdings by weight · last 15 points · normalized 0–100"
            />
          ) : null}

          {/* ── Portfolio exposure ── */}
          {sectorDonutData.length > 0 && (
            <section className="pf-section pf-exposure-card">
              <div className="pf-exposure-heading">
                <div>
                  <span className="pf-section-eyebrow">Portfolio mix</span>
                  <h2>Where your money is</h2>
                </div>
                <p>Position values grouped by economic sector.</p>
              </div>
              <SectorDonut sectors={sectorDonutData} />
            </section>
          )}

          {/* ── Positions header ── */}
          <div className="pf-positions-header">
            <div className="wl-list-header pf-ring-list-header">
              <div className="wl-list-title-row">
                <h2 className="wl-list-title pf-section-title">Positions</h2>
                <span className="wl-list-count">
                  {sortedPositions.length} holding{sortedPositions.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="wl-conviction-legend" aria-label="Conviction ring legend">
                <span><i className="quote-dot red" /> Distribution</span>
                <span><i className="quote-dot amber" /> Holding</span>
                <span><i className="quote-dot green" /> Accumulating</span>
              </div>
            </div>
          </div>

          <div className="pf-sort-row" role="group" aria-label="Sort positions">
            {(
              [
                ["ticker", "Ticker"],
                ["value", "Value"],
                ["weight", "Alloc"],
                ["dayGl", "Day"],
                ["totalGl", "Gain/Loss"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`pf-sort-chip${sort.key === key ? " is-active" : ""}`}
                onClick={() => toggleSort(key)}
              >
                {label}{sortArrow(key)}
              </button>
            ))}
          </div>

          {/* ── Holdings ring list ── */}
          <div className="watchlist-list pf-ring-list">
            {sortedPositions.map(({ pos, metrics, dailyPct }) => {
              const ticker = pos.companyId.toUpperCase();
              const quote = quotes.find((item) => item.ticker.toUpperCase() === ticker);
              const live = quote ? getLivePrice(quote) : null;
              const composite = convictionScores[ticker];

              return (
                <PortfolioHoldingCard
                  key={ticker}
                  ticker={ticker}
                  companyName={quote?.name ?? ticker}
                  price={live?.price ?? quote?.price ?? pos.currentPrice ?? null}
                  changePercent={live?.changePercent ?? quote?.changePercent ?? dailyPct}
                  sessionLabel={live?.label ?? null}
                  closePrice={live?.label ? quote?.price ?? null : null}
                  closeChangePercent={live?.label ? quote?.changePercent ?? null : null}
                  convictionTone={composite?.tone ?? "neutral"}
                  convictionStrength={composite?.displayScore ?? null}
                  scoreLoading={Boolean(pendingScores[ticker])}
                  shares={pos.shares}
                  metrics={metrics}
                  onEdit={handleStartEdit}
                  onRemove={handleRemove}
                />
              );
            })}
          </div>

          {/* ── Clear all ── */}
          {positions.length > 0 && (
            <div className="pf-clear-wrap">
              <button className="pf-clear-btn" onClick={handleClearAll}>Clear All</button>
            </div>
          )}

          {/* ════════════════ BOTTOM CARD GRID ════════════════ */}
          <div className="pf-bottom-grid">
            {/* ── Portfolio Check card ── */}
            {!calcFailed && (
            <section className="pf-section pf-check-card pf-bottom-card" aria-label="Portfolio check">
              <div className="pf-check-header">
                <h2 className="pf-section-title">Portfolio Check</h2>
              </div>
              <div className="pf-check-items">
                {/* Single-position concentration */}
                {riskFlags.singleConcentration.length > 0 && riskFlags.singleConcentration.map((p) => (
                  <div key={p.ticker} className="pf-check-item ink-box ink-box--down pf-check-warn">
                    <span className="pf-check-tag ink-chip ink-chip--down">Position</span>
                    <span className="pf-check-text">
                      <strong>{p.ticker}</strong> represents <strong>{weightPct(p.weight)}</strong> of your portfolio.
                    </span>
                  </div>
                ))}
                {/* Elevated position weights */}
                {riskFlags.elevatedPositions.length > 0 && riskFlags.elevatedPositions.map((p) => (
                  <div key={p.ticker} className="pf-check-item ink-box ink-box--amber pf-check-note">
                    <span className="pf-check-tag ink-chip ink-chip--amber">Note</span>
                    <span className="pf-check-text">
                      <strong>{p.ticker}</strong> is <strong>{weightPct(p.weight)}</strong> of the portfolio.
                    </span>
                  </div>
                ))}
                {/* Sector concentration */}
                {riskFlags.sectorConcentration.length > 0 && riskFlags.sectorConcentration.map((s) => (
                  <div key={s.sector} className="pf-check-item ink-box ink-box--down pf-check-warn">
                    <span className="pf-check-tag ink-chip ink-chip--down">Sector</span>
                    <span className="pf-check-text">
                      <strong>{s.sector}</strong> accounts for <strong>{weightPct(s.weight)}</strong> of invested assets.
                    </span>
                  </div>
                ))}
                {/* Top-three concentration */}
                {riskFlags.topThreeExceedsSixty && (
                  <div className="pf-check-item ink-box ink-box--down pf-check-warn">
                    <span className="pf-check-tag ink-chip ink-chip--down">Diversification</span>
                    <span className="pf-check-text">
                      Your three largest positions account for <strong>{weightPct(riskFlags.topThreeCombinedWeight)}</strong> of the portfolio.
                    </span>
                  </div>
                )}
                {/* Missing data flags */}
                {riskFlags.missingCostCount > 0 && (
                  <div className="pf-check-item ink-box ink-box--quiet pf-check-info">
                    <span className="pf-check-tag ink-chip ink-chip--quiet">Data</span>
                    <span className="pf-check-text">
                      Cost basis is missing for <strong>{riskFlags.missingCostCount}</strong> position{riskFlags.missingCostCount > 1 ? "s" : ""}.
                    </span>
                  </div>
                )}
                {riskFlags.missingPriceCount > 0 && (
                  <div className="pf-check-item ink-box ink-box--quiet pf-check-info">
                    <span className="pf-check-tag ink-chip ink-chip--quiet">Data</span>
                    <span className="pf-check-text">
                      Current price is unavailable for <strong>{riskFlags.missingPriceCount}</strong> position{riskFlags.missingPriceCount > 1 ? "s" : ""}.
                    </span>
                  </div>
                )}
                {/* All clear */}
                {riskFlags.singleConcentration.length === 0 &&
                 riskFlags.elevatedPositions.length === 0 &&
                 riskFlags.sectorConcentration.length === 0 &&
                 !riskFlags.topThreeExceedsSixty &&
                 riskFlags.missingCostCount === 0 &&
                 riskFlags.missingPriceCount === 0 && (
                  <div className="pf-check-item ink-box ink-box--up pf-check-clear">
                    <span className="pf-check-text">No concentration warnings. Your portfolio is well-diversified.</span>
                  </div>
                )}
              </div>
            </section>
            )}
          </div>
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
    <form className="pf-add-form list-compose-form" onSubmit={onSubmit}>
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
