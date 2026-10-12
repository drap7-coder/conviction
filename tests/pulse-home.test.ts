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

describe("Home overview vs Pulse", () => {
  it("puts the four-section overview on Home, not Pulse", () => {
    const home = read("src/components/market/HomeOverview.tsx");
    const pulse = read("src/components/market/PulseDashboard.tsx");
    const brief = home.indexOf("<PulseTodaysBrief");
    const glance = home.indexOf('variant="home"');
    const stocks = home.indexOf("<PulseYourStocks");
    const worth = home.indexOf("<PulseWorthUnderstanding");
    expect(brief).toBeGreaterThan(-1);
    expect(glance).toBeGreaterThan(brief);
    expect(stocks).toBeGreaterThan(glance);
    expect(worth).toBeGreaterThan(stocks);
    expect(home).not.toContain("PersonalDailyBrief");
    expect(home).not.toContain("pf-crowd-invite");
    expect(pulse).toContain('variant="pulse"');
    expect(pulse).not.toContain("PulseTodaysBrief");
    expect(pulse).not.toContain("PulseYourStocks");
    expect(pulse).not.toContain("PulseWorthUnderstanding");
  });

  it("keeps the Markets/Movers/Crypto/Intl slicer on Pulse only", () => {
    const board = read("src/components/market/PulseMarketBoard.tsx");
    expect(board).toContain('className="pulse-view-slicer"');
    expect(board).toContain('variant === "home"');
    expect(board).toContain("Open Pulse");
    expect(read("src/app/page.tsx")).toContain("<HomeOverview");
    expect(read("src/app/page.tsx")).not.toContain("permanentRedirect");
    expect(read("src/app/pulse/page.tsx")).toContain("<PulseDashboard");
  });

  it("keeps personal brief ownership on Portfolio Watchlist", () => {
    expect(read("src/components/Watchlist.tsx")).toContain("<PersonalDailyBrief");
    expect(read("src/components/market/HomeOverview.tsx")).not.toContain(
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
