import { describe, expect, it } from "vitest";
import { moverBarHeight, rankByVolume, splitMarketMovers } from "@/lib/market/market-movers";

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
