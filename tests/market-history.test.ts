import { describe, expect, it } from "vitest";
import { buildHistory } from "@/lib/market/quotes";

describe("market price history", () => {
  it("builds clean chart history from Yahoo candles", () => {
    const history = buildHistory("WEN", "1m", {
      meta: {
        regularMarketPrice: 10.5,
        fiftyTwoWeekHigh: 20,
        fiftyTwoWeekLow: 8,
        marketCap: 2_000_000_000,
      },
      timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
      indicators: {
        quote: [{
          close: [10, null, 12],
        }],
      },
    });

    expect(history.points).toHaveLength(2);
    expect(history.startPrice).toBe(10);
    expect(history.endPrice).toBe(12);
    expect(history.change).toBe(2);
    expect(history.changePercent).toBe(20);
    expect(history.fiftyTwoWeekHigh).toBe(20);
    expect(history.fiftyTwoWeekLow).toBe(8);
    expect(history.marketCap).toBe(2_000_000_000);
  });
});
