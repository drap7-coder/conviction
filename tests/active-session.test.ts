import { describe, expect, it } from "vitest";
import { activeSessionPercent, hasExtendedPrint } from "../src/lib/display/active-session";

describe("summary and quote session agreement", () => {
  it("uses the regular print during regular hours", () => {
    expect(activeSessionPercent({ regularChangePercent: 1.2, changePercent: 9 })).toBe(1.2);
    expect(activeSessionPercent({ changePercent: -2 })).toBe(-2);
  });
  it.each(["Pre-Market", "After Hours"])("uses only the available %s print", (sessionLabel) => {
    const quote = { sessionLabel, regularChangePercent: -2.94, extendedPrice: 53.02, extendedChangePercent: -1.49 };
    expect(hasExtendedPrint(quote)).toBe(true);
    expect(activeSessionPercent(quote)).toBe(-1.49);
    expect(activeSessionPercent({ ...quote, extendedNoTrades: true })).toBeNull();
    expect(activeSessionPercent({ ...quote, extendedPrice: null })).toBeNull();
    expect(activeSessionPercent({ ...quote, extendedChangePercent: null })).toBeNull();
  });
  it("preserves a zero move and excludes invalid data", () => {
    expect(activeSessionPercent({ changePercent: 0 })).toBe(0);
    expect(activeSessionPercent({ changePercent: NaN })).toBeNull();
    expect(activeSessionPercent({ changePercent: Infinity })).toBeNull();
  });
});
