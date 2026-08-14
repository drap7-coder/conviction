import { describe, expect, it } from "vitest";
import {
  buildPersonalInsightBrief,
  buildPortfolioInsightBrief,
  buildStrategyDesignBrief,
} from "@/lib/portfolio/insight-brief";
import { SAMPLE_PORTFOLIO_BOOKS } from "@/lib/portfolio/sample-books";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";

function flags(overrides: Partial<PortfolioRiskFlags> = {}): PortfolioRiskFlags {
  return {
    singleConcentration: [],
    elevatedPositions: [],
    sectorConcentration: [],
    topThreeExceedsSixty: false,
    topThreeCombinedWeight: 0,
    missingCostCount: 0,
    missingPriceCount: 0,
    ...overrides,
  };
}

describe("portfolio insight brief", () => {
  it("teaches All-Weather as design, not a concentration failure", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "all-weather")!;
    const brief = buildStrategyDesignBrief(book);
    expect(brief).toMatchObject({
      mode: "strategy",
      label: "All-Weather",
    });
    expect(brief!.sleeves.map((sleeve) => sleeve.ticker)).toEqual(book.tickers);
    expect(brief!.stress.toLowerCase()).toContain("inflation");
  });

  it("teaches Dogs of the Dow as a yield screen, not concentration theater", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "dogs-of-the-dow")!;
    const brief = buildStrategyDesignBrief(book);
    expect(brief?.mode).toBe("strategy");
    expect(brief!.principle.toLowerCase()).toContain("yield");
    expect(brief!.sleeves).toHaveLength(10);
  });

  it("routes sample strategy books away from personal pressure scoring", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "sixty-forty")!;
    const brief = buildPortfolioInsightBrief(
      flags({
        singleConcentration: [{ ticker: "VTI", weight: 60 }],
        topThreeExceedsSixty: true,
        topThreeCombinedWeight: 100,
      }),
      book,
    );
    expect(brief.mode).toBe("strategy");
    if (brief.mode === "strategy") {
      expect(brief.principle.toLowerCase()).toContain("ballast");
    }
  });

  it("keeps personal findings sparse and score-free", () => {
    const brief = buildPersonalInsightBrief(
      flags({
        singleConcentration: [{ ticker: "NVDA", weight: 32 }],
        elevatedPositions: [{ ticker: "AAPL", weight: 15 }],
        missingCostCount: 1,
      }),
    );
    expect(brief.mode).toBe("personal");
    expect(brief.findings.some((item) => item.ticker === "NVDA")).toBe(true);
    // Elevated names stay quiet when a real concentration already fired.
    expect(brief.findings.some((item) => item.ticker === "AAPL")).toBe(false);
    expect(brief.findings.some((item) => item.id === "missing-cost")).toBe(true);
  });

  it("stays calm when a personal book has no pressure points", () => {
    const brief = buildPersonalInsightBrief(flags());
    expect(brief.findings).toEqual([]);
    expect(brief.headline.toLowerCase()).toContain("no single name");
  });
});
