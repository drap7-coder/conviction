import { describe, expect, it } from "vitest";
import {
  buildConvictionScore,
  dialValueFromScore,
  displayLabelForComposite,
  displayScoreFromSigned,
  evidenceWeightsForMarketCap,
  mapInsiderNetScore,
  sizeBucketFromMarketCap,
  toInsiderCategoryScore,
  toInstitutionalCategoryScore,
  toShortInterestCategoryScore,
  toTechnicalsCategoryScore,
} from "@/lib/conviction/score";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import type { InsiderTransaction } from "@/lib/sec/types";

function row(
  status: InstitutionalAccumulation["status"],
  shareChange = 0,
  filingDate = "2026-05-15",
  overrides: Partial<InstitutionalAccumulation> = {},
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

function purchase(overrides: Partial<InsiderTransaction> = {}): InsiderTransaction {
  return {
    id: "tx-1",
    ticker: "AAPL",
    cik: "0000320193",
    accessionNumber: "0001",
    filingUrl: "https://example.com",
    insiderName: "Tim Cook",
    insiderRole: "CEO",
    isDirector: true,
    isOfficer: true,
    isTenPercentOwner: false,
    transactionDate: "2026-07-10",
    filingDate: "2026-07-12",
    transactionCode: "P",
    transactionType: "purchase",
    shares: 10_000,
    pricePerShare: 200,
    totalValue: 2_000_000,
    sharesOwnedAfter: 100_000,
    isDirectOwnership: true,
    ownershipChange: null,
    ...overrides,
  };
}

describe("toInstitutionalCategoryScore", () => {
  it("maps empty filings to hasData false", () => {
    const category = toInstitutionalCategoryScore("AAPL", { results: [] });
    expect(category.hasData).toBe(false);
    expect(category.category).toBe("institutional");
    expect(category.baseWeight).toBe(0.34);
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

  it("weights durable dollar books above tiny trading books", () => {
    const durableHeavy = toInstitutionalCategoryScore("AAPL", {
      results: [
        row("New", 1_000_000, "2026-05-15", {
          manager: "Berkshire Hathaway",
          displayName: "Berkshire",
          reportedValue: 5_000_000_000,
        }),
        row("Reduced", -10_000, "2026-05-15", {
          manager: "Citadel Advisors",
          displayName: "Citadel",
          reportedValue: 50_000,
        }),
      ],
    });
    const tradingHeavy = toInstitutionalCategoryScore("AAPL", {
      results: [
        row("Reduced", -1_000_000, "2026-05-15", {
          manager: "Berkshire Hathaway",
          displayName: "Berkshire",
          reportedValue: 5_000_000_000,
        }),
        row("New", 10_000, "2026-05-15", {
          manager: "Citadel Advisors",
          displayName: "Citadel",
          reportedValue: 50_000,
        }),
      ],
    });
    expect(durableHeavy.score).toBeGreaterThan(tradingHeavy.score);
  });
});

describe("toInsiderCategoryScore", () => {
  it("maps empty Form 4 activity to hasData false", () => {
    const category = toInsiderCategoryScore("AAPL", { transactions: [] });
    expect(category.hasData).toBe(false);
    expect(category.category).toBe("insider");
    expect(category.baseWeight).toBe(0.16);
  });

  it("scores open-market purchases as positive", () => {
    const category = toInsiderCategoryScore(
      "AAPL",
      { transactions: [purchase()] },
      new Date("2026-07-28"),
    );
    expect(category.hasData).toBe(true);
    expect(category.score).toBeGreaterThan(0);
    expect(category.explanation).toMatch(/buying|Form 4/i);
  });

  it("ignores insider sales entirely (not a conviction signal)", () => {
    const category = toInsiderCategoryScore(
      "AAPL",
      {
        transactions: [
          purchase({
            id: "sale-1",
            transactionType: "sale",
            transactionCode: "S",
            totalValue: 8_000_000,
            shares: 40_000,
          }),
        ],
      },
      new Date("2026-07-28"),
    );
    expect(category.hasData).toBe(false);
    expect(category.score).toBe(0);
    expect(category.explanation).toMatch(/sales ignored|No open-market insider purchases/i);
  });

  it("still scores purchases when mixed with sales", () => {
    const category = toInsiderCategoryScore(
      "AAPL",
      {
        transactions: [
          purchase(),
          purchase({
            id: "sale-1",
            transactionType: "sale",
            transactionCode: "S",
            totalValue: 8_000_000,
            shares: 40_000,
          }),
        ],
      },
      new Date("2026-07-28"),
    );
    expect(category.hasData).toBe(true);
    expect(category.score).toBeGreaterThan(0);
  });

  it("maps purchase net scores onto [0, +100]", () => {
    expect(mapInsiderNetScore(0)).toBe(0);
    expect(mapInsiderNetScore(-200)).toBe(0);
    expect(mapInsiderNetScore(200)).toBeGreaterThan(80);
    expect(mapInsiderNetScore(200)).toBeLessThanOrEqual(100);
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
    expect(category.baseWeight).toBe(0.36);
    expect(category.score).toBeGreaterThan(0);
  });

  it("scores above-both-SMAs near highs close to +100", () => {
    const points = risingHistory(250, 100);
    const last = points[points.length - 1]!.close;
    const category = toTechnicalsCategoryScore(
      "AAPL",
      {
        points,
        currentPrice: last,
        fiftyTwoWeekHigh: last,
        fiftyTwoWeekLow: 100,
      },
      new Date(points[points.length - 1]!.date),
    );
    expect(category.hasData).toBe(true);
    expect(category.score).toBeGreaterThanOrEqual(85);
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
    expect(category.baseWeight).toBe(0.14);
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

describe("size regimes", () => {
  it("classifies market-cap buckets", () => {
    expect(sizeBucketFromMarketCap(500_000_000)).toBe("small");
    expect(sizeBucketFromMarketCap(10_000_000_000)).toBe("mid");
    expect(sizeBucketFromMarketCap(100_000_000_000)).toBe("large");
    expect(sizeBucketFromMarketCap(500_000_000_000)).toBe("mega");
    expect(sizeBucketFromMarketCap(null)).toBe("unknown");
  });

  it("boosts insider weight for small caps vs mega caps", () => {
    const small = evidenceWeightsForMarketCap(1_000_000_000);
    const mega = evidenceWeightsForMarketCap(500_000_000_000);
    expect(small.insider).toBeGreaterThan(mega.insider);
    expect(mega.institutional).toBeGreaterThan(small.institutional);
    const smallSum = Object.values(small).reduce((a, b) => a + b, 0);
    const megaSum = Object.values(mega).reduce((a, b) => a + b, 0);
    expect(smallSum).toBeCloseTo(1);
    expect(megaSum).toBeCloseTo(1);
  });
});

describe("buildConvictionScore", () => {
  it("returns a score when institutional + technicals clear coverage", () => {
    const points = risingHistory(80, 100);
    const last = points[points.length - 1]!;
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000), row("Increased", 250_000)],
      },
      technicals: {
        points,
        currentPrice: last.close,
        fiftyTwoWeekHigh: last.close,
        fiftyTwoWeekLow: 90,
      },
      now: new Date("2026-07-28"),
    });

    expect(result.coverage).toBeCloseTo(0.7);
    expect(result.score).not.toBeNull();
    expect(result.label).not.toBe("insufficient_evidence");
    expect(result.includedCategories).toEqual(["institutional", "technicals"]);
  });

  it("includes insider when Form 4 purchases are present", () => {
    const points = risingHistory(80, 100);
    const last = points[points.length - 1]!;
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000, "2026-06-15")],
      },
      insider: {
        transactions: [purchase()],
      },
      technicals: {
        points,
        currentPrice: last.close,
        fiftyTwoWeekHigh: last.close,
        fiftyTwoWeekLow: 90,
      },
      now: new Date("2026-07-28"),
    });

    expect(result.includedCategories).toContain("insider");
    expect(result.coverage).toBeGreaterThan(0.8);
    expect(result.score).not.toBeNull();
  });

  it("includes technicals and short interest in coverage", () => {
    const points = risingHistory(80, 100);
    const last = points[points.length - 1]!;
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000, "2026-06-15"), row("Increased", 250_000, "2026-06-15")],
      },
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
      now: new Date("2026-07-28"),
    });

    expect(result.coverage).toBeCloseTo(0.84);
    expect(result.score).not.toBeNull();
    expect(result.includedCategories).toEqual([
      "institutional",
      "technicals",
      "short_interest",
    ]);
  });

  it("withholds the score when only institutional is present", () => {
    const result = buildConvictionScore({
      ticker: "AAPL",
      institutional: {
        results: [row("New", 500_000)],
      },
      now: new Date("2026-07-28"),
    });

    expect(result.score).toBeNull();
    expect(result.label).toBe("insufficient_evidence");
    expect(result.coverage).toBeCloseTo(0.34);
  });

  it("maps signed composite onto 0–100 display helpers", () => {
    expect(dialValueFromScore(0)).toBe(50);
    expect(dialValueFromScore(100)).toBe(100);
    expect(dialValueFromScore(-100)).toBe(0);
    expect(displayScoreFromSigned(71)).toBe(86);
    expect(displayLabelForComposite("strong_positive")).toBe("Accumulating");
  });
});
