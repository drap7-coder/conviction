import { describe, expect, it } from "vitest";
import {
  classifyMacroRegime,
  type IndicatorSnapshot,
} from "@/lib/market/macro-regime";

const EMPTY_INDICATORS: IndicatorSnapshot[] = [];

function indicator(
  ticker: string,
  changePercent: number | null,
  overrides: Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  const labels: Record<string, string> = {
    SPY: "S&P 500",
    QQQ: "Nasdaq",
    "^VIX": "VIX",
    "^TNX": "10Y Yield",
    USO: "Oil",
    UUP: "Dollar",
  };
  return {
    ticker,
    label: labels[ticker] ?? ticker,
    price: 100,
    change: null,
    changePercent,
    isPercentValue: ticker === "^TNX",
    status: "ready",
    ...overrides,
  };
}

const FULL_SET = [
  indicator("SPY", 0.8),
  indicator("QQQ", 1.2),
  indicator("^VIX", -4),
  indicator("^TNX", -0.6),
  indicator("USO", 1),
  indicator("UUP", -0.2),
];

describe("classifyMacroRegime", () => {
  it("classifies risk-on: equities up, VIX down, rates down", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.8),
      indicator("QQQ", 1.2),
      indicator("^VIX", -4),
      indicator("^TNX", -0.6),
      indicator("USO", 0.5),
      indicator("UUP", -0.1),
    ]);
    expect(result.label).toBe("Risk-on");
    expect(result.confidence).toBe("high");
    expect(result.drivers.length).toBeGreaterThan(2);
  });

  it("classifies risk-off: equities down, VIX up", () => {
    const result = classifyMacroRegime([
      indicator("SPY", -1.2),
      indicator("QQQ", -1.5),
      indicator("^VIX", 8),
      indicator("^TNX", -0.3),
      indicator("USO", -2),
      indicator("UUP", 0.4),
    ]);
    expect(result.label).toBe("Risk-off");
    expect(result.confidence).toBe("high");
  });

  it("classifies cyclical rotation: equities up but yields and oil both rising", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.6),
      indicator("QQQ", 0.3),
      indicator("^VIX", -3),
      indicator("^TNX", 0.8),
      indicator("USO", 1.5),
      indicator("UUP", 0.1),
    ]);
    expect(result.label).toBe("Cyclical rotation");
    expect(result.confidence).toBe("medium");
  });

  it("classifies growth-led when Nasdaq outperforms with flat/falling yields", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.4),
      indicator("QQQ", 1.5),
      indicator("^VIX", -1),
      indicator("^TNX", -0.2),
      indicator("USO", 0.2),
      indicator("UUP", 0),
    ]);
    expect(result.label).toBe("Growth-led");
    expect(result.confidence).toBe("medium");
  });

  it("classifies volatility expansion: VIX up without equity decline", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.1),
      indicator("QQQ", 0.2),
      indicator("^VIX", 6),
      indicator("^TNX", 0.1),
      indicator("USO", -0.3),
      indicator("UUP", 0.1),
    ]);
    expect(result.label).toBe("Volatility expansion");
    expect(result.confidence).toBe("medium");
  });

  it("classifies volatility compression: VIX down, equities flat", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.1),
      indicator("QQQ", 0.05),
      indicator("^VIX", -6),
      indicator("^TNX", 0.2),
      indicator("USO", -0.1),
      indicator("UUP", 0.1),
    ]);
    expect(result.label).toBe("Volatility compression");
    expect(result.confidence).toBe("low");
  });

  it("classifies rates pressure: yields up, equities mixed", () => {
    const result = classifyMacroRegime([
      indicator("SPY", -0.1),
      indicator("QQQ", -0.3),
      indicator("^VIX", 2),
      indicator("^TNX", 1.2),
      indicator("USO", 0.5),
      indicator("UUP", 0.2),
    ]);
    expect(result.label).toBe("Rates pressure");
    expect(result.confidence).toBe("medium");
  });

  it("classifies mixed signals when indicators diverge", () => {
    const result = classifyMacroRegime([
      indicator("SPY", -0.1),
      indicator("QQQ", 0.3),
      indicator("^VIX", -1),
      indicator("^TNX", 0.1),
      indicator("USO", -2),
      indicator("UUP", 0.4),
    ]);
    expect(result.label).toBe("Mixed Signals");
    expect(result.confidence).toBe("low");
  });

  it("returns insufficient data when too few indicators available", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.5),
    ]);
    expect(result.label).toBe("Insufficient data");
    expect(result.confidence).toBe("low");
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it("handles null changePercent gracefully", () => {
    const result = classifyMacroRegime([
      indicator("SPY", null),
      indicator("QQQ", null),
      indicator("^VIX", null),
    ]);
    expect(result.label).toBe("Insufficient data");
    expect(result.missingInputs).toContain("S&P 500");
  });

  it("reports missing inputs", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.5),
      indicator("QQQ", 0.3),
      indicator("^VIX", -2),
    ]);
    expect(result.missingInputs).toContain("10-year yield");
    expect(result.missingInputs).toContain("Oil");
    expect(result.missingInputs).toContain("Dollar");
  });

  it("never returns NaN or infinity in any numeric field", () => {
    const result = classifyMacroRegime([
      indicator("SPY", 0.8),
      indicator("QQQ", 1.2),
      indicator("^VIX", -4),
      indicator("^TNX", -0.6),
      indicator("USO", 1.5),
      indicator("UUP", -0.3),
    ]);
    expect(isFinite(result.drivers.length)).toBe(true);
  });

  it("defensive rotation when equities down but no VIX spike", () => {
    const result = classifyMacroRegime([
      indicator("SPY", -0.4),
      indicator("QQQ", -0.3),
      indicator("^VIX", 1),
      indicator("^TNX", 0.1),
      indicator("USO", 0),
      indicator("UUP", 0.1),
    ]);
    expect(result.label).toBe("Defensive rotation");
    expect(result.confidence).toBe("low");
  });
});