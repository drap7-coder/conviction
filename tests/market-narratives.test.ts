import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MARKET_NARRATIVE_THEMES,
  hydrateThemePrimaryImages,
  narrativeSummary,
  scoreNarrative,
  themesForHeatmapGroup,
  type MarketNarrativeTheme,
  type NarrativeScore,
} from "@/lib/market/market-narratives";

afterEach(() => {
  vi.restoreAllMocks();
});

function themeFixture(overrides: Partial<MarketNarrativeTheme> = {}): MarketNarrativeTheme {
  const headline = overrides.headline ?? {
    title: "Nvidia books another AI order",
    url: "https://finance.yahoo.com/news/nvidia.html",
    date: "2026-08-23T12:00:00.000Z",
    publisher: "Yahoo Finance",
    imageUrl: null,
  };
  return {
    id: "ai-compute",
    label: "AI + Compute",
    heatmapGroup: "Major Index",
    heat: "building",
    marketTone: "positive",
    score: 80,
    velocity: 2,
    summary: "test",
    headline,
    headlines: overrides.headlines ?? [headline],
    newsTicker: "NVDA",
    assets: [],
    ...overrides,
  };
}

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

describe("hydrateThemePrimaryImages", () => {
  it("copies a same-story sibling RSS image onto the lead without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const lead = {
      title: "Oil falls as US prepares new Iran sanctions",
      url: "https://news.google.com/rss/articles/oil",
      date: "2026-08-23T12:00:00.000Z",
      publisher: "Reuters",
      imageUrl: null,
    };
    const sibling = {
      title: "Oil falls as the US prepares new Iran sanctions",
      url: "https://finance.yahoo.com/news/oil.html",
      date: "2026-08-23T11:00:00.000Z",
      publisher: "Yahoo Finance",
      imageUrl: "https://s.yimg.com/os/oil.jpg",
    };

    const [hydrated] = await hydrateThemePrimaryImages([
      themeFixture({ headline: lead, headlines: [lead, sibling], score: 90 }),
    ]);

    expect(hydrated.headline?.title).toBe(lead.title);
    expect(hydrated.headline?.imageUrl).toBe(sibling.imageUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an in-feed image and does not fetch og:image", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const theme = themeFixture({
      headline: {
        title: "Oil jumps",
        url: "https://example.com/oil",
        date: "2026-08-23T12:00:00.000Z",
        imageUrl: "https://media.example.com/oil.png",
      },
    });

    const [hydrated] = await hydrateThemePrimaryImages([theme]);
    expect(hydrated.headline?.imageUrl).toBe("https://media.example.com/oil.png");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills a missing hero image from the article og:image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      `<meta property="og:image" content="https://s.yimg.com/os/hero.jpg" />`,
      { status: 200, headers: { "content-type": "text/html" } },
    )));

    const [hydrated] = await hydrateThemePrimaryImages([themeFixture()]);
    expect(hydrated.headline?.imageUrl).toBe("https://s.yimg.com/os/hero.jpg");
  });

  it("uses a same-story non-Google URL when the lead is a Google News wrapper", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("finance.yahoo.com/news/same-story")) {
        return new Response(
          `<meta property="og:image" content="https://s.yimg.com/os/same-story.jpg" />`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`should not fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const googleLead = {
      title: "Nvidia expands its AI infrastructure push",
      url: "https://news.google.com/rss/articles/CBMiEXAMPLE?oc=5",
      date: "2026-08-23T12:00:00.000Z",
      publisher: "Reuters",
      imageUrl: null,
    };
    const yahooSibling = {
      title: "Nvidia expands its AI infrastructure push - Yahoo Finance",
      url: "https://finance.yahoo.com/news/same-story.html",
      date: "2026-08-23T11:00:00.000Z",
      publisher: "Yahoo Finance",
      imageUrl: null,
    };
    const [hydrated] = await hydrateThemePrimaryImages([
      themeFixture({ headline: googleLead, headlines: [googleLead, yahooSibling], score: 90 }),
    ]);

    expect(hydrated.headline?.imageUrl).toBe("https://s.yimg.com/os/same-story.jpg");
    expect(hydrated.headline?.url).toBe(googleLead.url);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("finance.yahoo.com/news/same-story");
  });
});
