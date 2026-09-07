import { describe, expect, it } from "vitest";
import { analyzeSandbox, equalizeSandboxHoldings, normalizeSandboxHoldings } from "@/lib/portfolio/sandbox";
import { readFileSync } from "node:fs";

describe("portfolio sandbox", () => {
  it("equalizes a draft to exactly 100 percent", () => {
    const rows = equalizeSandboxHoldings([
      { ticker: "AAPL", weight: 0 },
      { ticker: "GLD", weight: 0 },
      { ticker: "BND", weight: 0 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.weight, 0)).toBe(100);
    expect(rows.map((row) => row.weight)).toEqual([33.3, 33.3, 33.4]);
  });

  it("normalizes arbitrary allocations while preserving tickers", () => {
    const rows = normalizeSandboxHoldings([
      { ticker: "VTI", weight: 60 },
      { ticker: "BND", weight: 20 },
    ]);
    expect(rows).toEqual([{ ticker: "VTI", weight: 75 }, { ticker: "BND", weight: 25 }]);
  });

  it("raises construction risk for a concentrated speculative book", () => {
    const diversified = analyzeSandbox([
      { ticker: "VTI", weight: 25 }, { ticker: "VXUS", weight: 25 },
      { ticker: "BND", weight: 25 }, { ticker: "GLD", weight: 25 },
    ]);
    const concentrated = analyzeSandbox([{ ticker: "BTC-USD", weight: 100 }]);
    expect(concentrated.riskScore).toBeGreaterThan(diversified.riskScore);
    expect(concentrated.diversificationScore).toBeLessThan(diversified.diversificationScore);
  });

  it("treats unallocated capital as cash", () => {
    const analysis = analyzeSandbox([{ ticker: "MSFT", weight: 55 }]);
    expect(analysis.cashPct).toBe(45);
    expect(analysis.investedPct).toBe(55);
  });

  it("uses company-name typeahead for adding positions", () => {
    const component = readFileSync(new URL("../src/components/SandboxPortfolio.tsx", import.meta.url), "utf8");
    expect(component).toContain("CompanyTypeahead");
    expect(component).toContain('placeholder="Ticker or company name"');
    expect(component).toContain("addTicker(suggestion.ticker)");
    expect(component).toContain("LogoDisplay");
    expect(component).toContain("pf-sandbox-meter");
    expect(component).toContain("pf-sandbox-map");
  });
});
