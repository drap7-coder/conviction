import { describe, expect, it } from "vitest";
import {
  flagConcentrationHoldings,
  formatConcentrationWeight,
} from "@/components/ConcentrationNotice";

describe("flagConcentrationHoldings", () => {
  it("returns empty when nothing crosses the watch mark", () => {
    expect(
      flagConcentrationHoldings([
        { ticker: "AAPL", name: "Apple", weight: 12 },
        { ticker: "MSFT", name: "Microsoft", weight: 11.9 },
      ]),
    ).toEqual([]);
  });

  it("flags watch and concentrated with shared 12/20 marks, heaviest first", () => {
    const flagged = flagConcentrationHoldings([
      { ticker: "WMT", name: "Walmart", weight: 16.3 },
      { ticker: "GS", name: "Goldman", weight: 16 },
      { ticker: "NVDA", name: "Nvidia", weight: 28 },
      { ticker: "CASH", name: "Cash", weight: 5 },
    ]);

    expect(flagged.map((row) => [row.ticker, row.severity])).toEqual([
      ["NVDA", "concentrated"],
      ["WMT", "watch"],
      ["GS", "watch"],
    ]);
  });

  it("treats exactly 20% as watch (matches computeRiskFlags)", () => {
    const flagged = flagConcentrationHoldings([
      { ticker: "X", name: "X", weight: 20 },
      { ticker: "Y", name: "Y", weight: 20.1 },
    ]);
    expect(flagged).toEqual([
      { ticker: "Y", name: "Y", weight: 20.1, severity: "concentrated" },
      { ticker: "X", name: "X", weight: 20, severity: "watch" },
    ]);
  });
});

describe("formatConcentrationWeight", () => {
  it("rounds to one decimal without trailing .0", () => {
    expect(formatConcentrationWeight(16.34)).toBe("16.3%");
    expect(formatConcentrationWeight(16)).toBe("16%");
  });
});
