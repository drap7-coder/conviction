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

describe("Pulse home overview", () => {
  it("composes Today’s Brief → Market glance → Your Stocks → Worth Understanding", () => {
    const page = read("src/components/market/PulseDashboard.tsx");
    const brief = page.indexOf("<PulseTodaysBrief");
    const glance = page.indexOf("pulse-market-glance");
    const stocks = page.indexOf("<PulseYourStocks");
    const worth = page.indexOf("<PulseWorthUnderstanding");
    const slicer = page.indexOf('className="pulse-view-slicer"');
    expect(brief).toBeGreaterThan(-1);
    expect(glance).toBeGreaterThan(brief);
    expect(stocks).toBeGreaterThan(glance);
    expect(worth).toBeGreaterThan(stocks);
    expect(slicer).toBeGreaterThan(glance);
    expect(slicer).toBeLessThan(stocks);
    expect(page).not.toContain("PersonalDailyBrief");
    expect(page).not.toContain("PulseAtAGlance");
    expect(page).not.toContain("pf-crowd-invite");
  });

  it("keeps personal brief ownership on Portfolio Watchlist", () => {
    expect(read("src/components/Watchlist.tsx")).toContain("<PersonalDailyBrief");
    expect(read("src/components/market/PulseDashboard.tsx")).not.toContain(
      "PersonalDailyBrief",
    );
    expect(read("src/components/market/PulseYourStocks.tsx")).toContain(
      "Build your watchlist",
    );
  });

  it("selects a distinct Worth Understanding story after the brief", () => {
    const themes = [
      theme("ai-compute", "Chip makers lead the session", 90),
      theme("rates-fed", "Treasury yields steady into the close", 80),
      theme("energy-oil", "Crude holds gains after inventory data", 70),
      theme("consumer-demand", "Retail traffic softens into the weekend", 60),
    ];
    const picked = selectPulseHomeStories(themes);
    expect(picked.todaysBrief).toHaveLength(3);
    expect(picked.worthUnderstanding?.id).toBe("consumer-demand");
    expect(
      picked.todaysBrief.some(
        (item) => item.id === picked.worthUnderstanding?.id,
      ),
    ).toBe(false);
  });

  it("does not repeat a near-duplicate headline as Worth Understanding", () => {
    const themes = [
      theme("ai-compute", "Chip makers lead the session", 90),
      theme("rates-fed", "Treasury yields steady into the close", 80),
      theme("energy-oil", "Crude holds gains after inventory data", 70),
      theme("ai-follow", "Chip makers lead the session again", 85),
    ];
    const picked = selectPulseHomeStories(themes);
    expect(picked.worthUnderstanding?.id).not.toBe("ai-follow");
  });

  it("orders personal snapshot holdings before watched names", () => {
    expect(
      personalSnapshotTickers(["AAPL", "MSFT"], ["NVDA", "AAPL", "AMD"], 6),
    ).toEqual(["AAPL", "MSFT", "NVDA", "AMD"]);
  });
});
