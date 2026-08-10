import { describe, expect, it } from "vitest";
import {
  buildSparklineGeometry,
  sparklineToneFromChange,
  sparklineValuesFromQuote,
} from "@/lib/display/sparkline";

describe("sparkline helpers", () => {
  it("builds a path and last point from closes", () => {
    const geometry = buildSparklineGeometry([10, 12, 11, 14], 120, 36);
    expect(geometry).not.toBeNull();
    expect(geometry!.path.startsWith("M")).toBe(true);
    expect(geometry!.lastX).toBeGreaterThan(100);
  });

  it("maps change percent to tone", () => {
    expect(sparklineToneFromChange(1.2)).toBe("positive");
    expect(sparklineToneFromChange(-0.8)).toBe("negative");
    expect(sparklineToneFromChange(0)).toBe("neutral");
  });

  it("prefers quote history and stubs from price when needed", () => {
    expect(
      sparklineValuesFromQuote({
        sparkline: Array.from({ length: 20 }, (_, i) => ({ close: 100 + i })),
      }),
    ).toHaveLength(15);

    const stub = sparklineValuesFromQuote({
      sparkline: [],
      price: 110,
      previousClose: 100,
      limit: 5,
    });
    expect(stub).toHaveLength(5);
    expect(stub[0]).toBeCloseTo(100);
    expect(stub[4]).toBeCloseTo(110);
  });
});
