import { describe, expect, it } from "vitest";
import {
  buildConvictionScore,
  dialValueFromScore,
  displayLabelForComposite,
  toEarningsCategoryScore,
  toInstitutionalCategoryScore,
  toPoliticalCategoryScore,
  toShortInterestCategoryScore,
  toTechnicalsCategoryScore,
} from "@/lib/conviction/score";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

function row(
  status: InstitutionalAccumulation["status"],
  shareChange = 0,
  filingDate = "2026-05-15",
): InstitutionalAccumulation {
  return {
    manager: "Test",
    displayName: "Test Manager",
    cik: "0001",
    issuer: "Apple",
    classTitle: "COM",
    cusip: "037833100",
    shares: 1000,
    previousShares: 1000 - shareChange,
    shareChange,
    percentageChange: null,
    reportedValue: 1_000_000,
    filingQuarter: "2026Q1",
    filingDate,
    status,
  };
}

function earnings(overrides: Partial<EarningsEvidence> = {}): EarningsEvidence {
  return {
    ticker: "AAPL",
    history: [],
    forecasts: [],
    historyScore: 50,
    revisionScore: 20,
    score: 38,
    momentum: "Estimates rising",
    nextEarningsDate: null,
    asOf: "2026-06-01T00:00:00.000Z",
    source: "nasdaq",
    status: "success",
    ...overrides,
  };
}

function risingHistory(days = 60, start = 100) {
  const end = Date.UTC(2026, 6, 28); // 2026-07-28
  return Array.from({ length: days }, (_, index) => {
    const dayOffset = days - 1 - index;
    return {
      date: new Date(end - dayOffset * 86_400_000).toISOString(),
      close: start + index * 0.4,
    };
  });
}

describe("toInstitutionalCategoryScore", () => {
  it("maps empty filings to hasData false", () => {
    const category = toInstitutionalCategoryScore("AAPL", { results: [] });
    expect(category.hasData).toBe(false);
    expect(category.category).toBe("institutional");
    expect(category.baseWeight).toBe(0.25);
  });

  it("remaps 0–100 ring onto signed [-100, +100]", () => {
    const category = toInstitutionalCategoryScore("AAPL", {
      results: [row("New", 500_000), row("Increased", 250_000), row("Increased", 100_000)],
    });
    expect(category.hasData).toBe(true);
    expect(category.isStale).toBe(false);
    expect(category.score).toBeGreaterThan(0);
    expect(category.score).toBeLessThanOrEqual(100);
  });

  it("marks old filings stale", () => {
    const category = toInstitutionalCategoryScore(
      "AAPL",
      { results: [row("Increased", 100_000, "2024-01-01")] },
      new Date("2026-07-28"),
    );
    expect(category.hasData).toBe(true);
    expect(category.isStale).toBe(true);
  });
});

describe("toEarningsCategoryScore", () => {
  it("passes through signed earnings score", () => {
    const category = toEarningsCategoryScore(earnings({ score: 42 }));
    expect(category.hasData).toBe(true);
    expect(category.score).toBe(42);
    expect(category.baseWeight).toBe(0.25);
  });

  it("marks unavailable earnings as no data", () => {
    const category = toEarningsCategoryScore(
      earnings({ status: "unavailable", score: null, momentum: "Unavailable" }),
    );
    expect(category.hasData).toBe(false);
  });
});

describe("toTechnicalsCategoryScore", () => {
  it("scores rising price history as positive", () => {
    const points = risingHistory(80, 100);
    const last = points[points.length - 1]!.close;
    const category = toTechnicalsCategoryScore(
      "AAPL",
      {
        points,
        currentPrice: last,
        fiftyTwoWeekHigh: last,
        fiftyTwoWeekLow: 90,
      },
      new Date(points[points.length - 1]!.date),
    );
    expect(category.hasData).toBe(true);
    expect(category.baseWeight).toBe(0.2);
    expect(category.score).toBeGreaterThan(0);
  });

  it("returns no data for empty history", () => {
    const category = toTechnicalsCategoryScore("AAPL", { points: [] });
    expect(category.hasData).toBe(false);
  });
});

describe("toShortInterestCategoryScore", () => {
  it("treats rising short interest as negative", () => {
    const category = toShortInterestCategoryScore({
      ticker: "AAPL",
      status: "success",
      fetchedAt: "2026-07-28T00:00:00.000Z",
      latest: {
        ticker: "AAPL",
        issueName: "Apple",
        settlementDate: "2026-07-15",
        currentShortShares: 12_000_000,
        previousShortShares: 10_000_000,
        changeShares: 2_000_000,
        changePercent: 20,
        averageDailyVolume: 1_000_000,
        daysToCover: 6,
        marketClass: null,
        source: "finra-consolidated-short-interest",
      },
    }, new Date("2026-07-28"));
    expect(category.hasData).toBe(true);
    expect(category.score).toBeLessThan(0);
    expect(category.baseWeight).toBe(0.1);
  });

  it("returns no data when short interest is empty", () => {
    const category = toShortInterestCategoryScore({
      ticker: "AAPL",
      status: "empty",
      latest: null,
      fetchedAt: "2026-07-28T00:00:00.000Z",
    });
    expect(category.hasData).toBe(false);
  });
});

describe("toPoliticalCategoryScore", () => {
  it("leans positive when purchases dominate", () => {
    const category = toPoliticalCategoryScore({
      ticker: "AAPL",
      trades: [],
      purchases: [{ id: "1" } as never],
      sales: [],
      totalEstimatedPurchases: 800_000,
      totalEstimatedSales: 200_000,
      latestFilingDate: "2026-06-01",
      source: "kadoa-open-data",
      sourceUrl: "",
      fetchedAt: "2026-07-28T00:00:00.000Z",
    }, new Date("2026-07-28"));
    expect(category.hasData).toBe(true);
    expect(category.score).toBe(60);
    expect(category.baseWeight).toBe(0.05);
  });
});

describe("buildConvictionScore", () => {
  it("returns a score at exactly 50% coverage from institutional + earnings", () => {
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000), row("Increased", 250_000)],
      },
      earnings: earnings({ score: 40 }),
      now: new Date("2026-07-28"),
    });

    expect(result.coverage).toBeCloseTo(0.5);
    expect(result.score).not.toBeNull();
    expect(result.label).not.toBe("insufficient_evidence");
    expect(result.includedCategories).toEqual(["institutional", "earnings"]);
  });

  it("includes technicals, short interest, and political in coverage", () => {
    const points = risingHistory(80, 100);
    const last = points[points.length - 1]!;
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000, "2026-06-15"), row("Increased", 250_000, "2026-06-15")],
      },
      earnings: earnings({ score: 40, asOf: "2026-07-01T00:00:00.000Z" }),
      technicals: {
        points,
        currentPrice: last.close,
        fiftyTwoWeekHigh: last.close,
        fiftyTwoWeekLow: 90,
      },
      shortInterest: {
        ticker: "AAPL",
        status: "success",
        fetchedAt: "2026-07-28T00:00:00.000Z",
        latest: {
          ticker: "AAPL",
          issueName: "Apple",
          settlementDate: "2026-07-15",
          currentShortShares: 8_000_000,
          previousShortShares: 10_000_000,
          changeShares: -2_000_000,
          changePercent: -20,
          averageDailyVolume: 1_000_000,
          daysToCover: 3,
          marketClass: null,
          source: "finra-consolidated-short-interest",
        },
      },
      political: {
        ticker: "AAPL",
        trades: [],
        purchases: [{ id: "1" } as never],
        sales: [],
        totalEstimatedPurchases: 500_000,
        totalEstimatedSales: 100_000,
        latestFilingDate: "2026-06-01",
        source: "kadoa-open-data",
        sourceUrl: "",
        fetchedAt: "2026-07-28T00:00:00.000Z",
      },
      now: new Date("2026-07-28"),
    });

    // 0.25 + 0.25 + 0.20 + 0.10 + 0.05 = 0.85 (social still out)
    expect(result.coverage).toBeCloseTo(0.85);
    expect(result.score).not.toBeNull();
    expect(result.includedCategories).toEqual([
      "institutional",
      "earnings",
      "technicals",
      "short_interest",
      "political",
    ]);
    expect(result.excludedCategories).toEqual(["social"]);
  });

  it("withholds the score when only institutional is present", () => {
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000)],
      },
      earnings: earnings({ status: "unavailable", score: null, momentum: "Unavailable" }),
      now: new Date("2026-07-28"),
    });

    expect(result.coverage).toBeCloseTo(0.25);
    expect(result.score).toBeNull();
    expect(result.label).toBe("insufficient_evidence");
  });
});

describe("display helpers", () => {
  it("maps dial and labels", () => {
    expect(dialValueFromScore(0)).toBe(50);
    expect(dialValueFromScore(100)).toBe(100);
    expect(dialValueFromScore(-100)).toBe(0);
    expect(displayLabelForComposite("strong_positive")).toBe("Accumulating");
    expect(displayLabelForComposite("mixed")).toBe("Holding");
    expect(displayLabelForComposite("strong_negative")).toBe("Distribution");
    expect(displayLabelForComposite("insufficient_evidence")).toBe("Unavailable");
  });
});
