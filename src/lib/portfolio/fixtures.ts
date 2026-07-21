/**
 * Sample portfolio fixtures for CONVICTION portfolio intelligence.
 *
 * 8 realistic fictional positions demonstrating:
 * - High-quality compounder (NVO)
 * - Value-oriented company (INTC)
 * - Cyclical company (OXY)
 * - Growth company (GOOG)
 * - Income-oriented holding (PFE)
 * - Speculative/high-volatility position (NBIS)
 * - Broad-market ETF (QQQ)
 * - Growth-at-a-reasonable-price (ONON)
 *
 * Uses real ticker symbols where the repository already has
 * suitable normalized evidence. All prices, metrics, and evidence
 * are internally consistent with a shared illustrative asOf date.
 */

import type { CompanyRecord, PortfolioPosition, PortfolioState, AssetType } from "./types";

// ── Shared asOf date ───────────────────────────────────────────────────────
// All sample data uses this single timestamp for consistency.

export const SAMPLE_AS_OF = "2026-07-18T16:00:00.000Z";

export const SAMPLE_AS_OF_LABEL = "Illustrative sample data as of July 18, 2026";

export const SAMPLE_IS_ILLUSTRATIVE = true;

// ── Company Records ────────────────────────────────────────────────────────
// Canonical company data — one record per security, referenced by both
// PortfolioPosition and WatchlistMembership.

export interface CompanyRecordExtended extends CompanyRecord {
  assetType: AssetType;
  currentPrice: number;
  previousClose: number;
  evidenceSummary?: string;
}

export const SAMPLE_COMPANIES: Record<string, CompanyRecordExtended> = {
  NVO: {
    id: "nvo",
    ticker: "NVO",
    name: "Novo Nordisk",
    assetType: "stock",
    sector: "Health Care",
    industry: "Pharmaceuticals",
    currentPrice: 98.50,
    previousClose: 96.80,
  },
  GOOG: {
    id: "goog",
    ticker: "GOOG",
    name: "Alphabet Inc.",
    assetType: "stock",
    sector: "Communication Services",
    industry: "Internet Services",
    currentPrice: 180.25,
    previousClose: 177.50,
  },
  OXY: {
    id: "oxy",
    ticker: "OXY",
    name: "Occidental Petroleum",
    assetType: "stock",
    sector: "Energy",
    industry: "Oil & Gas E&P",
    currentPrice: 62.40,
    previousClose: 61.80,
  },
  NBIS: {
    id: "nbis",
    ticker: "NBIS",
    name: "Nebius Group",
    assetType: "stock",
    sector: "Technology",
    industry: "AI Infrastructure",
    currentPrice: 24.15,
    previousClose: 23.50,
  },
  PFE: {
    id: "pfe",
    ticker: "PFE",
    name: "Pfizer Inc.",
    assetType: "stock",
    sector: "Health Care",
    industry: "Pharmaceuticals",
    currentPrice: 28.30,
    previousClose: 28.10,
  },
  INTC: {
    id: "intc",
    ticker: "INTC",
    name: "Intel Corporation",
    assetType: "stock",
    sector: "Technology",
    industry: "Semiconductors",
    currentPrice: 19.20,
    previousClose: 18.90,
  },
  QQQ: {
    id: "qqq",
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    assetType: "etf",
    sector: "Technology",
    industry: "Broad Market ETF",
    currentPrice: 482.00,
    previousClose: 478.50,
  },
  ONON: {
    id: "onon",
    ticker: "ONON",
    name: "On Holding AG",
    assetType: "stock",
    sector: "Consumer Discretionary",
    industry: "Footwear & Apparel",
    currentPrice: 52.60,
    previousClose: 51.20,
  },
};

// ── Portfolio Positions ────────────────────────────────────────────────────

export const SAMPLE_PORTFOLIO: PortfolioPosition[] = [
  {
    companyId: "nvo",
    shares: 25,
    averageCost: 72.00,
    currentPrice: 98.50,
    previousClose: 96.80,
    note: "High-quality compounder with GLP-1 dominance",
  },
  {
    companyId: "goog",
    shares: 10,
    averageCost: 155.00,
    currentPrice: 180.25,
    previousClose: 177.50,
    note: "Core AI monetization thesis",
  },
  {
    companyId: "oxy",
    shares: 50,
    averageCost: 58.00,
    currentPrice: 62.40,
    previousClose: 61.80,
    note: "Carbon capture thesis; Berkshire backing",
  },
  {
    companyId: "nbis",
    shares: 100,
    averageCost: 18.50,
    currentPrice: 24.15,
    previousClose: 23.50,
    note: "Speculative AI infrastructure play",
  },
  {
    companyId: "pfe",
    shares: 100,
    averageCost: 32.00,
    currentPrice: 28.30,
    previousClose: 28.10,
    note: "Income; pipeline optionality",
  },
  {
    companyId: "intc",
    shares: 80,
    averageCost: 22.00,
    currentPrice: 19.20,
    previousClose: 18.90,
    note: "Value-oriented turnaround play",
  },
  {
    companyId: "qqq",
    shares: 5,
    averageCost: 450.00,
    currentPrice: 482.00,
    previousClose: 478.50,
    note: "Broad tech exposure",
  },
  {
    companyId: "onon",
    shares: 35,
    averageCost: 38.00,
    currentPrice: 52.60,
    previousClose: 51.20,
    note: "Growth through brand expansion",
  },
];

// ── Watchlist-only Memberships ─────────────────────────────────────────────

export const SAMPLE_WATCHLIST_ONLY: string[] = [
  "CRWD",
  "PLTR",
  "AVAV",
];

// ── Portfolio State ────────────────────────────────────────────────────────

export const SAMPLE_PORTFOLIO_STATE: PortfolioState = {
  positions: SAMPLE_PORTFOLIO,
  asOf: SAMPLE_AS_OF,
  isIllustrative: SAMPLE_IS_ILLUSTRATIVE,
  label: SAMPLE_AS_OF_LABEL,
};

// ── Helper: get company by companyId ───────────────────────────────────────

export function getSampleCompany(companyId: string): CompanyRecordExtended | undefined {
  return Object.values(SAMPLE_COMPANIES).find((c) => c.id === companyId);
}

// ── Helper: get company by ticker ──────────────────────────────────────────

export function getSampleCompanyByTicker(ticker: string): CompanyRecordExtended | undefined {
  return SAMPLE_COMPANIES[ticker.toUpperCase()];
}