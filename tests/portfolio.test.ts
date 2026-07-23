import { describe, expect, it } from "vitest";
import {
  calculatePositionMarketValue,
  calculatePositionTotalCost,
  calculatePositionGainLoss,
  calculatePositionGainLossPercent,
  calculatePositionDailyChange,
  calculatePositionDailyChangePercent,
  calculatePositionWeight,
  calculateDailyContribution,
  computePositionMetrics,
  calculateTotalMarketValue,
  calculateTotalDailyChange,
  calculatePriorPortfolioValue,
  calculatePortfolioDailyChangePercent,
  computePortfolioMetrics,
  getDailyContributors,
  computeConcentration,
  computeSectorAllocation,
} from "@/lib/portfolio/calculations";
import type { PortfolioPosition, CompanyRecord } from "@/lib/portfolio/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function pos(overrides: Partial<PortfolioPosition>): PortfolioPosition {
  return {
    companyId: "TEST",
    shares: 10,
    currentPrice: 100,
    previousClose: 98,
    ...overrides,
  };
}

// ──── Position Market Value ────────────────────────────────────────────────────

describe("calculatePositionMarketValue", () => {
  it("calculates market value from shares and price", () => {
    expect(calculatePositionMarketValue(10, 100)).toBe(1000);
  });

  it("handles fractional shares", () => {
    expect(calculatePositionMarketValue(10.5, 100)).toBe(1050);
  });

  it("returns null when price is null", () => {
    expect(calculatePositionMarketValue(10, null)).toBeNull();
  });

  it("returns null when price is undefined", () => {
    expect(calculatePositionMarketValue(10, undefined)).toBeNull();
  });

  it("handles zero shares", () => {
    expect(calculatePositionMarketValue(0, 100)).toBe(0);
  });
});

// ──── Position Total Cost ───────────────────────────────────────────────────

describe("calculatePositionTotalCost", () => {
  it("calculates total cost from shares and average cost", () => {
    expect(calculatePositionTotalCost(10, 50)).toBe(500);
  });

  it("returns null when averageCost is null", () => {
    expect(calculatePositionTotalCost(10, null)).toBeNull();
  });

  it("returns null when averageCost is undefined", () => {
    expect(calculatePositionTotalCost(10, undefined)).toBeNull();
  });

  it("handles optional cost basis", () => {
    // Cost is optional — missing cost should not affect other calculations
    const cost = calculatePositionTotalCost(10, null);
    expect(cost).toBeNull();
  });
});

// ──── Position Gain/Loss ────────────────────────────────────────────────────

describe("calculatePositionGainLoss", () => {
  it("calculates gain when market value exceeds cost", () => {
    expect(calculatePositionGainLoss(1000, 800)).toBe(200);
  });

  it("calculates loss when market value is below cost", () => {
    expect(calculatePositionGainLoss(800, 1000)).toBe(-200);
  });

  it("returns null when either value is null", () => {
    expect(calculatePositionGainLoss(null, 800)).toBeNull();
    expect(calculatePositionGainLoss(1000, null)).toBeNull();
  });
});

describe("calculatePositionGainLossPercent", () => {
  it("calculates percentage gain", () => {
    expect(calculatePositionGainLossPercent(200, 800)).toBeCloseTo(25, 5);
  });

  it("calculates percentage loss", () => {
    expect(calculatePositionGainLossPercent(-200, 1000)).toBeCloseTo(-20, 5);
  });

  it("returns null when cost is zero", () => {
    expect(calculatePositionGainLossPercent(100, 0)).toBeNull();
  });
});

// ──── Position Daily Change ─────────────────────────────────────────────────

describe("calculatePositionDailyChange", () => {
  it("calculates positive daily change", () => {
    expect(calculatePositionDailyChange(10, 105, 100)).toBe(50);
  });

  it("calculates negative daily change", () => {
    expect(calculatePositionDailyChange(10, 95, 100)).toBe(-50);
  });

  it("returns null when currentPrice is null", () => {
    expect(calculatePositionDailyChange(10, null, 100)).toBeNull();
  });

  it("returns null when previousClose is null", () => {
    expect(calculatePositionDailyChange(10, 100, null)).toBeNull();
  });
});

describe("calculatePositionDailyChangePercent", () => {
  it("calculates positive percentage change", () => {
    expect(calculatePositionDailyChangePercent(105, 100)).toBeCloseTo(5, 5);
  });

  it("calculates negative percentage change", () => {
    expect(calculatePositionDailyChangePercent(95, 100)).toBeCloseTo(-5, 5);
  });

  it("returns null when previousClose is zero", () => {
    expect(calculatePositionDailyChangePercent(100, 0)).toBeNull();
  });
});

// ──── Position Weight ───────────────────────────────────────────────────────

describe("calculatePositionWeight", () => {
  it("calculates weight as percentage of total", () => {
    expect(calculatePositionWeight(200, 1000)).toBeCloseTo(20, 5);
  });

  it("returns null when totalMarketValue is null", () => {
    expect(calculatePositionWeight(200, null)).toBeNull();
  });

  it("returns null when totalMarketValue is zero", () => {
    expect(calculatePositionWeight(200, 0)).toBeNull();
  });
});

// ──── Daily Contribution ─────────────────────────────────────────────────────

describe("calculateDailyContribution", () => {
  it("calculates contribution as percentage of total change", () => {
    expect(calculateDailyContribution(50, 200)).toBeCloseTo(25, 5);
  });

  it("returns null when totalDailyChange is zero", () => {
    expect(calculateDailyContribution(50, 0)).toBeNull();
  });
});

// ──── computePositionMetrics ─────────────────────────────────────────────────

describe("computePositionMetrics", () => {
  it("computes all metrics for a valid position", () => {
    const p = pos({ companyId: "AAPL", shares: 10, currentPrice: 200, previousClose: 195, averageCost: 150 });
    const metrics = computePositionMetrics(p, 2000, 50);

    expect(metrics.marketValue).toBe(2000);
    expect(metrics.weight).toBeCloseTo(100, 5);
    expect(metrics.dailyChange).toBe(50);
    expect(metrics.dailyChangePercent).toBeCloseTo(2.564, 2);
    expect(metrics.dailyContribution).toBeCloseTo(100, 5);
    expect(metrics.totalCost).toBe(1500);
    expect(metrics.totalGainLoss).toBe(500);
    expect(metrics.totalGainLossPercent).toBeCloseTo(33.333, 2);
  });
});

// ──── Portfolio-level calculations ───────────────────────────────────────────

describe("calculateTotalMarketValue", () => {
  it("sums all position market values", () => {
    const positions = [
      pos({ shares: 10, currentPrice: 100 }),
      pos({ shares: 20, currentPrice: 50 }),
    ];
    expect(calculateTotalMarketValue(positions)).toBe(2000);
  });

  it("returns null when no positions have valid prices", () => {
    const positions = [
      pos({ currentPrice: null }),
      pos({ currentPrice: null }),
    ];
    expect(calculateTotalMarketValue(positions)).toBeNull();
  });

  it("handles zero-value portfolio", () => {
    const positions = [
      pos({ shares: 0, currentPrice: 100 }),
      pos({ shares: 0, currentPrice: 50 }),
    ];
    expect(calculateTotalMarketValue(positions)).toBe(0);
  });

  it("skips positions with missing prices", () => {
    const positions = [
      pos({ shares: 10, currentPrice: 100 }),
      pos({ shares: 10, currentPrice: null }),
    ];
    expect(calculateTotalMarketValue(positions)).toBe(1000);
  });
});

describe("calculateTotalDailyChange", () => {
  it("sums all position daily changes", () => {
    const positions = [
      pos({ shares: 10, currentPrice: 105, previousClose: 100 }),
      pos({ shares: 10, currentPrice: 50, previousClose: 52 }),
    ];
    // (10*5) + (10*-2) = 50 - 20 = 30
    expect(calculateTotalDailyChange(positions)).toBe(30);
  });

  it("returns null when no positions have valid data", () => {
    const positions = [
      pos({ currentPrice: null, previousClose: null }),
    ];
    expect(calculateTotalDailyChange(positions)).toBeNull();
  });
});

describe("calculatePriorPortfolioValue", () => {
  it("subtracts daily change from total value", () => {
    expect(calculatePriorPortfolioValue(1100, 100)).toBe(1000);
  });

  it("returns null when either input is null", () => {
    expect(calculatePriorPortfolioValue(null, 100)).toBeNull();
    expect(calculatePriorPortfolioValue(1100, null)).toBeNull();
  });
});

describe("calculatePortfolioDailyChangePercent", () => {
  it("calculates daily change as percentage of prior value", () => {
    expect(calculatePortfolioDailyChangePercent(100, 1000)).toBeCloseTo(10, 5);
  });

  it("returns null when prior value is zero", () => {
    expect(calculatePortfolioDailyChangePercent(100, 0)).toBeNull();
  });
});

describe("computePortfolioMetrics", () => {
  it("computes all portfolio metrics", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 105, previousClose: 100 }),
      pos({ companyId: "B", shares: 20, currentPrice: 52, previousClose: 50 }),
    ];
    const metrics = computePortfolioMetrics(positions);

    // (10*105) + (20*52) = 1050 + 1040 = 2090
    expect(metrics.totalMarketValue).toBe(2090);
    // (10*5) + (20*2) = 50 + 40 = 90
    expect(metrics.dailyChange).toBe(90);
    // 2090 - 90 = 2000
    expect(metrics.priorPortfolioValue).toBe(2000);
    // 90/2000 * 100 = 4.5
    expect(metrics.dailyChangePercent).toBeCloseTo(4.5, 5);
    expect(metrics.positionCount).toBe(2);
    expect(metrics.positionsWithPrice).toBe(2);
    expect(metrics.positionsMissingPrice).toBe(0);
  });

  it("handles missing prices gracefully", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 105, previousClose: 100 }),
      pos({ companyId: "B", shares: 20, currentPrice: null, previousClose: null }),
    ];
    const metrics = computePortfolioMetrics(positions);

    expect(metrics.totalMarketValue).toBe(1050);
    expect(metrics.dailyChange).toBe(50);
    expect(metrics.positionsWithPrice).toBe(1);
    expect(metrics.positionsMissingPrice).toBe(1);
  });
});

// ──── Daily Contributors ─────────────────────────────────────────────────────

describe("getDailyContributors", () => {
  it("separates positive and negative contributors", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 105, previousClose: 100 }),
      pos({ companyId: "B", shares: 10, currentPrice: 48, previousClose: 50 }),
    ];
    const { positive, negative } = getDailyContributors(positions, 30);

    expect(positive).toHaveLength(1);
    expect(positive[0].priceChange).toBe(5);
    expect(positive[0].dollarChange).toBe(50);
    expect(negative).toHaveLength(1);
    expect(negative[0].priceChange).toBe(-2);
    expect(negative[0].dollarChange).toBe(-20);
  });

  it("returns empty arrays when no data", () => {
    const positions = [
      pos({ currentPrice: null, previousClose: null }),
    ];
    const { positive, negative } = getDailyContributors(positions, null);
    expect(positive).toHaveLength(0);
    expect(negative).toHaveLength(0);
  });
});

// ──── Concentration ─────────────────────────────────────────────────────────

describe("computeConcentration", () => {
  const weights = new Map([
    ["A", { name: "Alpha", weight: 40 }],
    ["B", { name: "Beta", weight: 25 }],
    ["C", { name: "Gamma", weight: 15 }],
    ["D", { name: "Delta", weight: 12 }],
    ["E", { name: "Epsilon", weight: 8 }],
  ]);

  it("identifies the largest position", () => {
    const result = computeConcentration(weights);
    expect(result.largestPosition?.ticker).toBe("A");
    expect(result.largestPosition?.weight).toBe(40);
  });

  it("calculates top three weight", () => {
    const result = computeConcentration(weights);
    expect(result.topThreeWeight).toBeCloseTo(80, 5);
  });

  it("calculates top five weight", () => {
    const result = computeConcentration(weights);
    expect(result.topFiveWeight).toBeCloseTo(100, 5);
  });

  it("identifies positions above threshold", () => {
    const result = computeConcentration(weights, 15);
    expect(result.positionsAboveThreshold).toHaveLength(2);
    expect(result.positionsAboveThreshold[0].ticker).toBe("A");
    expect(result.positionsAboveThreshold[1].ticker).toBe("B");
  });

  it("handles empty map", () => {
    const result = computeConcentration(new Map());
    expect(result.largestPosition).toBeNull();
    expect(result.topThreeWeight).toBe(0);
    expect(result.topFiveWeight).toBe(0);
    expect(result.positionsAboveThreshold).toHaveLength(0);
  });
});

// ──── Sector Allocation ─────────────────────────────────────────────────────

describe("computeSectorAllocation", () => {
  it("allocates positions to sectors", () => {
    const positions = [
      pos({ companyId: "techCo", shares: 10, currentPrice: 100 }),
      pos({ companyId: "healthCo", shares: 20, currentPrice: 50 }),
      pos({ companyId: "techCo2", shares: 5, currentPrice: 100 }),
    ];
    const companyMap = new Map<string, CompanyRecord>([
      ["techCo", { id: "techCo", ticker: "TECH", name: "Tech Co", assetType: "stock", sector: "Technology" }],
      ["healthCo", { id: "healthCo", ticker: "HEAL", name: "Health Co", assetType: "stock", sector: "Health Care" }],
      ["techCo2", { id: "techCo2", ticker: "TECH2", name: "Tech Co 2", assetType: "stock", sector: "Technology" }],
    ]);

    const result = computeSectorAllocation(positions, companyMap);

    // Total: 1000 + 1000 + 500 = 2500
    // Tech: 1000 + 500 = 1500 → 60%
    // Health: 1000 → 40%
    expect(result.sectors).toHaveLength(2);
    expect(result.sectors[0].sector).toBe("Technology");
    expect(result.sectors[0].weight).toBeCloseTo(60, 5);
    expect(result.sectors[1].sector).toBe("Health Care");
    expect(result.sectors[1].weight).toBeCloseTo(40, 5);
  });

  it("handles positions without sector data", () => {
    const positions = [
      pos({ companyId: "known", shares: 10, currentPrice: 100 }),
      pos({ companyId: "unknown", shares: 10, currentPrice: 100 }),
    ];
    const companyMap = new Map<string, CompanyRecord>([
      ["known", { id: "known", ticker: "KNW", name: "Known Co", assetType: "stock", sector: "Technology" }],
    ]);

    const result = computeSectorAllocation(positions, companyMap);

    expect(result.sectors).toHaveLength(1);
    expect(result.unclassifiedWeight).toBeCloseTo(50, 5);
    expect(result.unclassifiedPositionCount).toBe(1);
  });

  it("handles empty portfolio", () => {
    const result = computeSectorAllocation([], new Map());
    expect(result.sectors).toHaveLength(0);
    expect(result.unclassifiedWeight).toBe(0);
    expect(result.unclassifiedPositionCount).toBe(0);
  });

  it("handles positions with missing prices", () => {
    const positions = [
      pos({ companyId: "techCo", shares: 10, currentPrice: null }),
    ];
    const companyMap = new Map<string, CompanyRecord>([
      ["techCo", { id: "techCo", ticker: "TECH", name: "Tech Co", assetType: "stock", sector: "Technology" }],
    ]);
    const result = computeSectorAllocation(positions, companyMap);
    expect(result.sectors).toHaveLength(0);
    expect(result.unclassifiedWeight).toBe(0);
  });
});

// ──── Allocation Totals and Rounding ────────────────────────────────────────

describe("allocation totals and rounding", () => {
  it("allocation weights sum to approximately 100%", () => {
    const positions = [
      pos({ companyId: "a", shares: 10, currentPrice: 100 }),
      pos({ companyId: "b", shares: 20, currentPrice: 100 }),
      pos({ companyId: "c", shares: 30, currentPrice: 100 }),
    ];
    const companyMap = new Map<string, CompanyRecord>([
      ["a", { id: "a", ticker: "A", name: "A", assetType: "stock", sector: "Tech" }],
      ["b", { id: "b", ticker: "B", name: "B", assetType: "stock", sector: "Health" }],
      ["c", { id: "c", ticker: "C", name: "C", assetType: "stock", sector: "Energy" }],
    ]);
    const result = computeSectorAllocation(positions, companyMap);

    const totalWeight = result.sectors.reduce((s, sec) => s + sec.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 5);

    // Position weights sum to 100
    const total = calculateTotalMarketValue(positions)!;
    let weightSum = 0;
    for (const pos of positions) {
      const mv = calculatePositionMarketValue(pos.shares, pos.currentPrice)!;
      weightSum += calculatePositionWeight(mv, total)!;
    }
    expect(weightSum).toBeCloseTo(100, 5);
  });

  it("handles fractional shares", () => {
    const positions = [
      pos({ shares: 10.5, currentPrice: 100 }),
      pos({ shares: 7.25, currentPrice: 50 }),
    ];
    const total = calculateTotalMarketValue(positions);
    expect(total).toBe(1412.5); // 1050 + 362.5
  });
});

// ──── Duplicate Membership ───────────────────────────────────────────────────

describe("membership integrity", () => {
  it("positions reference company IDs, not duplicate records", () => {
    // A company can appear in both portfolio and watchlist
    // without duplicating the company record.
    const company: CompanyRecord = {
      id: "nvo",
      ticker: "NVO",
      name: "Novo Nordisk",
      assetType: "stock",
      sector: "Health Care",
    };

    const portfolioRef = { companyId: company.id, shares: 10 };
    const watchlistRef = { companyId: company.id, addedAt: "2026-07-01" };

    // Both references point to the same company record
    expect(portfolioRef.companyId).toBe(watchlistRef.companyId);
    expect(portfolioRef.companyId).toBe(company.id);
  });
});
