import { describe, expect, it } from "vitest";
import { buildNewsPageBrief } from "@/lib/market/news-brief";
import type { MarketNarrativeTheme } from "@/lib/market/market-narratives";

function theme(
  id: string,
  label: string,
  score: number,
  heat: MarketNarrativeTheme["heat"],
  headlines: number,
): MarketNarrativeTheme {
  return {
    id,
    label,
    summary: `${label} summary`,
    heatmapGroup: "Themes",
    newsTicker: "SPY",
    assets: [],
    score,
    velocity: score,
    heat,
    marketTone: "mixed",
    headline: headlines > 0 ? {
      title: `${label} lead`,
      url: null,
      date: "2026-08-11T12:00:00.000Z",
      publisher: "Test",
    } : null,
    headlines: Array.from({ length: headlines }, (_, index) => ({
      title: `${label} ${index}`,
      url: null,
      date: "2026-08-11T12:00:00.000Z",
      publisher: "Test",
    })),
  };
}

describe("news page brief", () => {
  it("summarizes the strongest live narrative and coverage", () => {
    const brief = buildNewsPageBrief([
      theme("rates", "Rates", 40, "building", 2),
      theme("ai", "AI compute", 80, "surging", 3),
      theme("quiet", "Consumer", 20, "quiet", 1),
    ], "live");

    expect(brief).toEqual({
      leadTheme: "AI compute",
      storyCount: 6,
      activeNarratives: 2,
      statusLabel: "Live",
    });
  });

  it("does not count themes without stories", () => {
    const brief = buildNewsPageBrief([
      theme("empty", "Empty", 100, "surging", 0),
    ], "partial");

    expect(brief.leadTheme).toBe("Still forming");
    expect(brief.storyCount).toBe(0);
    expect(brief.activeNarratives).toBe(0);
    expect(brief.statusLabel).toBe("Partial");
  });
});
