import { describe, expect, it } from "vitest";
import { buildPortfolioValueBrief } from "@/lib/portfolio/value-brief";

describe("portfolio value brief", () => {
  it("calls out a single binding concentration", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "NVDA", weight: 28 },
      { ticker: "MSFT", weight: 18 },
      { ticker: "GOOG", weight: 14 },
      { ticker: "AMZN", weight: 10 },
    ]);

    expect(brief.tone).toBe("concentrated");
    expect(brief.headline).toContain("NVDA");
    expect(brief.summary).toContain("5.6%");
  });

  it("distinguishes top-three concentration without an oversized single holding", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "AAA", weight: 21 },
      { ticker: "BBB", weight: 20 },
      { ticker: "CCC", weight: 20 },
      { ticker: "DDD", weight: 15 },
    ]);

    expect(brief.tone).toBe("watch");
    expect(brief.headline).toContain("Three positions");
    expect(brief.topThreeWeight).toBe(61);
  });

  it("recognizes an evenly sized book", () => {
    const brief = buildPortfolioValueBrief([
      { ticker: "AAA", weight: 10 },
      { ticker: "BBB", weight: 10 },
      { ticker: "CCC", weight: 10 },
      { ticker: "DDD", weight: 10 },
      { ticker: "EEE", weight: 10 },
      { ticker: "FFF", weight: 10 },
    ]);

    expect(brief.tone).toBe("balanced");
    expect(brief.headline).toContain("balanced");
  });
});
