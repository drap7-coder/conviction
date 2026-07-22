import { describe, expect, it } from "vitest";
import { inferMarketState } from "@/lib/market/quotes";

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
