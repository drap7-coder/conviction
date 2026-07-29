import { describe, expect, it } from "vitest";
import {
  buildConvictionScore,
  dialValueFromScore,
  displayLabelForComposite,
  displayScoreFromSigned,
  toInstitutionalCategoryScore,
  toShortInterestCategoryScore,
  toTechnicalsCategoryScore,
} from "@/lib/conviction/score";
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
    expect(category.baseWeight).toBe(0.45);
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
    expect(category.baseWeight).toBe(0.38);
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
    expect(category.baseWeight).toBe(0.17);
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

    expect(result.coverage).toBeCloseTo(0.83);
    expect(result.score).not.toBeNull();
    expect(result.label).not.toBe("insufficient_evidence");
    expect(result.includedCategories).toEqual(["institutional", "technicals"]);
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

    expect(result.coverage).toBeCloseTo(1);
    expect(result.score).not.toBeNull();
    expect(result.includedCategories).toEqual([
      "institutional",
      "technicals",
      "short_interest",
    ]);
    expect(result.excludedCategories).toEqual([]);
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
    expect(result.coverage).toBeCloseTo(0.45);
  });

  it("maps signed composite onto 0–100 display helpers", () => {
    expect(dialValueFromScore(0)).toBe(50);
    expect(dialValueFromScore(100)).toBe(100);
    expect(dialValueFromScore(-100)).toBe(0);
    expect(displayScoreFromSigned(71)).toBe(86);
    expect(displayLabelForComposite("strong_positive")).toBe("Accumulating");
  });
});
