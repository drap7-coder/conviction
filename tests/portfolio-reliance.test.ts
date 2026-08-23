import { describe, expect, it } from "vitest";
import { computeReliance, relianceScore } from "@/lib/portfolio/reliance";

describe("computeReliance", () => {
  it("is zero on an empty book and does not invent a grade", () => {
    const result = computeReliance([]);
    expect(result.score).toBe(0);
    expect(result.largest).toBeNull();
    expect(result.tone).toBe("neutral");
    expect(result.summary).toBe("Weights resolve when quotes land.");
    expect(result.line).not.toMatch(/resilien|healthy|conviction score/i);
  });

  it("scores a single name as highly concentrated", () => {
    const result = computeReliance([{ ticker: "NVDA", weight: 100, exposure: "Technology" }]);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.largest).toEqual({ ticker: "NVDA", weight: 100 });
    expect(result.line).toMatch(/Reliance \d+ · NVDA 100% · Tech 100%/);
    expect(result.summary).toContain("A 20% move swings the book ~20.0%.");
    expect(result.tone).toBe("concentrated");
  });

  it("matches the example shape for a 28% name inside a 61% tech sleeve", () => {
    const result = computeReliance([
      { ticker: "NVDA", weight: 28, exposure: "Technology" },
      { ticker: "MSFT", weight: 18, exposure: "Technology" },
      { ticker: "GOOG", weight: 15, exposure: "Technology" },
      { ticker: "AMZN", weight: 10, exposure: "Consumer Discretionary" },
      { ticker: "JPM", weight: 9, exposure: "Financials" },
      { ticker: "XOM", weight: 8, exposure: "Energy" },
      { ticker: "JNJ", weight: 7, exposure: "Health Care" },
      { ticker: "PG", weight: 5, exposure: "Consumer Staples" },
    ]);
    expect(result.largest?.ticker).toBe("NVDA");
    expect(result.largestSleeve).toEqual({ label: "Technology", weight: 61 });
    expect(result.line).toBe(`Reliance ${result.score} · NVDA 28% · Tech 61%`);
    expect(result.summary).toContain("5.6%");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.tone).toBe("concentrated");
  });

  it("scores a 60/40-like book from the same 12 / 20 / 35 / 60 marks", () => {
    const result = computeReliance([
      { ticker: "VTI", weight: 60, exposure: "U.S. Equity" },
      { ticker: "BND", weight: 40, exposure: "Fixed Income" },
    ]);
    expect(result.score).toBeGreaterThan(50);
    expect(result.line).toMatch(/Reliance \d+ · VTI 60% · U\.S\. eq\. 60%/);
    expect(result.summary).toContain("A 20% move swings the book ~12.0%.");
  });

  it("scores an equal-weight growth-like book lower than a single-name book", () => {
    const growth = computeReliance([
      { ticker: "NVDA", weight: 10, exposure: "Technology" },
      { ticker: "AAPL", weight: 10, exposure: "Technology" },
      { ticker: "MSFT", weight: 10, exposure: "Technology" },
      { ticker: "AMZN", weight: 10, exposure: "Consumer Discretionary" },
      { ticker: "GOOG", weight: 10, exposure: "Communication Services" },
      { ticker: "META", weight: 10, exposure: "Communication Services" },
      { ticker: "AVGO", weight: 10, exposure: "Technology" },
      { ticker: "NFLX", weight: 10, exposure: "Communication Services" },
      { ticker: "CRM", weight: 10, exposure: "Technology" },
      { ticker: "COST", weight: 10, exposure: "Consumer Staples" },
    ]);
    const single = computeReliance([{ ticker: "NVDA", weight: 100, exposure: "Technology" }]);
    expect(growth.score).toBeLessThan(single.score);
    expect(growth.score).toBeLessThan(70);
    expect(growth.largest?.weight).toBe(10);
  });

  it("does not invert past the concentration marks into a health grade", () => {
    const atMarks = relianceScore({
      largestWeight: 20,
      largestSleeveWeight: 35,
      topThreeWeight: 60,
      elevated: true,
    });
    const pastMarks = relianceScore({
      largestWeight: 40,
      largestSleeveWeight: 70,
      topThreeWeight: 90,
      elevated: true,
    });
    expect(pastMarks).toBeGreaterThan(atMarks);
  });
});
