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
  it("lifts the Major Indexes narrative into the hero", () => {
    const copy = pulseHeroCopy({
      themes: [
        theme({ heatmapGroup: "Commodity", summary: "Oil is quiet.", headline: null }),
        theme(),
      ],
      regimeLabel: "Risk-on",
      regimeSummary: "Risk appetite is broadening across indexes.",
    });

    expect(copy.headline).toBe("AI + Compute is in focus as QQQ is +1.2%.");
    expect(copy.summary).toBe("Chip stocks lift the Nasdaq.");
  });

  it("falls back to the regime read when the index narrative is empty", () => {
    const copy = pulseHeroCopy({
      themes: [],
      regimeLabel: "Risk-off",
      regimeSummary: "Risk is coming out of the market.",
    });

    expect(copy.headline).toBe(regimeDecisionHeadline("Risk-off"));
    expect(copy.summary).toBe("Risk is coming out of the market.");
  });
});

describe("Pulse heatmap universe", () => {
  it("keeps even more-markets groups: no Themes, no Solana, four commodities", () => {
    const route = read("src/app/api/market/pulse/route.ts");
    const page = read("src/app/pulse/page.tsx");

    expect(route).toContain('ticker: "UNG"');
    expect(route).toContain('category: "Commodity"');
    expect(route).not.toContain('category: "Themes"');
    expect(route).not.toContain("SOL-USD");
    expect(page).not.toContain('title="Themes"');
    expect(page).not.toContain("themeMarkets");
    expect(page).not.toContain("MarketNarrativeDriversPanel");
    expect(page).toContain("pulseHeroCopy");
    expect(page).toContain('title="Commodities"');
    expect(page).toContain('title="Crypto"');
    expect(page).toContain('title="International"');
  });
});
