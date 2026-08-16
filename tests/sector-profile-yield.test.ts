import { describe, expect, it } from "vitest";
import { normalizeYahooYieldPercent } from "@/lib/market/sector-profile";

describe("normalizeYahooYieldPercent", () => {
  it("converts Yahoo fractions into percents", () => {
    expect(normalizeYahooYieldPercent(0.0123)).toBeCloseTo(1.23, 5);
  });

  it("keeps values that are already percents", () => {
    expect(normalizeYahooYieldPercent(1.25)).toBe(1.25);
    expect(normalizeYahooYieldPercent(12)).toBe(12);
  });

  it("rejects invalid values", () => {
    expect(normalizeYahooYieldPercent(null)).toBeNull();
    expect(normalizeYahooYieldPercent(-0.1)).toBeNull();
    expect(normalizeYahooYieldPercent(Number.NaN)).toBeNull();
  });
});
