import { describe, expect, it } from "vitest";
import { buildPortfolioRiskXRay } from "@/lib/portfolio/risk-xray";

describe("portfolio risk x-ray", () => {
  it("identifies the leading sensitivity and preserves explainable drivers", () => {
    const result = buildPortfolioRiskXRay([
      { ticker: "NVDA", weight: 40, exposure: "Technology" },
      { ticker: "MSFT", weight: 25, exposure: "Technology" },
      { ticker: "GLD", weight: 20, exposure: "Gold" },
      { ticker: "XLE", weight: 15, exposure: "Energy" },
    ]);
    expect(result.headline).toContain("Growth & duration");
    expect(result.coverage).toBe(100);
    expect(result.factors.find((factor) => factor.id === "growth-duration")).toMatchObject({ score: 65, drivers: [{ ticker: "NVDA", weight: 40 }, { ticker: "MSFT", weight: 25 }] });
    expect(result.factors.find((factor) => factor.id === "inflation")?.score).toBe(35);
  });

  it("reports classification coverage and does not invent exposures", () => {
    const result = buildPortfolioRiskXRay([
      { ticker: "UNKNOWN", weight: 60, exposure: null },
      { ticker: "SGOV", weight: 40, exposure: "Short Treasuries" },
    ]);
    expect(result.coverage).toBe(40);
    expect(result.factors.find((factor) => factor.id === "defensive")?.score).toBe(40);
    expect(result.factors.find((factor) => factor.id === "economic-cycle")?.score).toBe(0);
  });

  it("handles an empty book", () => {
    const result = buildPortfolioRiskXRay([]);
    expect(result.coverage).toBe(0);
    expect(result.headline).toContain("No single");
    expect(result.factors.every((factor) => factor.score === 0)).toBe(true);
  });
});
