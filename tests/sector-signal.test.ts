import { describe, expect, it } from "vitest";
import { getSectorSignal } from "@/lib/display/sector-signal";

describe("getSectorSignal", () => {
  it("marks strong leadership on a clear positive move", () => {
    const signal = getSectorSignal({
      name: "Technology",
      changePercent: 1.4,
      leaders: ["AAPL", "MSFT", "NVDA"],
    });
    expect(signal.strength).toBe("strong");
    expect(signal.conclusion).toContain("Technology");
    expect(signal.conclusion.toLowerCase()).toContain("strong");
    expect(signal.source).toBe("market_data");
    expect(signal.dateLabel).toBe("Today");
  });

  it("marks weak leadership on a clear negative move", () => {
    const signal = getSectorSignal({
      name: "Energy",
      changePercent: -1.2,
      leaders: ["XOM", "CVX"],
    });
    expect(signal.strength).toBe("weak");
    expect(signal.conclusion.toLowerCase()).toContain("weak");
  });

  it("marks mixed on a small move", () => {
    const signal = getSectorSignal({
      name: "Financials",
      changePercent: 0.2,
      leaders: ["JPM"],
    });
    expect(signal.strength).toBe("mixed");
  });

  it("awaits evidence when the move is missing", () => {
    const signal = getSectorSignal({
      name: "Utilities",
      changePercent: null,
      leaders: ["NEE"],
      description: "Electric utilities.",
    });
    expect(signal.strength).toBe("awaiting");
    expect(signal.conclusion.toLowerCase()).toContain("awaiting");
  });
});
