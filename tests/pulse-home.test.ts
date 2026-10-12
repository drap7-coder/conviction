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

describe("Home for-you overview", () => {
  it("composes personal brief → market strip → Your Stocks (not a second Pulse)", () => {
    const home = read("src/components/market/HomeOverview.tsx");
    const pulse = read("src/components/market/PulseDashboard.tsx");
    const brief = home.indexOf("<PersonalDailyBrief");
    const strip = home.indexOf("<HomeMarketStrip");
    const stocks = home.indexOf("<PulseYourStocks");
    expect(brief).toBeGreaterThan(-1);
    expect(strip).toBeGreaterThan(brief);
    expect(stocks).toBeGreaterThan(strip);
    expect(home).not.toContain("PulseTodaysBrief");
    expect(home).not.toContain("PulseWorthUnderstanding");
    expect(home).not.toContain("PulseMarketBoard");
    expect(home).not.toContain("pf-crowd-invite");
    expect(pulse).toContain("<PulseMarketBoard");
    expect(pulse).not.toContain("PersonalDailyBrief");
    expect(pulse).not.toContain("PulseTodaysBrief");
    const stripSrc = read("src/components/market/HomeMarketStrip.tsx");
    expect(stripSrc).toContain("Open Pulse");
    expect(stripSrc).toContain("<PulseMacroGauges");
    expect(stripSrc).toContain("<IndexScoreboard");
    expect(stripSrc.indexOf("<PulseMacroGauges")).toBeLessThan(
      stripSrc.indexOf("<IndexScoreboard"),
    );
  });

  it("keeps the personal brief on Home only — not Portfolio Watchlist", () => {
    expect(read("src/components/Watchlist.tsx")).not.toContain("PersonalDailyBrief");
    expect(read("src/components/market/HomeOverview.tsx")).toContain(
      "<PersonalDailyBrief",
    );
    expect(read("src/components/market/PulseYourStocks.tsx")).toContain(
      "Build your watchlist",
    );
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
