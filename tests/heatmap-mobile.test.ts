import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("quote scoreboards (no product heatmaps)", () => {
  it("removes the orphan StockHeatmap / HeatmapGrid / HeatTile stack", () => {
    expect(existsSync(resolve("src/components/StockHeatmap.tsx"))).toBe(false);
    expect(existsSync(resolve("src/components/HeatmapGrid.tsx"))).toBe(false);
    expect(existsSync(resolve("src/components/HeatTile.tsx"))).toBe(false);
  });

  it("uses movers-style Top/Bottom boards on Watchlist and index scoreboards on Pulse", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const pulse = read("src/components/market/PulseBoard.tsx");
    const board = read("src/components/market/IndexScoreboard.tsx");
    const movers = read("src/components/market/MarketMoversBoard.tsx");

    expect(watchlist).toContain("MarketMoversBoard");
    expect(watchlist).toContain("splitMarketMovers");
    expect(watchlist).not.toContain("StockHeatmap");
    expect(watchlist).not.toContain("MarketScoreboard");
    expect(pulse).toContain("InternationalScoreboard");
    expect(pulse).toContain("SectorScoreboard");
    expect(pulse).not.toContain("GlobalMarketsHeatmap");
    expect(board).toContain("SessionQuoteStack");
    expect(board).not.toContain("pulse-move-bar");
    expect(movers).toContain("SessionQuoteStack");
    expect(movers).not.toContain("pulse-move-bar");
    expect(movers).toContain("headerAction");
  });

  it("keeps Pulse free of heatmap shells for markets", () => {
    const page = read("src/components/market/PulseBoard.tsx");
    expect(page).not.toContain("GlobalMarketsHeatmap");
    expect(page).not.toContain("StockHeatmap");
    expect(page).toContain("IndexScoreboard");
    expect(page).toContain("CommodityScoreboard");
    expect(page).toContain("CryptoBoard");
  });
});
