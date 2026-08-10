import { describe, expect, it } from "vitest";
import {
  MARKET_NARRATIVE_THEMES,
  narrativeSummary,
  scoreNarrative,
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
  type NarrativeScore,
} from "@/lib/market/market-narratives";

describe("MARKET_NARRATIVE_THEMES heatmap mapping", () => {
  it("assigns each theme to a Pulse heatmap group", () => {
    const groups = new Set(MARKET_NARRATIVE_THEMES.map((theme) => theme.heatmapGroup));
    expect(groups.has("Major Index")).toBe(true);
    expect(groups.has("Themes")).toBe(true);
    expect(groups.has("Commodity")).toBe(true);
    expect(groups.has("Crypto")).toBe(true);
    expect(groups.has("International")).toBe(true);
    expect(groups.has("Industries")).toBe(true);
  });

  it("filters themes for a heatmap group by score", () => {
    const themes = MARKET_NARRATIVE_THEMES.map((config, index) => ({
      id: config.id,
      label: config.label,
      heatmapGroup: config.heatmapGroup,
      heat: "steady" as const,
      marketTone: "mixed" as const,
      score: index + 1,
      velocity: 1,
      summary: "test",
      headline: null,
      headlines: [],
      newsTicker: config.newsTicker,
      assets: [],
    })) satisfies MarketNarrativeTheme[];

    const crypto = themesForHeatmapGroup(themes, "Crypto");
    expect(crypto).toHaveLength(1);
    expect(crypto[0]?.id).toBe("crypto-liquidity");
  });
});

describe("scoreNarrative", () => {
  it("marks broad fresh matched coverage with a big move as surging", () => {
    const result = scoreNarrative({
      matchedHeadlines: 4,
      totalHeadlines: 8,
      freshHeadlines: 4,
      assetMoves: [2, 1, 0.5],
    });

    expect(result.heat).toBe("surging");
    expect(result.marketTone).toBe("positive");
    expect(result.velocity).toBeGreaterThan(2);
  });

  it("marks some fresh matched coverage as building", () => {
    const result = scoreNarrative({
      matchedHeadlines: 2,
      totalHeadlines: 5,
      freshHeadlines: 2,
      assetMoves: [-1, -0.7, null],
    });

    expect(result.heat).toBe("building");
    expect(result.marketTone).toBe("negative");
  });

  it("keeps a theme quiet when there are no headlines", () => {
    const result = scoreNarrative({
      matchedHeadlines: 0,
      totalHeadlines: 0,
      freshHeadlines: 0,
      assetMoves: [1, -1, 0],
    });

    expect(result.heat).toBe("quiet");
    expect(result.marketTone).toBe("mixed");
    expect(result.velocity).toBe(0);
  });

  it("returns finite scores when market data is missing", () => {
    const result = scoreNarrative({
      matchedHeadlines: 1,
      totalHeadlines: 3,
      freshHeadlines: 1,
      assetMoves: [null, null],
    });

    expect(result.marketTone).toBe("mixed");
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

describe("narrativeSummary", () => {
  const assets = [{ ticker: "QQQ", label: "Nasdaq 100", changePercent: 1.2 }];

  it("avoids social conversation/chatter wording", () => {
    const scores: NarrativeScore[] = [
      { heat: "surging", marketTone: "positive", score: 80, velocity: 3 },
      { heat: "building", marketTone: "positive", score: 55, velocity: 1.5 },
      { heat: "steady", marketTone: "mixed", score: 40, velocity: 1 },
      { heat: "quiet", marketTone: "mixed", score: 10, velocity: 0 },
    ];

    for (const score of scores) {
      const summary = narrativeSummary("AI + Compute", score, assets);
      expect(summary.toLowerCase()).not.toMatch(/conversation|chatter|bluesky|twitter|stocktwits/);
      expect(summary).toContain("QQQ");
    }
  });
});
