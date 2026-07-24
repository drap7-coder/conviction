import { describe, expect, it } from "vitest";
import {
  classifySectorLeadership,
} from "@/lib/market/sector-classification";

describe("classifySectorLeadership", () => {
  const ALL_SECTORS = [
    { name: "Technology", changePercent: 1.5 },
    { name: "Communication Services", changePercent: 1.2 },
    { name: "Consumer Discretionary", changePercent: 0.8 },
    { name: "Financials", changePercent: 0.5 },
    { name: "Industrials", changePercent: 0.3 },
    { name: "Materials", changePercent: 0.1 },
    { name: "Energy", changePercent: -0.2 },
    { name: "Consumer Staples", changePercent: -0.5 },
    { name: "Health Care", changePercent: -0.8 },
    { name: "Utilities", changePercent: -1.2 },
    { name: "Real Estate", changePercent: -1.5 },
  ];

  it("identifies leading and lagging sectors", () => {
    const result = classifySectorLeadership(ALL_SECTORS);
    expect(result.leading.length).toBeGreaterThan(0);
    expect(result.lagging.length).toBeGreaterThan(0);
    expect(result.leading[0].name).toBe("Technology");
    expect(result.lagging[result.lagging.length - 1].name).toBe("Real Estate");
  });

  it("returns cyclical-led interpretation when cyclical outperform defensive", () => {
    const cyclicalsHigh = [
      { name: "Energy", changePercent: 2.0 },
      { name: "Financials", changePercent: 1.8 },
      { name: "Industrials", changePercent: 1.5 },
      { name: "Consumer Discretionary", changePercent: 1.2 },
      { name: "Materials", changePercent: 1.0 },
      { name: "Technology", changePercent: 0.8 },
      { name: "Communication Services", changePercent: 0.5 },
      { name: "Consumer Staples", changePercent: -1.0 },
      { name: "Health Care", changePercent: -1.2 },
      { name: "Utilities", changePercent: -1.5 },
      { name: "Real Estate", changePercent: -1.8 },
    ];
    const result = classifySectorLeadership(cyclicalsHigh);
    expect(result.interpretation).toContain("Cyclical");
  });

  it("returns defensive-led interpretation when defensives outperform", () => {
    const defensivesHigh = [
      { name: "Consumer Staples", changePercent: 1.5 },
      { name: "Health Care", changePercent: 1.3 },
      { name: "Utilities", changePercent: 1.0 },
      { name: "Real Estate", changePercent: 0.8 },
      { name: "Technology", changePercent: -0.2 },
      { name: "Communication Services", changePercent: -0.3 },
      { name: "Consumer Discretionary", changePercent: -0.5 },
      { name: "Financials", changePercent: -0.8 },
      { name: "Industrials", changePercent: -1.0 },
      { name: "Materials", changePercent: -1.2 },
      { name: "Energy", changePercent: -1.5 },
    ];
    const result = classifySectorLeadership(defensivesHigh);
    expect(result.interpretation).toContain("Defensive");
  });

  it("returns mixed interpretation when no clear pattern", () => {
    const mixed = [
      { name: "Technology", changePercent: 0.3 },
      { name: "Financials", changePercent: 0.2 },
      { name: "Energy", changePercent: 0.1 },
      { name: "Health Care", changePercent: 0 },
      { name: "Consumer Staples", changePercent: -0.1 },
      { name: "Utilities", changePercent: -0.2 },
    ];
    const result = classifySectorLeadership(mixed);
    expect(result.interpretation).toBeTruthy();
  });

  it("handles single sector with data", () => {
    const result = classifySectorLeadership([
      { name: "Technology", changePercent: 1.5 },
      { name: "Energy", changePercent: null },
    ]);
    expect(result.leading).toHaveLength(1);
    expect(result.interpretation).toContain("Technology");
    expect(result.missingCount).toBe(1);
  });

  it("handles empty sector list", () => {
    const result = classifySectorLeadership([]);
    expect(result.leading).toHaveLength(0);
    expect(result.lagging).toHaveLength(0);
    expect(result.interpretation).toBeNull();
    expect(result.missingCount).toBe(0);
  });

  it("handles all null values", () => {
    const result = classifySectorLeadership([
      { name: "Technology", changePercent: null },
      { name: "Energy", changePercent: null },
    ]);
    expect(result.leading).toHaveLength(0);
    expect(result.missingCount).toBe(2);
  });

  it("classifies characteristics correctly", () => {
    const result = classifySectorLeadership(ALL_SECTORS);
    expect(result.characteristics.cyclical.length).toBeGreaterThan(0);
    expect(result.characteristics.defensive.length).toBeGreaterThan(0);
    expect(result.characteristics.growthSensitive.length).toBeGreaterThan(0);
    expect(result.characteristics.rateSensitive.length).toBeGreaterThan(0);
  });
});