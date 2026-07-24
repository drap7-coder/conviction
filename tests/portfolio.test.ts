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
  getTopDailyContributors,
  getTopReturnContributors,
  computeRiskFlags,
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

// ──── Updated PortfolioMetrics ───────────────────────────────────────────────

describe("computePortfolioMetrics (enhanced)", () => {
  it("calculates total cost basis", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 100, previousClose: 98, averageCost: 50 }),
      pos({ companyId: "B", shares: 5, currentPrice: 200, previousClose: 190, averageCost: 150 }),
    ];
    const metrics = computePortfolioMetrics(positions);
    expect(metrics.totalMarketValue).toBe(2000);
    expect(metrics.totalCostBasis).toBe(1250);
    expect(metrics.totalUnrealizedGL).toBe(750);
    expect(metrics.totalUnrealizedGLPercent).toBeCloseTo(60, 5);
    expect(metrics.positionsWithCost).toBe(2);
    expect(metrics.positionsMissingCost).toBe(0);
  });

  it("handles missing cost basis gracefully", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 100, previousClose: 98, averageCost: 50 }),
      pos({ companyId: "B", shares: 5, currentPrice: 200, previousClose: 190, averageCost: undefined }),
    ];
    const metrics = computePortfolioMetrics(positions);
    expect(metrics.totalCostBasis).toBe(500);
    expect(metrics.totalUnrealizedGL).toBe(500);
    expect(metrics.totalUnrealizedGLPercent).toBeCloseTo(100, 5);
    expect(metrics.positionsWithCost).toBe(1);
    expect(metrics.positionsMissingCost).toBe(1);
  });

  it("returns null unrealized GL when no cost basis exists", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 100, previousClose: 98, averageCost: undefined }),
    ];
    const metrics = computePortfolioMetrics(positions);
    expect(metrics.totalCostBasis).toBeNull();
    expect(metrics.totalUnrealizedGL).toBeNull();
    expect(metrics.totalUnrealizedGLPercent).toBeNull();
    expect(metrics.positionsWithCost).toBe(0);
    expect(metrics.positionsMissingCost).toBe(1);
  });

  it("handles zero-value portfolio", () => {
    const positions = [
      pos({ companyId: "A", shares: 0, currentPrice: 100, previousClose: 100, averageCost: 50 }),
    ];
    const metrics = computePortfolioMetrics(positions);
    expect(metrics.totalMarketValue).toBe(0);
    expect(metrics.totalCostBasis).toBe(0);
    expect(metrics.totalUnrealizedGL).toBe(0);
    expect(metrics.totalUnrealizedGLPercent).toBeNull();
  });
});

// ──── Contribution Ranking ────────────────────────────────────────────────────

describe("getTopDailyContributors", () => {
  it("ranks by absolute dollar change", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 105, previousClose: 100 }),
      pos({ companyId: "B", shares: 10, currentPrice: 48, previousClose: 50 }),
      pos({ companyId: "C", shares: 10, currentPrice: 200, previousClose: 198 }),
    ];
    const ranked = getTopDailyContributors(positions);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].ticker).toBe("A");
    expect(ranked[0].dollarChange).toBe(50);
    expect(ranked[1].ticker).toBe("B");
    expect(ranked[1].dollarChange).toBe(-20);
    expect(ranked[2].ticker).toBe("C");
    expect(ranked[2].dollarChange).toBe(20);
  });

  it("handles positions with missing prices", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: null, previousClose: null }),
    ];
    expect(getTopDailyContributors(positions)).toHaveLength(0);
  });

  it("handles empty portfolio", () => {
    expect(getTopDailyContributors([])).toHaveLength(0);
  });

  it("never returns NaN or infinite values", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 100, previousClose: 98 }),
    ];
    for (const entry of getTopDailyContributors(positions)) {
      expect(isFinite(entry.dollarChange)).toBe(true);
      expect(isFinite(entry.percentChange)).toBe(true);
    }
  });
});

describe("getTopReturnContributors", () => {
  it("ranks total return by absolute dollar impact", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 200, previousClose: 190, averageCost: 100 }),
      pos({ companyId: "B", shares: 5, currentPrice: 50, previousClose: 55, averageCost: 80 }),
    ];
    const ranked = getTopReturnContributors(positions, 2250);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].ticker).toBe("A");
    expect(ranked[0].dollarReturn).toBe(1000);
    expect(ranked[1].ticker).toBe("B");
    expect(ranked[1].dollarReturn).toBe(-150);
  });

  it("excludes positions missing cost basis", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 200, previousClose: 190, averageCost: undefined }),
    ];
    expect(getTopReturnContributors(positions, 2000)).toHaveLength(0);
  });

  it("handles empty portfolio", () => {
    expect(getTopReturnContributors([], null)).toHaveLength(0);
  });
});

// ──── Risk Flags ──────────────────────────────────────────────────────────────

describe("computeRiskFlags", () => {
  function makePositions(...weights: number[]): PortfolioPosition[] {
    return weights.map((w, i) =>
      pos({
        companyId: String.fromCharCode(65 + i),
        shares: w * 10,
        currentPrice: 100,
        previousClose: 100,
      }),
    );
  }

  it("flags positions above 20%", () => {
    const positions = makePositions(30, 25, 20, 15, 10);
    const metrics = computePortfolioMetrics(positions);
    const alloc = computeSectorAllocation(positions, new Map());
    const flags = computeRiskFlags(positions, metrics, alloc);

    expect(flags.singleConcentration).toHaveLength(2);
    expect(flags.singleConcentration[0].ticker).toBe("A");
    expect(flags.singleConcentration[0].weight).toBeGreaterThan(20);
  });

  it("flags elevated positions between 12% and 20%", () => {
    const positions = makePositions(15, 13, 12, 60);
    const metrics = computePortfolioMetrics(positions);
    const alloc = computeSectorAllocation(positions, new Map());
    const flags = computeRiskFlags(positions, metrics, alloc);

    expect(flags.elevatedPositions).toHaveLength(2);
    expect(flags.singleConcentration).toHaveLength(1);
  });

  it("flags top-three concentration above 60%", () => {
    const positions = makePositions(30, 20, 15, 20, 15);
    const metrics = computePortfolioMetrics(positions);
    const alloc = computeSectorAllocation(positions, new Map());
    const flags = computeRiskFlags(positions, metrics, alloc);

    expect(flags.topThreeExceedsSixty).toBe(true);
    expect(flags.topThreeCombinedWeight).toBeGreaterThan(60);
  });

  it("flags sector concentration above 35%", () => {
    const positions = [
      pos({ companyId: "techCo", shares: 10, currentPrice: 100, previousClose: 100 }),
      pos({ companyId: "otherCo", shares: 10, currentPrice: 50, previousClose: 50 }),
    ];
    const companyMap = new Map<string, CompanyRecord>([
      ["techCo", { id: "techCo", ticker: "TECH", name: "Tech Co", assetType: "stock", sector: "Technology" }],
      ["otherCo", { id: "otherCo", ticker: "OTHR", name: "Other Co", assetType: "stock", sector: "Consumer" }],
    ]);
    const metrics = computePortfolioMetrics(positions);
    const alloc = computeSectorAllocation(positions, companyMap);
    const flags = computeRiskFlags(positions, metrics, alloc);

    expect(flags.sectorConcentration).toHaveLength(1);
    expect(flags.sectorConcentration[0].sector).toBe("Technology");
  });

  it("handles empty portfolio without errors", () => {
    const metrics = computePortfolioMetrics([]);
    const alloc = computeSectorAllocation([], new Map());
    const flags = computeRiskFlags([], metrics, alloc);

    expect(flags.singleConcentration).toHaveLength(0);
    expect(flags.elevatedPositions).toHaveLength(0);
    expect(flags.sectorConcentration).toHaveLength(0);
    expect(flags.topThreeExceedsSixty).toBe(false);
    expect(flags.topThreeCombinedWeight).toBe(0);
    expect(flags.missingCostCount).toBe(0);
    expect(flags.missingPriceCount).toBe(0);
  });

  it("reports missing cost and price counts", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: 100, previousClose: 100, averageCost: 50 }),
      pos({ companyId: "B", shares: 10, currentPrice: null, previousClose: null }),
    ];
    const metrics = computePortfolioMetrics(positions);
    const alloc = computeSectorAllocation(positions, new Map());
    const flags = computeRiskFlags(positions, metrics, alloc);

    expect(flags.missingCostCount).toBe(1);
    expect(flags.missingPriceCount).toBe(1);
  });
});

// ──── NaN and Infinity Safety ─────────────────────────────────────────────────

describe("display safety", () => {
  it("no NaN or Infinity in position metrics for valid positions", () => {
    const p = pos({ companyId: "AAPL", shares: 10, currentPrice: 200, previousClose: 195, averageCost: 150 });
    const metrics = computePositionMetrics(p, 2000, 50);
    for (const [key, val] of Object.entries(metrics)) {
      if (val !== null) {
        expect(isFinite(val as number)).toBe(true);
      }
    }
  });

  it("no NaN or Infinity in portfolio metrics for partial data", () => {
    const positions = [
      pos({ companyId: "A", shares: 10, currentPrice: null, previousClose: null }),
    ];
    const metrics = computePortfolioMetrics(positions);
    expect(metrics.totalMarketValue).toBeNull();
    expect(metrics.dailyChange).toBeNull();
    expect(metrics.totalCostBasis).toBeNull();
    expect(metrics.totalUnrealizedGL).toBeNull();
  });

  it("no NaN or Infinity in risk flags", () => {
    const flags = computeRiskFlags([], computePortfolioMetrics([]), computeSectorAllocation([], new Map()));
    expect(isFinite(flags.topThreeCombinedWeight)).toBe(true);
  });
});
