import { describe, expect, it } from "vitest";
import { calculateExtendedHoursMove, inferMarketState } from "@/lib/market/quotes";

const periods = {
  pre: { start: 100, end: 200 },
  regular: { start: 200, end: 300 },
  post: { start: 300, end: 400 },
};

describe("market session inference", () => {
  it("recognizes pre-market, regular, after-hours, and closed periods", () => {
    expect(inferMarketState(periods, 150)).toBe("PRE");
    expect(inferMarketState(periods, 250)).toBe("REGULAR");
    expect(inferMarketState(periods, 350)).toBe("POST");
    expect(inferMarketState(periods, 450)).toBe("CLOSED");
  });
});

describe("extended-hours price impact", () => {
  it("compares premarket with yesterday's regular close, not the older chart close", () => {
    const move = calculateExtendedHoursMove(101.92, 105.45);
    expect(move.change).toBeCloseTo(-3.53);
    expect(move.changePercent).toBeCloseTo(-3.35, 1);
  });
});
