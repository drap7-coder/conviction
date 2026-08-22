import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trimHeadlineToFit } from "@/components/TypewriterText";
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
  it("keeps even more-markets groups and a headline-only hero", () => {
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
    expect(page).toContain("headlineMaxLines={2}");
    expect(page).not.toContain("hero.summary");
    const css = read("src/app/globals.css");
    expect(css).toContain(".product-stage--pulse .product-stage-headline");
    expect(css).toContain("max-height: calc(1.12em * 2 + 0.4em)");
    expect(read("src/components/TypewriterText.tsx")).toContain("countWrappedLines");
    expect(page).not.toContain("regimeSummary");
    expect(page).toContain('title="Commodities"');
    expect(page).toContain('title="Crypto"');
    expect(page).toContain('title="International"');
  });
});

describe("trimHeadlineToFit", () => {
  it("backs up to a word boundary and adds an ellipsis", () => {
    expect(trimHeadlineToFit("Chip stocks lift the Nasdaq")).toBe("Chip stocks lift the…");
    expect(trimHeadlineToFit("Chip stocks lift the Nasdaq.")).toBe("Chip stocks lift the…");
    expect(trimHeadlineToFit("Nasdaq")).toBe("Nasdaq…");
    expect(trimHeadlineToFit("")).toBe("…");
  });
});
