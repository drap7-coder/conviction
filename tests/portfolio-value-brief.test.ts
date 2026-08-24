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

    expect(brief.headline).toBe("This book is built to grow.");
    expect(brief.headline).not.toMatch(/Looks like |Dogs of the Dow|60\/40|All-Weather/);
    expect(brief.headline).not.toMatch(/runs the book/i);
    expect(brief.construction).toMatch(/stocks|ballast/i);
    expect(brief.stake).toBe("NVDA is 28% of the book. That name has to work.");
    expect(brief.summary).toBe("NVDA has to be right.");
    expect(brief.summary).not.toContain("5.6%");
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

    expect(brief.headline).toMatch(/^This book /);
    expect(brief.headline).not.toMatch(/Looks like |Dogs of the Dow/);
    expect(brief.headline).not.toMatch(/Top three run the book/i);
    expect(brief.summary).not.toMatch(/^Reliance /);
    expect(brief.summary).not.toMatch(/Reliance \d+\./);
    expect(brief.summary).toMatch(/has to be right\.$|is a large piece\.$|The book is spread out\.$/);
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

    expect(brief.headline).toMatch(/^This book /);
    expect(brief.headline).not.toMatch(/Looks like |Dogs of the Dow/);
    expect(brief.headline).not.toMatch(/runs the book/i);
    expect(brief.stake).toBe("No single name has to be right.");
    expect(brief.summary).toBe("The book is spread out.");
    expect(brief.largest?.weight).toBe(10);
  });

  it("describes a 60/40 book as stocks plus ballast, not a template name", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "VTI", weight: 60, exposure: "U.S. Equity" },
      { ticker: "BND", weight: 40, exposure: "Fixed Income" },
    ]);
    expect(brief.headline).toBe("This book balances growth and ballast.");
    expect(brief.construction).toBe("Stocks for growth, bonds for ballast.");
    expect(brief.construction).not.toMatch(/60\/40|Dogs of the Dow|All-Weather/);
  });
});
