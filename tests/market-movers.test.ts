import { describe, expect, it } from "vitest";
import {
  moverBarHeight,
  promoteMoversExtendedPrimary,
  rankByVolume,
  shouldRankMoversByExtended,
  splitMarketMovers,
} from "@/lib/market/market-movers";

describe("splitMarketMovers", () => {
  it("splits gainers and losers by session percent", () => {
    const split = splitMarketMovers(
      [
        { ticker: "A", name: "Alpha", changePercent: 4.2 },
        { ticker: "B", name: "Beta", changePercent: -3.1 },
        { ticker: "C", name: "Charlie", changePercent: 1.5 },
        { ticker: "D", name: "Delta", changePercent: -0.8 },
        { ticker: "E", name: "Echo", changePercent: 0 },
        { ticker: "F", name: "Foxtrot", changePercent: null },
      ],
      5,
    );

    expect(split.top.map((row) => row.ticker)).toEqual(["A", "C"]);
    expect(split.bottom.map((row) => row.ticker)).toEqual(["B", "D"]);
  });

  it("caps each column and ranks Top high-to-low, Bottom low-to-high", () => {
    const split = splitMarketMovers(
      [
        { ticker: "T1", name: "One", changePercent: 1 },
        { ticker: "T2", name: "Two", changePercent: 9 },
        { ticker: "T3", name: "Three", changePercent: 4 },
        { ticker: "B1", name: "Down1", changePercent: -1 },
        { ticker: "B2", name: "Down2", changePercent: -8 },
        { ticker: "B3", name: "Down3", changePercent: -3 },
      ],
      2,
    );

    expect(split.top.map((row) => row.ticker)).toEqual(["T2", "T3"]);
    expect(split.bottom.map((row) => row.ticker)).toEqual(["B2", "B3"]);
  });

  it("allows more than ten names per side for full watchlists", () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      ticker: `U${index}`,
      name: `Up ${index}`,
      changePercent: 12 - index,
    }));
    const split = splitMarketMovers(items, items.length);
    expect(split.top).toHaveLength(12);
    expect(split.bottom).toHaveLength(0);
  });

  it("ranks Pre-Market Gainers descending by extendedChangePercent, not RTH %", () => {
    const split = splitMarketMovers(
      [
        {
          ticker: "FLAT_PRE_UP",
          name: "Flat RTH, hot pre",
          changePercent: 0.1,
          price: 100,
          change: 0.1,
          extendedPrice: 108,
          extendedChange: 8,
          extendedChangePercent: 8,
          sessionLabel: "Pre-Market",
        },
        {
          ticker: "HOT_RTH_COOL_PRE",
          name: "Hot RTH, cool pre",
          changePercent: 5,
          price: 50,
          change: 2.5,
          extendedPrice: 50.5,
          extendedChange: 0.5,
          extendedChangePercent: 1,
          sessionLabel: "Pre-Market",
        },
        {
          ticker: "MID_PRE",
          name: "Mid pre",
          changePercent: -2,
          price: 20,
          change: -0.4,
          extendedPrice: 21,
          extendedChange: 1,
          extendedChangePercent: 5,
          sessionLabel: "Pre-Market",
        },
        {
          ticker: "PRE_DOWN",
          name: "Pre loser",
          changePercent: 3,
          price: 40,
          change: 1.2,
          extendedPrice: 38,
          extendedChange: -2,
          extendedChangePercent: -5,
          sessionLabel: "Pre-Market",
        },
        {
          ticker: "NO_PRINT",
          name: "No trades",
          changePercent: 9,
          price: 10,
          change: 0.9,
          extendedNoTrades: true,
          extendedChangePercent: null,
          sessionLabel: "Pre-Market",
        },
      ],
      5,
      { rankBy: "extended" },
    );

    expect(split.top.map((row) => row.ticker)).toEqual([
      "FLAT_PRE_UP",
      "MID_PRE",
      "HOT_RTH_COOL_PRE",
    ]);
    expect(split.top.map((row) => row.changePercent)).toEqual([8, 5, 1]);
    // Dual print: bold pre print, prior RTH close on the sun-icon line.
    expect(split.top[0].price).toBe(108);
    expect(split.top[0].change).toBe(8);
    expect(split.top[0].extendedPrice).toBe(100);
    expect(split.top[0].extendedChange).toBe(0.1);
    expect(split.top[0].extendedChangePercent).toBe(0.1);
    expect(split.top[0].priorCloseSecondary).toBe(true);
    expect(split.top[0].sessionLabel).toBe("Pre-Market");
    expect(split.bottom.map((row) => row.ticker)).toEqual(["PRE_DOWN"]);
    expect(split.bottom[0].changePercent).toBe(-5);
    expect(split.bottom[0].extendedChangePercent).toBe(3);

    // Strict descending order by the ranked (pre) %.
    let previous = Infinity;
    for (const row of split.top) {
      expect(row.changePercent).toBeLessThanOrEqual(previous);
      previous = row.changePercent;
    }
  });

  it("keeps RTH ranking when rankBy is regular even if pre fields exist", () => {
    const split = splitMarketMovers(
      [
        {
          ticker: "A",
          name: "A",
          changePercent: 2,
          extendedChangePercent: 9,
          sessionLabel: "Pre-Market",
        },
        {
          ticker: "B",
          name: "B",
          changePercent: 4,
          extendedChangePercent: 1,
          sessionLabel: "Pre-Market",
        },
      ],
      5,
      { rankBy: "regular" },
    );
    expect(split.top.map((row) => row.ticker)).toEqual(["B", "A"]);
    expect(split.top[0].changePercent).toBe(4);
  });
});

describe("shouldRankMoversByExtended", () => {
  it("is true only for Pre-Market and After Hours badges", () => {
    expect(shouldRankMoversByExtended("Pre-Market")).toBe(true);
    expect(shouldRankMoversByExtended("After Hours")).toBe(true);
    expect(shouldRankMoversByExtended(null)).toBe(false);
    expect(shouldRankMoversByExtended("Regular")).toBe(false);
  });
});

describe("promoteMoversExtendedPrimary", () => {
  it("swaps volume rows onto the same dual-print stack as Gainers", () => {
    const promoted = promoteMoversExtendedPrimary({
      ticker: "VOL",
      name: "Volume",
      changePercent: 2,
      price: 40,
      change: 0.8,
      extendedPrice: 42,
      extendedChange: 2,
      extendedChangePercent: 5,
      sessionLabel: "Pre-Market",
      dollarVolume: 9_000,
    });
    expect(promoted.price).toBe(42);
    expect(promoted.changePercent).toBe(5);
    expect(promoted.extendedPrice).toBe(40);
    expect(promoted.extendedChangePercent).toBe(2);
    expect(promoted.priorCloseSecondary).toBe(true);
  });
});

describe("rankByVolume", () => {
  it("ranks by dollar volume then caps", () => {
    const rows = rankByVolume(
      [
        { ticker: "A", name: "A", changePercent: 1, dollarVolume: 1_000 },
        { ticker: "B", name: "B", changePercent: -2, dollarVolume: 9_000 },
        { ticker: "C", name: "C", changePercent: 0.5, dollarVolume: 4_000 },
        { ticker: "D", name: "D", changePercent: 3, volume: 50 },
      ],
      2,
    );
    expect(rows.map((row) => row.ticker)).toEqual(["B", "C"]);
  });

  it("falls back to share volume when dollar volume is missing", () => {
    const rows = rankByVolume(
      [
        { ticker: "A", name: "A", changePercent: 1, volume: 100 },
        { ticker: "B", name: "B", changePercent: -1, volume: 500 },
      ],
      2,
    );
    expect(rows.map((row) => row.ticker)).toEqual(["B", "A"]);
  });
});

describe("moverBarHeight", () => {
  it("scales against the column max and keeps a visible floor", () => {
    expect(moverBarHeight(5, 10)).toBe(50);
    expect(moverBarHeight(10, 10)).toBe(100);
    expect(moverBarHeight(0.2, 10)).toBe(8);
    expect(moverBarHeight(4, 0)).toBe(0);
  });
});
