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
    expect(page).toContain('title="Commodities"');
    expect(page).toContain('title="Crypto"');
    expect(page).toContain('title="International"');
    expect(page).toContain("MarketMovesPanel");
  });

  it("does not treat Trending as a watchlist chip editor", () => {
    const panel = read("src/components/market/MarketMovesPanel.tsx");

    expect(panel).toContain('title="Active names"');
    expect(panel).not.toContain("TrendingManageChips");
    expect(panel).not.toContain("wl-manage-row");
  });

  it("shows the Watchlist session chip on Indexes and Sectors, not More markets", () => {
    const page = read("src/app/pulse/page.tsx");
    const stock = read("src/components/StockHeatmap.tsx");
    const chipMarkup = 'className="stock-heat-session ink-chip ink-chip--amber"';
    const indexesBlock = page.slice(
      page.indexOf('title="Major Indexes"'),
      page.indexOf('id="industries"'),
    );
    const sectorsBlock = page.slice(
      page.indexOf('title="Sectors"'),
      page.indexOf("pulse-more-markets"),
    );
    const moreMarketsBlock = page.slice(
      page.indexOf("pulse-more-markets"),
      page.indexOf("pulse-panel-trending"),
    );

    expect(stock).toContain(chipMarkup);
    expect(stock).toContain("{sessionLabel ? (");
    expect(page).toContain("sessionLabel?: string | null");
    expect(page).toContain("{sessionLabel ? (");
    expect(page).toContain(chipMarkup);
    expect(page).toContain("aria-label={`${sessionLabel} session`}");
    expect(indexesBlock).toContain("sessionLabel={data.sessionLabel}");
    expect(sectorsBlock).toContain("sessionLabel={data.sessionLabel}");
    expect(moreMarketsBlock).not.toContain("sessionLabel");
    expect(moreMarketsBlock).toContain('title="Commodities"');
    expect(moreMarketsBlock).toContain('title="Crypto"');
    expect(moreMarketsBlock).toContain('title="International"');
  });
});
