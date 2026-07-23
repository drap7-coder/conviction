/**
 * Portfolio types for CONVICTION portfolio intelligence.
 *
 * Three separate concepts kept distinct:
 * 1. CompanyRecord — canonical company data (shared by Portfolio and Watchlist)
 * 2. PortfolioPosition — user-owned position data
 * 3. WatchlistMembership — watchlist-only membership
 */

import type { EvidenceDirection } from "@/lib/evidence/types";

// ── Asset types ────────────────────────────────────────────────────────────

export type AssetType = "stock" | "etf" | "other";

// ── Membership status ──────────────────────────────────────────────────────

export type MembershipStatus = "owned" | "watchlisted" | "owned-and-watchlisted";

// ── Company Record (canonical) ─────────────────────────────────────────────

export interface CompanyRecord {
  id: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  sector?: string;
  industry?: string;
}

// ── Portfolio Position ─────────────────────────────────────────────────────

export interface PortfolioPositionInput {
  companyId: string;
  shares: number;
  averageCost?: number;
  note?: string;
}

export interface PortfolioPosition extends PortfolioPositionInput {
  /** Derived display fields — computed by pure functions, stored for convenience */
  ticker?: string;
  currentPrice?: number | null;
  previousClose?: number | null;
}

// ── Watchlist Membership ───────────────────────────────────────────────────

export interface WatchlistMembership {
  companyId: string;
  addedAt?: string;
  note?: string;
}

// ── Portfolio State ────────────────────────────────────────────────────────

export interface PortfolioState {
  positions: PortfolioPosition[];
  asOf: string;
  isIllustrative: boolean;
  label: string;
}

// ── Calculation results ────────────────────────────────────────────────────

export interface PositionMetrics {
  marketValue: number | null;
  weight: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  dailyContribution: number | null;
  totalCost: number | null;
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
}

export interface PortfolioMetrics {
  totalMarketValue: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  priorPortfolioValue: number | null;
  positionCount: number;
  positionsWithPrice: number;
  positionsMissingPrice: number;
}

export interface DailyContribution {
  ticker: string;
  companyName: string;
  priceChange: number;
  dollarChange: number;
  percentChange: number;
}

export interface ConcentrationResult {
  largestPosition: { ticker: string; name: string; weight: number } | null;
  topThreeWeight: number;
  topFiveWeight: number;
  positionsAboveThreshold: Array<{ ticker: string; name: string; weight: number }>;
  threshold: number;
}

export interface SectorAllocation {
  sector: string;
  weight: number;
  marketValue: number | null;
  positionCount: number;
}

export interface SectorAllocationResult {
  sectors: SectorAllocation[];
  unclassifiedWeight: number;
  unclassifiedMarketValue: number | null;
  unclassifiedPositionCount: number;
}
