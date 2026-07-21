"use client";

import { useMemo, useState } from "react";
import { SAMPLE_PORTFOLIO, SAMPLE_COMPANIES, SAMPLE_PORTFOLIO_STATE, SAMPLE_WATCHLIST_ONLY, getSampleCompany } from "@/lib/portfolio/fixtures";
import { computePortfolioMetrics, computePositionMetrics, getDailyContributors, computeConcentration, computeSectorAllocation } from "@/lib/portfolio/calculations";
import type { MembershipStatus } from "@/lib/portfolio/types";

type FilterMode = "all" | "portfolio" | "watchlist";

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

function membershipLabel(
  inPortfolio: boolean,
  inWatchlist: boolean,
): { label: string; cls: string } {
  if (inPortfolio && inWatchlist) return { label: "Owned + Watchlisted", cls: "mem-both" };
  if (inPortfolio) return { label: "Owned", cls: "mem-owned" };
  return { label: "Watchlisted", cls: "mem-watch" };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ── Build a ticker→weight map for concentration calculations ────────────────

function buildWeightMap(positions: typeof SAMPLE_PORTFOLIO) {
  const metrics = computePortfolioMetrics(positions);
  const total = metrics.totalMarketValue ?? 0;
  const map = new Map<string, { name: string; weight: number }>();

  for (const pos of positions) {
    const mv = pos.currentPrice != null ? pos.shares * pos.currentPrice : 0;
    const company = getSampleCompany(pos.companyId);
    const ticker = company?.ticker ?? pos.companyId.toUpperCase();
    const name = company?.name ?? ticker;
    const weight = total > 0 ? (mv / total) * 100 : 0;
    map.set(ticker, { name, weight: round2(weight) });
  }

  return map;
}

// ── Build company map for sector allocation ─────────────────────────────────

function buildCompanyMap() {
  const map = new Map<string, { id: string; ticker: string; name: string; assetType: "stock" | "etf" | "other"; sector?: string; industry?: string }>();
  for (const [, company] of Object.entries(SAMPLE_COMPANIES)) {
    map.set(company.id, {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      assetType: company.assetType,
      sector: company.sector,
      industry: company.industry,
    });
  }
  return map;
}

// ── Build a flat list of all visible items ──────────────────────────────────

interface PortfolioRow {
  companyId: string;
  ticker: string;
  name: string;
  assetType: string;
  sector: string | undefined;
  membership: "owned" | "watchlisted" | "owned-and-watchlisted";
  shares?: number;
  currentPrice?: number | null;
  previousClose?: number | null;
  averageCost?: number;
}

function buildRows(filter: FilterMode): PortfolioRow[] {
  const portfolioIds = new Set(SAMPLE_PORTFOLIO.map((p) => p.companyId));
  const watchlistIds = new Set(SAMPLE_WATCHLIST_ONLY.map((t) => t.toLowerCase()));

  const rows: PortfolioRow[] = [];

  // Portfolio positions
  for (const pos of SAMPLE_PORTFOLIO) {
    const company = getSampleCompany(pos.companyId);
    const ticker = company?.ticker ?? pos.companyId.toUpperCase();
    const inWatchlist = watchlistIds.has(pos.companyId);

    const membership: "owned" | "owned-and-watchlisted" = inWatchlist ? "owned-and-watchlisted" : "owned";

    if (filter === "watchlist" && !inWatchlist) continue;

    rows.push({
      companyId: pos.companyId,
      ticker,
      name: company?.name ?? ticker,
      assetType: company?.assetType ?? "stock",
      sector: company?.sector,
      membership,
      shares: pos.shares,
      currentPrice: pos.currentPrice,
      previousClose: pos.previousClose,
      averageCost: pos.averageCost,
    });
  }

  // Watchlist-only positions
  if (filter !== "portfolio") {
    for (const tickerLower of watchlistIds) {
      const ticker = tickerLower.toUpperCase();
      const company = SAMPLE_COMPANIES[ticker];
      if (!company) continue;
      if (portfolioIds.has(company.id)) continue; // Already added above

      rows.push({
        companyId: company.id,
        ticker: company.ticker,
        name: company.name,
        assetType: company.assetType,
        sector: company.sector,
        membership: "watchlisted",
      });
    }
  }

  return rows;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [filter, setFilter] = useState<FilterMode>("all");

  const rows = useMemo(() => buildRows(filter), [filter]);
  const portfolioMetrics = useMemo(() => computePortfolioMetrics(SAMPLE_PORTFOLIO), []);
  const weightMap = useMemo(() => buildWeightMap(SAMPLE_PORTFOLIO), []);
  const concentration = useMemo(() => computeConcentration(weightMap, 15), [weightMap]);
  const sectorAllocation = useMemo(
    () => computeSectorAllocation(SAMPLE_PORTFOLIO, buildCompanyMap()),
    [],
  );
  const contributors = useMemo(
    () => getDailyContributors(SAMPLE_PORTFOLIO, portfolioMetrics.dailyChange),
    [portfolioMetrics.dailyChange],
  );

  return (
    <div>
      {/* ── Illustrative data banner ── */}
      <div className="portfolio-banner">
        <span className="demo-badge">Sample data</span>
        <span className="portfolio-banner-text">{SAMPLE_PORTFOLIO_STATE.label}</span>
      </div>

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
                    <span className="portfolio-contributor-value positive">
                      {currency(c.dollarChange)}
                    </span>
                    <span className="portfolio-contributor-pct positive">
                      {percent(c.percentChange)}
                    </span>
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
                    <span className="portfolio-contributor-value negative">
                      {currency(c.dollarChange)}
                    </span>
                    <span className="portfolio-contributor-pct negative">
                      {percent(c.percentChange)}
                    </span>
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
        <p className="portfolio-insight">
          The three largest sectors represent {sectorAllocation.sectors.slice(0, 3).reduce((s, sec) => s + sec.weight, 0).toFixed(0)}% of this sample portfolio.
        </p>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="portfolio-filter-bar">
        {(["all", "portfolio", "watchlist"] as const).map((mode) => (
          <button
            key={mode}
            className={`portfolio-filter-btn ${filter === mode ? "active" : ""}`}
            onClick={() => setFilter(mode)}
          >
            {mode === "all" ? "All" : mode === "portfolio" ? "Portfolio" : "Watchlist"}
          </button>
        ))}
      </div>

      {/* ── Holdings Table ── */}
      <div className="portfolio-table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Status</th>
              <th>Price</th>
              <th>Change</th>
              <th>Mkt Value</th>
              <th>Alloc</th>
              <th>Cost</th>
              <th>Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="portfolio-empty-cell">No securities to display.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const mem = membershipLabel(row.membership === "owned-and-watchlisted", row.membership === "watchlisted" || row.membership === "owned-and-watchlisted");
                const metrics = row.currentPrice != null && row.shares != null
                  ? computePositionMetrics(
                      {
                        companyId: row.companyId,
                        shares: row.shares,
                        currentPrice: row.currentPrice,
                        previousClose: row.previousClose,
                        averageCost: row.averageCost,
                      },
                      portfolioMetrics.totalMarketValue,
                      portfolioMetrics.dailyChange,
                    )
                  : null;

                return (
                  <tr key={row.companyId}>
                    <td className="portfolio-cell-company">
                      <strong className="portfolio-ticker">{row.ticker}</strong>
                      <span className="portfolio-name">{row.name}</span>
                    </td>
                    <td>
                      <span className={`portfolio-mem-badge ${mem.cls}`}>{mem.label}</span>
                    </td>
                    <td className="portfolio-cell-num">{row.currentPrice != null ? currency(row.currentPrice) : "—"}</td>
                    <td className={`portfolio-cell-num ${(row.currentPrice ?? 0) >= (row.previousClose ?? 0) ? "positive" : "negative"}`}>
                      {row.currentPrice != null && row.previousClose != null
                        ? percent(((row.currentPrice - row.previousClose) / row.previousClose) * 100)
                        : "—"}
                    </td>
                    <td className="portfolio-cell-num">{metrics?.marketValue != null ? currency(metrics.marketValue) : "—"}</td>
                    <td className="portfolio-cell-num">{metrics?.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</td>
                    <td className="portfolio-cell-num">{metrics?.totalCost != null ? currency(metrics.totalCost) : "—"}</td>
                    <td className={`portfolio-cell-num ${(metrics?.totalGainLoss ?? 0) >= 0 ? "positive" : "negative"}`}>
                      {metrics?.totalGainLoss != null ? currency(metrics.totalGainLoss) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="portfolio-cards-mobile">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>No securities to display.</p>
          </div>
        ) : (
          rows.map((row) => {
            const mem = membershipLabel(row.membership === "owned-and-watchlisted", row.membership === "watchlisted" || row.membership === "owned-and-watchlisted");
            const metrics = row.currentPrice != null && row.shares != null
              ? computePositionMetrics(
                  {
                    companyId: row.companyId,
                    shares: row.shares,
                    currentPrice: row.currentPrice,
                    previousClose: row.previousClose,
                    averageCost: row.averageCost,
                  },
                  portfolioMetrics.totalMarketValue,
                  portfolioMetrics.dailyChange,
                )
              : null;
            const dailyPct = row.currentPrice != null && row.previousClose != null
              ? ((row.currentPrice - row.previousClose) / row.previousClose) * 100
              : null;

            return (
              <div key={row.companyId} className="portfolio-card">
                <div className="portfolio-card-header">
                  <div className="portfolio-card-company">
                    <strong className="portfolio-ticker">{row.ticker}</strong>
                    <span className="portfolio-name">{row.name}</span>
                  </div>
                  <span className={`portfolio-mem-badge ${mem.cls}`}>{mem.label}</span>
                </div>
                <div className="portfolio-card-stats">
                  <div className="portfolio-card-stat">
                    <span className="portfolio-card-stat-label">Price</span>
                    <span className="portfolio-card-stat-value">{row.currentPrice != null ? currency(row.currentPrice) : "—"}</span>
                  </div>
                  <div className="portfolio-card-stat">
                    <span className="portfolio-card-stat-label">Daily</span>
                    <span className={`portfolio-card-stat-value ${(dailyPct ?? 0) >= 0 ? "positive" : "negative"}`}>
                      {dailyPct != null ? percent(dailyPct) : "—"}
                    </span>
                  </div>
                  <div className="portfolio-card-stat">
                    <span className="portfolio-card-stat-label">Alloc</span>
                    <span className="portfolio-card-stat-value">{metrics?.weight != null ? `${metrics.weight.toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="portfolio-card-stat">
                    <span className="portfolio-card-stat-label">Value</span>
                    <span className="portfolio-card-stat-value">{metrics?.marketValue != null ? currency(metrics.marketValue) : "—"}</span>
                  </div>
                </div>
                {metrics?.totalGainLoss != null && (
                  <div className={`portfolio-card-gl ${metrics.totalGainLoss >= 0 ? "positive" : "negative"}`}>
                    {metrics.totalGainLoss >= 0 ? "+" : ""}{currency(metrics.totalGainLoss)}
                    {metrics.totalGainLossPercent != null ? ` (${metrics.totalGainLossPercent >= 0 ? "+" : ""}${metrics.totalGainLossPercent.toFixed(1)}%)` : ""}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="portfolio-footnote">
        {SAMPLE_PORTFOLIO_STATE.label}. All values are illustrative and do not represent real investments.
      </p>
    </div>
  );
}