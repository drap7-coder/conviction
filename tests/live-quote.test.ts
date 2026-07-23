import { describe, expect, it } from "vitest";
import { getLivePrice, type LiveQuoteInput } from "@/lib/market/live-quote";

function quote(overrides: Partial<LiveQuoteInput>): LiveQuoteInput {
  return {
    marketState: "REGULAR",
    price: 100,
    change: 4,
    changePercent: 4.17,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    ...overrides,
  };
}

describe("getLivePrice", () => {
  it("calculates the after-hours move from the regular close", () => {
    const live = getLivePrice(quote({
      marketState: "POST",
      postMarketPrice: 101,
      postMarketChange: 4,
      postMarketChangePercent: 4.17,
    }));

    expect(live.label).toBe("After Hours");
    expect(live.change).toBeCloseTo(1);
    expect(live.changePercent).toBeCloseTo(1);
  });

  it("keeps the completed after-hours move visible once the market is closed", () => {
    const live = getLivePrice(quote({
      marketState: "CLOSED",
      price: 102.62,
      change: -2.83,
      changePercent: -2.68,
      postMarketPrice: 103.79,
      postMarketChange: -2.83,
      postMarketChangePercent: -2.68,
    }));

    expect(live.label).toBe("After Hours");
    expect(live.session).toBe("after_hours");
    expect(live.change).toBeCloseTo(1.17);
    expect(live.changePercent).toBeCloseTo(1.14, 2);
  });

  it("calculates the pre-market move from the prior regular close", () => {
    const live = getLivePrice(quote({
      marketState: "PRE",
      preMarketPrice: 98,
      preMarketChange: 4,
      preMarketChangePercent: 4.17,
    }));

    expect(live.label).toBe("Pre-Market");
    expect(live.change).toBeCloseTo(-2);
    expect(live.changePercent).toBeCloseTo(-2);
  });
});
