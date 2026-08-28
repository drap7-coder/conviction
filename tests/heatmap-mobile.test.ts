import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEATMAP_MOBILE_PREVIEW } from "@/components/HeatmapGrid";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("quote scoreboards (no product heatmaps)", () => {
  it("keeps the shared HeatmapGrid collapse helper for any leftover grids", () => {
    expect(HEATMAP_MOBILE_PREVIEW).toBe(6);
  });

  it("uses movers-style Top/Bottom boards on Watchlist and index scoreboards on Pulse", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const pulse = read("src/app/pulse/page.tsx");
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
    const page = read("src/app/pulse/page.tsx");
    expect(page).not.toContain("GlobalMarketsHeatmap");
    expect(page).not.toContain("StockHeatmap");
    expect(page).toContain("IndexScoreboard");
    expect(page).toContain("CommodityScoreboard");
    expect(page).toContain("CryptoBoard");
  });
});
