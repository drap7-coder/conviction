import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pulseHeroCopy, regimeDecisionHeadline } from "@/lib/market/pulse-hero";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function theme(overrides: Partial<MarketNarrativeTheme> = {}): MarketNarrativeTheme {
  return {
    id: "ai-compute",
    label: "AI + Compute",
    heatmapGroup: "Major Index",
    heat: "building",
    marketTone: "positive",
    score: 70,
    velocity: 2,
    summary: "AI + Compute is in focus as QQQ is +1.2%.",
    headline: {
      title: "Chip stocks lift the Nasdaq.",
      url: "https://example.com/ai",
      date: "2026-08-22T12:00:00.000Z",
      publisher: "Test",
    },
    headlines: [],
    newsTicker: "NVDA",
    assets: [],
    ...overrides,
  };
}

describe("pulseHeroCopy", () => {
  it("uses the Major Indexes news headline and nothing else", () => {
    const copy = pulseHeroCopy({
      themes: [
        theme({ heatmapGroup: "Commodity", summary: "Oil is quiet.", headline: null }),
        theme(),
      ],
      regimeLabel: "Risk-on",
    });

    expect(copy).toEqual({ headline: "Chip stocks lift the Nasdaq." });
    expect(copy.headline).not.toMatch(/is [+-]?\d/);
    expect(copy.headline).not.toContain("leads the tape");
  });

  it("falls back to the regime read when there is no index headline", () => {
    const copy = pulseHeroCopy({
      themes: [],
      regimeLabel: "Risk-off",
    });

    expect(copy).toEqual({ headline: regimeDecisionHeadline("Risk-off") });
  });
});

describe("Pulse heatmap universe", () => {
  it("keeps even more-markets groups and no page hero", () => {
    const route = read("src/app/api/market/pulse/route.ts");
    const page = read("src/app/pulse/page.tsx");

    expect(route).toContain('ticker: "UNG"');
    expect(route).toContain('category: "Commodity"');
    expect(route).not.toContain('category: "Themes"');
    expect(route).not.toContain("SOL-USD");
    expect(page).not.toContain('title="Themes"');
    expect(page).not.toContain("themeMarkets");
    expect(page).not.toContain("MarketNarrativeDriversPanel");
    expect(page).not.toContain("ProductStage");
    expect(page).not.toContain("pulseHeroCopy");
    expect(page).not.toContain("headlineMaxLines");
    expect(page).not.toContain("hero.summary");
    expect(page).not.toContain("regimeSummary");
    expect(page).toContain("CommodityScoreboard");
    expect(page).not.toContain('title="Commodities"');
    expect(page).toContain("CryptoBoard");
    expect(page).not.toContain('title="International Indexes"');
    expect(page).not.toContain("internationalMarkets");
    expect(page).toContain("MarketMovesPanel");
    expect(page).not.toContain("ViewSwitcher");
    expect(page).not.toContain("PULSE_TABS");
    expect(page).not.toContain("pulse-tab-indexes");
    expect(page).not.toContain("pulse-panel-trending");
  });

  it("does not treat Trending as a watchlist chip editor", () => {
    const panel = read("src/components/market/MarketMovesPanel.tsx");

    expect(panel).toContain("MarketMoversBoard");
    expect(panel).toContain("splitMarketMovers");
    expect(panel).not.toContain("StockHeatmap");
    expect(panel).not.toContain("TrendingManageChips");
    expect(panel).not.toContain("wl-manage-row");
  });

  it("renders one scrolling view ordered Indexes, Trending, Commodities, then Sectors", () => {
    const page = read("src/app/pulse/page.tsx");
    const board = read("src/components/market/IndexScoreboard.tsx");
    const gauges = read("src/components/market/PulseMacroGauges.tsx");
    const css = read("src/app/globals.css");
    const gaugesStart = page.indexOf("<PulseMacroGauges");
    const indexesStart = page.indexOf("<IndexScoreboard");
    const trendingStart = page.indexOf('id="market-moves"');
    const commoditiesStart = page.indexOf("<CommodityScoreboard");
    const sectorsStart = page.indexOf('id="industries"');
    const moreMarketsStart = page.indexOf('className="pulse-more-markets"');
    const indexesBlock = page.slice(
      gaugesStart,
      trendingStart,
    );
    const sectorsBlock = page.slice(
      page.indexOf('title="Sectors"'),
      moreMarketsStart,
    );
    const moreMarketsBlock = page.slice(
      moreMarketsStart,
    );

    expect(gaugesStart).toBeGreaterThan(-1);
    expect(indexesStart).toBeGreaterThan(-1);
    expect(gaugesStart).toBeLessThan(indexesStart);
    expect(indexesStart).toBeLessThan(trendingStart);
    expect(trendingStart).toBeLessThan(commoditiesStart);
    expect(commoditiesStart).toBeLessThan(sectorsStart);
    expect(sectorsStart).toBeLessThan(moreMarketsStart);
    expect(page).not.toContain("ViewSwitcher");
    expect(page).not.toContain("PULSE_TABS");
    expect(page).not.toContain('role="tabpanel"');
    expect(page).not.toContain("pulse-panel-trending");
    expect(page).toContain("PulseMacroGauges");
    expect(page).toContain("IndexScoreboard");
    expect(page).toContain("CommodityScoreboard");
    expect(indexesBlock).toContain("sessionLabel={data.sessionLabel}");
    expect(indexesBlock).not.toContain("HeatTile");
    expect(indexesBlock).not.toContain("HeatmapGrid");
    expect(indexesBlock).not.toContain("ProductStage");
    expect(gauges).toContain("pulse-gauge-grid");
    expect(gauges).not.toContain("ProductStage");
    expect(board).toContain("pulse-index-row");
    expect(board).toContain("pulse-index-session");
    expect(board).toContain('title="Commodities"');
    expect(board).not.toContain("stock-heat-session");
    expect(board).not.toContain("HeatTile");
    expect(css).toContain(".pulse-index-row");
    expect(css).toContain(".pulse-gauge-grid");
    expect(css).toContain(".pulse-movers-grid");
    expect(sectorsBlock).toContain("sessionLabel={data.sessionLabel}");
    expect(read("src/components/market/GlobalMarketsHeatmap.tsx")).toContain(
      'className="stock-heat-session ink-chip ink-chip--amber"',
    );
    expect(moreMarketsBlock).not.toContain("sessionLabel");
    expect(moreMarketsBlock).not.toContain("CommodityScoreboard");
    expect(moreMarketsBlock).not.toContain('title="Commodities"');
    expect(moreMarketsBlock).toContain("CryptoBoard");
    expect(moreMarketsBlock).not.toContain('title="Crypto"');
    expect(moreMarketsBlock).not.toContain("GlobalMarketsHeatmap");
    expect(moreMarketsBlock).not.toContain('title="International Indexes"');
    expect(moreMarketsBlock).not.toContain("International");
  });

  it("expands Crypto beyond BTC/ETH without bringing Solana back to Pulse", () => {
    const route = read("src/app/api/market/pulse/route.ts");
    expect(route).toContain("XRP-USD");
    expect(route).toContain("DOGE-USD");
    expect(route).toContain("ADA-USD");
    expect(route).toContain('category: "Crypto Equity"');
    expect(route).toContain("COIN");
    expect(route).not.toContain("SOL-USD");
  });
});

describe("International menu page", () => {
  it("lives under Menu and hosts the country heatmap off Pulse", () => {
    const nav = read("src/lib/nav-config.ts");
    const page = read("src/app/international/page.tsx");
    const layout = read("src/app/international/layout.tsx");

    expect(nav).toContain('href: "/international"');
    expect(nav).toContain('label: "International"');
    expect(nav).toContain('group: "more"');
    expect(page).toContain('category === "International"');
    expect(page).toContain('title="International"');
    expect(page).toContain("GlobalMarketsHeatmap");
    expect(page).toContain('sr-only');
    expect(layout).toContain("pageMetadata");
    expect(layout).toContain('path: "/international"');
  });
});
