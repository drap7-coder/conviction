import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  personalSnapshotTickers,
  selectPulseHomeStories,
} from "@/lib/market/pulse-home";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function theme(
  id: string,
  title: string,
  score = 50,
  extras: Partial<MarketNarrativeTheme> = {},
): MarketNarrativeTheme {
  const headline = {
    title,
    url: `https://example.com/${id}`,
    date: "2026-10-12T12:00:00.000Z",
    publisher: "Reuters",
    imageUrl: null,
  };
  return {
    id,
    label: id,
    heatmapGroup: "Major Index",
    heat: "building",
    marketTone: "mixed",
    score,
    velocity: 1,
    summary: `${id} summary`,
    headline,
    headlines: [headline],
    newsTicker: "SPY",
    assets: [],
    ...extras,
  };
}

describe("Home personal intelligence", () => {
  it("keeps the brief on Home and market tables on Pulse", () => {
    const home = read("src/components/market/HomeOverview.tsx");
    const strip = read("src/components/market/HomeMarketStrip.tsx");
    const pulse = read("src/components/market/PulseDashboard.tsx");
    const page = read("src/app/page.tsx");
    expect(home).not.toContain("home-macro");
    expect(home).not.toContain("<HomeMarketStrip");
    expect(home).toContain("<HomePersonalBrief");
    expect(read("src/components/HomePersonalBrief.tsx")).toContain("loadHomeNames");
    expect(home).not.toContain("PulseYourStocks");
    expect(strip).toContain("PulseMacroGauges");
    expect(strip).toContain("IndexScoreboard");
    expect(strip).toContain("CommodityScoreboard");
    expect(strip).toContain("SectorScoreboard");
    expect(strip).toContain("HomeSectionCoord");
    expect(strip).toContain('href="/pulse"');
    expect(strip).not.toContain("PersonalDailyBrief");
    expect(read("src/components/market/MarketDataGrid.tsx")).toContain("MarketGridSpark");
    expect(read("src/components/market/MarketDataGrid.tsx")).toContain("buildSparklineGeometry");
    expect(read("src/app/globals.css")).toContain("market-data-grid-spark");
    expect(read("src/app/globals.css")).toContain("market-data-grid-row:hover::before");
    expect(page).toContain("<HomeOverview");
    expect(pulse).toContain("<PulseMarketBoard");
    expect(pulse).not.toContain("PersonalDailyBrief");
    const pulseBoard = read("src/components/market/PulseMarketBoard.tsx");
    const gaugesJsx = pulseBoard.indexOf("<PulseMacroGauges");
    const indexesJsx = pulseBoard.indexOf("<IndexScoreboard");
    const commoditiesJsx = pulseBoard.indexOf("<CommodityScoreboard");
    expect(gaugesJsx).toBeGreaterThan(-1);
    expect(gaugesJsx).toBeLessThan(indexesJsx);
    expect(indexesJsx).toBeLessThan(commoditiesJsx);
  });

  it("keeps the personal brief on Home — not Portfolio or Pulse", () => {
    expect(read("src/components/Portfolio.tsx")).not.toContain("PersonalBrief");
    expect(read("src/components/HomePersonalBrief.tsx")).toContain("<PersonalDailyBrief");
    expect(read("src/components/market/HomeOverview.tsx")).toContain(
      "<HomePersonalBrief",
    );
    expect(read("src/components/PersonalDailyBrief.tsx")).toContain(
      "Build your watchlist",
    );
    expect(read("src/components/PersonalDailyBrief.tsx")).toContain("<BriefIntelligence");
    expect(read("src/components/PersonalDailyBrief.tsx")).toContain("scaffold");
    expect(read("src/components/PersonalDailyBrief.tsx")).toContain("<BriefQuantOverlay");
  });

  it("selects a distinct Worth Understanding story after the brief (helpers)", () => {
    const themes = [
      theme("ai-compute", "Chip makers lead the session", 90),
      theme("rates-fed", "Treasury yields steady into the close", 80),
      theme("energy-oil", "Crude holds gains after inventory data", 70),
      theme("consumer-demand", "Retail traffic softens into the weekend", 60),
    ];
    const picked = selectPulseHomeStories(themes);
    expect(picked.todaysBrief).toHaveLength(3);
    expect(picked.worthUnderstanding?.id).toBe("consumer-demand");
  });

  it("orders personal snapshot holdings before watched names", () => {
    expect(
      personalSnapshotTickers(["AAPL", "MSFT"], ["NVDA", "AAPL", "AMD"], 6),
    ).toEqual(["AAPL", "MSFT", "NVDA", "AMD"]);
  });
});
