/**
 * Pure portfolio calculation functions.
 *
 * All functions are deterministic, stateless, and unit-testable.
 * No I/O, no React, no environment variables.
 */

import type {
  PortfolioPosition,
  PortfolioMetrics,
  PositionMetrics,
  DailyContribution,
  ConcentrationResult,
  SectorAllocation,
  SectorAllocationResult,
  CompanyRecord,
} from "./types";

// ── Position-level calculations ────────────────────────────────────────────

/**
 * Calculate market value for a single position.
 * Returns null when price is missing.
 */
export function calculatePositionMarketValue(
  shares: number,
  currentPrice: number | undefined | null,
): number | null {
  if (currentPrice === null || currentPrice === undefined) return null;
  return shares * currentPrice;
}

/**
 * Calculate total cost basis for a position.
 * Returns null when averageCost is missing.
 */
export function calculatePositionTotalCost(
  shares: number,
  averageCost: number | undefined | null,
): number | null {
  if (averageCost === null || averageCost === undefined) return null;
  return shares * averageCost;
}

/**
 * Calculate total gain/loss for a position.
 * Returns null when either price or cost is missing.
 */
export function calculatePositionGainLoss(
  marketValue: number | null,
  totalCost: number | null,
): number | null {
  if (marketValue === null || totalCost === null) return null;
  return marketValue - totalCost;
}

/**
 * Calculate gain/loss as a percentage of cost.
 * Returns null when cost is missing or zero.
 */
export function calculatePositionGainLossPercent(
  gainLoss: number | null,
  totalCost: number | null,
): number | null {
  if (gainLoss === null || totalCost === null || totalCost === 0) return null;
  return (gainLoss / totalCost) * 100;
}

/**
 * Calculate daily dollar change for a position.
 * Returns null when either price is missing.
 */
export function calculatePositionDailyChange(
  shares: number,
  currentPrice: number | undefined | null,
  previousClose: number | undefined | null,
): number | null {
  if (currentPrice === null || currentPrice === undefined) return null;
  if (previousClose === null || previousClose === undefined) return null;
  return shares * (currentPrice - previousClose);
}

/**
 * Calculate daily percentage change for a position.
 * Returns null when previousClose is missing or zero.
 */
export function calculatePositionDailyChangePercent(
  currentPrice: number | undefined | null,
  previousClose: number | undefined | null,
): number | null {
  if (currentPrice === null || currentPrice === undefined) return null;
  if (previousClose === null || previousClose === undefined || previousClose === 0) return null;
  return ((currentPrice - previousClose) / previousClose) * 100;
}

/**
 * Calculate position weight as a fraction of total portfolio value.
 * Returns null when either marketValue or totalMarketValue is null/invalid.
 */
export function calculatePositionWeight(
  marketValue: number | null,
  totalMarketValue: number | null,
): number | null {
  if (marketValue === null || totalMarketValue === null || totalMarketValue <= 0) return null;
  return (marketValue / totalMarketValue) * 100;
}

/**
 * Calculate daily contribution (how much this position drove the daily change).
 * Returns null when dailyChange or totalDailyChange is null.
 */
export function calculateDailyContribution(
  dailyChange: number | null,
  totalDailyChange: number | null,
): number | null {
  if (dailyChange === null || totalDailyChange === null || totalDailyChange === 0) return null;
  return (dailyChange / totalDailyChange) * 100;
}

/**
 * Compute all metrics for a single position.
 */
export function computePositionMetrics(
  position: PortfolioPosition,
  totalMarketValue: number | null,
  totalDailyChange: number | null,
): PositionMetrics {
  const marketValue = calculatePositionMarketValue(position.shares, position.currentPrice);
  const totalCost = calculatePositionTotalCost(position.shares, position.averageCost);
  const gainLoss = calculatePositionGainLoss(marketValue, totalCost);
  const gainLossPercent = calculatePositionGainLossPercent(gainLoss, totalCost);
  const dailyChange = calculatePositionDailyChange(
    position.shares,
    position.currentPrice,
    position.previousClose,
  );
  const dailyChangePercent = calculatePositionDailyChangePercent(
    position.currentPrice,
    position.previousClose,
  );
  const weight = calculatePositionWeight(marketValue, totalMarketValue);
  const dailyContribution = calculateDailyContribution(dailyChange, totalDailyChange);

  return {
    marketValue,
    weight,
    dailyChange,
    dailyChangePercent,
    dailyContribution,
    totalCost,
    totalGainLoss: gainLoss,
    totalGainLossPercent: gainLossPercent,
  };
}

// ── Portfolio-level calculations ───────────────────────────────────────────

/**
 * Calculate total portfolio market value.
 * Returns null when no positions have valid prices.
 */
export function calculateTotalMarketValue(
  positions: PortfolioPosition[],
): number | null {
  let total = 0;
  let hasPrice = false;
  for (const pos of positions) {
    const mv = calculatePositionMarketValue(pos.shares, pos.currentPrice);
    if (mv !== null) {
      total += mv;
      hasPrice = true;
    }
  }
  return hasPrice ? total : null;
}

/**
 * Calculate total portfolio daily dollar change.
 * Returns null when no positions have valid prices.
 */
export function calculateTotalDailyChange(
  positions: PortfolioPosition[],
): number | null {
  let total = 0;
  let hasData = false;
  for (const pos of positions) {
    const change = calculatePositionDailyChange(
      pos.shares,
      pos.currentPrice,
      pos.previousClose,
    );
    if (change !== null) {
      total += change;
      hasData = true;
    }
  }
  return hasData ? total : null;
}

/**
 * Calculate prior portfolio value (today's value minus today's change).
 * Returns null when either value is null.
 */
export function calculatePriorPortfolioValue(
  totalMarketValue: number | null,
  totalDailyChange: number | null,
): number | null {
  if (totalMarketValue === null || totalDailyChange === null) return null;
  return totalMarketValue - totalDailyChange;
}

/**
 * Calculate portfolio daily percentage change.
 * Returns null when prior value is missing or zero.
 */
export function calculatePortfolioDailyChangePercent(
  totalDailyChange: number | null,
  priorValue: number | null,
): number | null {
  if (totalDailyChange === null || priorValue === null || priorValue === 0) return null;
  return (totalDailyChange / priorValue) * 100;
}

/**
 * Compute all portfolio-level metrics.
 */
export function computePortfolioMetrics(
  positions: PortfolioPosition[],
): PortfolioMetrics {
  const totalMarketValue = calculateTotalMarketValue(positions);
  const dailyChange = calculateTotalDailyChange(positions);
  const priorPortfolioValue = calculatePriorPortfolioValue(totalMarketValue, dailyChange);
  const dailyChangePercent = calculatePortfolioDailyChangePercent(dailyChange, priorPortfolioValue);

  const positionsWithPrice = positions.filter(
    (p) => p.currentPrice !== null && p.currentPrice !== undefined,
  ).length;
  const positionsMissingPrice = positions.length - positionsWithPrice;

  return {
    totalMarketValue,
    dailyChange,
    dailyChangePercent,
    priorPortfolioValue,
    positionCount: positions.length,
    positionsWithPrice,
    positionsMissingPrice,
  };
}

// ── Daily contributors ────────────────────────────────────────────────────

/**
 * Get the largest positive and negative daily contributors.
 * Returns empty arrays when no valid data exists.
 */
export function getDailyContributors(
  positions: PortfolioPosition[],
  totalDailyChange: number | null,
): { positive: DailyContribution[]; negative: DailyContribution[] } {
  const positive: DailyContribution[] = [];
  const negative: DailyContribution[] = [];

  for (const pos of positions) {
    const change = calculatePositionDailyChange(
      pos.shares,
      pos.currentPrice,
      pos.previousClose,
    );
    if (change !== null && change !== 0) {
      const pct = calculatePositionDailyChangePercent(pos.currentPrice, pos.previousClose) ?? 0;
      const entry: DailyContribution = {
        ticker: pos.companyId.toUpperCase(),
        companyName: pos.companyId.toUpperCase(),
        dollarChange: change,
        percentChange: pct,
      };
      if (change > 0) {
        positive.push(entry);
      } else {
        negative.push(entry);
      }
    }
  }

  positive.sort((a, b) => b.dollarChange - a.dollarChange);
  negative.sort((a, b) => a.dollarChange - b.dollarChange);

  return { positive, negative };
}

// ── Concentration ─────────────────────────────────────────────────────────

/**
 * Calculate portfolio concentration metrics.
 *
 * @param weights - Map of ticker → weight percentage (0-100)
 * @param threshold - Display threshold percentage (default 15)
 */
export function computeConcentration(
  weights: Map<string, { name: string; weight: number }>,
  threshold: number = 15,
): ConcentrationResult {
  const sorted = Array.from(weights.entries())
    .map(([ticker, { name, weight }]) => ({ ticker, name, weight }))
    .sort((a, b) => b.weight - a.weight);

  const largestPosition = sorted[0] ?? null;

  const topThree = sorted.slice(0, 3);
  const topThreeWeight = topThree.reduce((sum, p) => sum + p.weight, 0);

  const topFive = sorted.slice(0, 5);
  const topFiveWeight = topFive.reduce((sum, p) => sum + p.weight, 0);

  const positionsAboveThreshold = sorted.filter((p) => p.weight > threshold);

  return {
    largestPosition,
    topThreeWeight,
    topFiveWeight,
    positionsAboveThreshold,
    threshold,
  };
}

// ── Sector Allocation ─────────────────────────────────────────────────────

/**
 * Calculate sector allocation from positions with company data.
 *
 * @param positions - Portfolio positions (must have currentPrice set)
 * @param companyMap - Map of companyId → CompanyRecord
 */
export function computeSectorAllocation(
  positions: PortfolioPosition[],
  companyMap: Map<string, CompanyRecord>,
): SectorAllocationResult {
  const sectorData = new Map<string, { marketValue: number; count: number }>();
  let unclassifiedValue = 0;
  let unclassifiedCount = 0;
  let totalValue = 0;

  for (const pos of positions) {
    const mv = calculatePositionMarketValue(pos.shares, pos.currentPrice);
    if (mv === null) continue;

    totalValue += mv;
    const company = companyMap.get(pos.companyId);

    if (company?.sector) {
      const existing = sectorData.get(company.sector);
      if (existing) {
        existing.marketValue += mv;
        existing.count += 1;
      } else {
        sectorData.set(company.sector, { marketValue: mv, count: 1 });
      }
    } else {
      unclassifiedValue += mv;
      unclassifiedCount += 1;
    }
  }

  const sectors: SectorAllocation[] = Array.from(sectorData.entries())
    .map(([sector, { marketValue, count }]) => ({
      sector,
      weight: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
      marketValue,
      positionCount: count,
    }))
    .sort((a, b) => b.weight - a.weight);

  const unclassifiedWeight = totalValue > 0
    ? (unclassifiedValue / totalValue) * 100
    : 0;

  return {
    sectors,
    unclassifiedWeight,
    unclassifiedMarketValue: unclassifiedCount > 0 ? unclassifiedValue : null,
    unclassifiedPositionCount: unclassifiedCount,
  };
}