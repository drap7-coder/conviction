import { describe, expect, it } from "vitest";
import { calculateConviction, type ConvictionSignal } from "@/lib/conviction/scoring";

const signal = (overrides: Partial<ConvictionSignal>): ConvictionSignal => ({
  key: "institutional", label: "Signal", weight: .3, score: 0,
  asOf: "2026-07-01", summary: "signal is neutral", ...overrides,
});

describe("calculateConviction", () => {
  it("renormalizes available evidence instead of treating missing as neutral", () => {
    const result = calculateConviction([
      signal({ weight: .3, score: 100 }),
      signal({ key: "insider", weight: .3, score: 50 }),
      signal({ key: "earnings", weight: .25, score: null }),
      signal({ key: "political", weight: .15, score: null }),
    ], new Date("2026-07-22"));
    expect(result.score).toBe(75);
    expect(result.coverage).toBeCloseTo(.6);
  });

  it("withholds the verdict below 50% coverage", () => {
    const result = calculateConviction([
      signal({ weight: .3, score: 100 }),
      signal({ key: "earnings", weight: .25, score: null }),
    ], new Date("2026-07-22"));
    expect(result.score).toBeNull();
    expect(result.direction).toBe("insufficient");
  });

  it("reduces confidence when any included source is stale", () => {
    const result = calculateConviction([
      signal({ weight: .3, score: 80, asOf: "2025-01-01" }),
      signal({ key: "insider", weight: .3, score: 70 }),
      signal({ key: "earnings", weight: .25, score: 60 }),
    ], new Date("2026-07-22"));
    expect(result.confidence).toBe("Medium");
  });
});
