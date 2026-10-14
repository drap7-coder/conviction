import { describe, expect, it } from "vitest";
import {
  buildCorrelationMatrix,
  buildQuantTelemetry,
  logReturns,
  olsBeta,
  priceZScore,
  realizedVolatility,
  returnCorrelation,
} from "@/lib/market/quant-telemetry";

function ramp(n: number, start = 100, step = 1): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

describe("quant telemetry (honest closes-only math)", () => {
  it("computes log returns and a trailing price z-score", () => {
    const closes = ramp(80, 100, 0.5);
    // Spike the last print above the window.
    closes[closes.length - 1] = 200;
    const z = priceZScore(closes, 60);
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(2);
    expect(logReturns([100, 110, 121])).toEqual([
      Math.log(1.1),
      Math.log(1.1),
    ]);
  });

  it("estimates OLS beta vs a benchmark series", () => {
    const bench = ramp(80, 100, 1).flatMap((value, i, arr) =>
      i === 0 ? [] : [Math.log(value / arr[i - 1])],
    );
    // Asset ≈ 1.5 × bench returns.
    const asset = bench.map((value) => value * 1.5);
    const beta = olsBeta(asset, bench);
    expect(beta).not.toBeNull();
    expect(beta!).toBeCloseTo(1.5, 5);
  });

  it("annualizes realized vol and builds pairwise correlations", () => {
    const flat = ramp(80, 100, 0);
    expect(realizedVolatility(flat, 60)).toBe(0);

    const a = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3));
    const b = a.map((value) => value * 1.02);
    const corr = returnCorrelation(logReturns(a), logReturns(b));
    expect(corr).not.toBeNull();
    expect(corr!).toBeGreaterThan(0.9);

    const matrix = buildCorrelationMatrix([
      { ticker: "AAA", returns: logReturns(a) },
      { ticker: "BBB", returns: logReturns(b) },
    ]);
    expect(matrix.values[0][0]).toBe(1);
    expect(matrix.values[0][1]).toBeCloseTo(corr!, 8);
  });

  it("flags ±2σ anomalies in ticker telemetry", () => {
    const closes = ramp(80, 100, 0.2);
    closes[closes.length - 1] = 40;
    const row = buildQuantTelemetry({
      ticker: "TEST",
      held: true,
      closes,
      benchReturns: logReturns(ramp(80, 100, 0.1)),
    });
    expect(row.anomaly).toBe(true);
    expect(row.zScore).not.toBeNull();
    expect(row.zScore!).toBeLessThan(-2);
  });
});
