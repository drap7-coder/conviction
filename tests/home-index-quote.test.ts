import { describe, expect, it } from "vitest";
import {
  homeIndexSessionLabel,
  resolveHomeIndexDisplayQuote,
  resolveHomeIndexLiveQuote,
} from "@/lib/market/home-index-quote";
import type { LiveQuoteInput } from "@/lib/market/live-quote";

function quote(overrides: Partial<LiveQuoteInput>): LiveQuoteInput {
  return {
    marketState: "PRE",
    price: 7757.17,
    change: 44.6,
    changePercent: 0.58,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    ...overrides,
  };
}

describe("resolveHomeIndexLiveQuote", () => {
  it("uses SPY pre-market % when cash SPX has no extended print", () => {
    const spx = quote({ marketState: "PRE" });
    const spy = quote({
      marketState: "PRE",
      price: 773.09,
      change: 4.04,
      changePercent: 0.53,
      preMarketPrice: 766.2,
      preMarketChange: -6.89,
      preMarketChangePercent: -0.89,
    });

    const live = resolveHomeIndexLiveQuote(
      spx,
      spy,
      new Date("2026-10-22T12:30:00Z"), // 8:30am ET pre-market
    );

    expect(live.label).toBe("Pre-Market");
    expect(live.changePercent).toBeCloseTo(-0.89, 2);
    expect(live.price).toBeCloseTo(7757.17 * (766.2 / 773.09), 1);
    expect(live.changePercent).toBeLessThan(0);
  });

  it("keeps the cash index regular move during RTH", () => {
    const spx = quote({
      marketState: "REGULAR",
      changePercent: 0.58,
      preMarketPrice: null,
    });
    const spy = quote({
      marketState: "REGULAR",
      price: 773.09,
      changePercent: 0.53,
      preMarketPrice: 766.2,
      preMarketChangePercent: -0.89,
    });

    const live = resolveHomeIndexLiveQuote(
      spx,
      spy,
      new Date("2026-10-22T15:00:00Z"), // 11:00am ET regular
    );

    expect(live.label).toBeNull();
    expect(live.changePercent).toBeCloseTo(0.58, 2);
    expect(live.price).toBeCloseTo(7757.17, 2);
  });

  it("prefers a real cash-index pre print when Yahoo provides one", () => {
    const spx = quote({
      marketState: "PRE",
      preMarketPrice: 7700,
      preMarketChange: -57.17,
      preMarketChangePercent: -0.74,
    });
    const spy = quote({
      marketState: "PRE",
      price: 773.09,
      preMarketPrice: 766.2,
      preMarketChangePercent: -0.89,
    });

    const live = resolveHomeIndexLiveQuote(
      spx,
      spy,
      new Date("2026-10-22T12:30:00Z"),
    );

    expect(live.label).toBe("Pre-Market");
    expect(live.price).toBeCloseTo(7700, 2);
    expect(live.changePercent).toBeCloseTo(-0.74, 2);
  });

  it("falls back to the cash quote when the proxy has no extended print either", () => {
    const spx = quote({ marketState: "PRE", changePercent: 0.58 });
    const spy = quote({
      marketState: "PRE",
      price: 773.09,
      changePercent: 0.53,
      preMarketPrice: null,
    });

    const live = resolveHomeIndexLiveQuote(
      spx,
      spy,
      new Date("2026-10-22T12:30:00Z"),
    );

    expect(live.changePercent).toBeCloseTo(0.58, 2);
  });
});

describe("homeIndexSessionLabel", () => {
  it("labels proxy-backed pre-market as Pre-Market, not Regular", () => {
    expect(
      homeIndexSessionLabel({
        price: 7700,
        change: -50,
        changePercent: -0.9,
        label: "Pre-Market",
        session: "pre_market",
      }),
    ).toBe("Pre-Market");
  });
});

describe("resolveHomeIndexDisplayQuote", () => {
  it("keeps yesterday's regular % alongside live pre-market %", () => {
    const spx = quote({
      marketState: "PRE",
      change: 54.1,
      changePercent: 0.7,
    });
    const spy = quote({
      marketState: "PRE",
      price: 773.09,
      change: 4.04,
      changePercent: 0.53,
      preMarketPrice: 775.18,
      preMarketChange: 2.09,
      preMarketChangePercent: 0.27,
    });

    const display = resolveHomeIndexDisplayQuote(
      spx,
      spy,
      new Date("2026-10-22T12:30:00Z"),
    );

    expect(display.sessionLabel).toBe("Pre-Market");
    expect(display.regularChangePercent).toBeCloseTo(0.7, 2);
    expect(display.liveChangePercent).toBeCloseTo(0.27, 2);
    expect(display.liveChangePercent).not.toBe(display.regularChangePercent);
  });

  it("uses only the regular print during RTH", () => {
    const spx = quote({
      marketState: "REGULAR",
      changePercent: 0.7,
    });
    const display = resolveHomeIndexDisplayQuote(
      spx,
      null,
      new Date("2026-10-22T15:00:00Z"),
    );

    expect(display.sessionLabel).toBeNull();
    expect(display.liveChangePercent).toBeCloseTo(0.7, 2);
    expect(display.regularChangePercent).toBeCloseTo(0.7, 2);
  });
});
