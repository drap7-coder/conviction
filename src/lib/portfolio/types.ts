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
  /** Total cost basis across positions that have averageCost set */
  totalCostBasis: number | null;
  /** Total unrealized gain/loss across positions with both price and cost data */
  totalUnrealizedGL: number | null;
  /** Total unrealized gain/loss as percentage of totalCostBasis */
  totalUnrealizedGLPercent: number | null;
  positionCount: number;
  positionsWithPrice: number;
  positionsMissingPrice: number;
  /** Number of positions with a valid averageCost */
  positionsWithCost: number;
  /** Number of positions missing averageCost */
  positionsMissingCost: number;
}

/**
 * A daily-contribution entry ranked by dollar impact.
 */
export interface ContributionRanking {
  ticker: string;
  dollarChange: number;
  percentChange: number;
  weight: number | null;
}

/**
 * A total-return contribution entry ranked by dollar impact.
 */
export interface ReturnContribution {
  ticker: string;
  dollarReturn: number;
  percentReturn: number | null;
  weight: number | null;
}

/**
 * Explicit, rules-based risk flags for the Portfolio Check section.
 */
export interface PortfolioRiskFlags {
  /** Positions above 20% weight */
  singleConcentration: Array<{ ticker: string; weight: number }>;
  /** Positions between 12% and 20% weight */
  elevatedPositions: Array<{ ticker: string; weight: number }>;
  /** Sectors above 35% weight */
  sectorConcentration: Array<{ sector: string; weight: number }>;
  /** Whether the top three positions exceed 60% combined */
  topThreeExceedsSixty: boolean;
  /** Actual top-three combined weight */
  topThreeCombinedWeight: number;
  /** Number of positions missing cost basis */
  missingCostCount: number;
  /** Number of positions missing price data */
  missingPriceCount: number;
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
