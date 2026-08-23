import { describe, expect, it } from "vitest";
import { buildPortfolioValueBrief } from "@/lib/portfolio/value-brief";

describe("portfolio value brief", () => {
  it("leads with Fit and Reliance instead of runs-the-book copy", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "NVDA", weight: 28, exposure: "Technology" },
      { ticker: "MSFT", weight: 18, exposure: "Technology" },
      { ticker: "GOOG", weight: 15, exposure: "Technology" },
      { ticker: "AMZN", weight: 10, exposure: "Consumer Discretionary" },
    ]);

    expect(brief.headline).toMatch(/^This book looks like /);
    expect(brief.headline).not.toMatch(/Closest to | · \d+$/);
    expect(brief.headline).not.toMatch(/runs the book/i);
    expect(brief.summary).toMatch(/^A lot rides on NVDA\. Reliance \d+\./);
    expect(brief.summary).toContain("5.6%");
    expect(brief.tone).toBe("concentrated");
    expect(brief.largest).toEqual({ ticker: "NVDA", weight: 28 });
    expect(brief.fit.primary).toBeTruthy();
    expect(brief.reliance.score).toBeGreaterThan(0);
  });

  it("does not say the top three run the book", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "AAA", weight: 21 },
      { ticker: "BBB", weight: 20 },
      { ticker: "CCC", weight: 20 },
      { ticker: "DDD", weight: 15 },
    ]);

    expect(brief.headline).toMatch(/^This book looks like /);
    expect(brief.headline).not.toMatch(/Top three run the book/i);
    expect(brief.summary).not.toMatch(/^Reliance /);
    expect(brief.summary).toMatch(/Reliance \d+\./);
    expect(brief.topThreeWeight).toBe(61);
  });

  it("still recognizes an evenly sized book without calling it a manager", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "AAA", weight: 10 },
      { ticker: "BBB", weight: 10 },
      { ticker: "CCC", weight: 10 },
      { ticker: "DDD", weight: 10 },
      { ticker: "EEE", weight: 10 },
      { ticker: "FFF", weight: 10 },
    ]);

    expect(brief.headline).toMatch(/^This book looks like /);
    expect(brief.headline).not.toMatch(/runs the book/i);
    expect(brief.summary).toMatch(/^The book is spread out\. Reliance \d+\./);
    expect(brief.largest?.weight).toBe(10);
  });
});
