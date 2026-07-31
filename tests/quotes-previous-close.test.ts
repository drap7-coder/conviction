import { describe, expect, it } from "vitest";
import { resolvePreviousClose } from "@/lib/market/quotes";

describe("resolvePreviousClose", () => {
  it("prefers regularMarketPreviousClose over a stale chartPreviousClose", () => {
    expect(
      resolvePreviousClose({
        regularMarketPreviousClose: 200,
        previousClose: 199,
        chartPreviousClose: 174,
      }),
    ).toBe(200);
  });

  it("falls back through previousClose then chartPreviousClose", () => {
    expect(resolvePreviousClose({ previousClose: 188, chartPreviousClose: 174 })).toBe(188);
    expect(resolvePreviousClose({ chartPreviousClose: 174 })).toBe(174);
    expect(resolvePreviousClose({})).toBeNull();
  });

  it("keeps a +15% gap honest when the session previous close is used", () => {
    const price = 230;
    const previous = resolvePreviousClose({
      regularMarketPreviousClose: 200,
      chartPreviousClose: 174, // would falsely read ~+32%
    });
    expect(previous).toBe(200);
    expect(((price - previous!) / previous!) * 100).toBeCloseTo(15, 5);
  });
});
