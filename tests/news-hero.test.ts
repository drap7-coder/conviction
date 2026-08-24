import { describe, expect, it } from "vitest";
import type { MarketNarrativeHeadline, MarketNarrativeTheme } from "@/lib/market/market-narratives";
import {
  orderNewsBriefThemes,
  pickHeroHeadline,
  themeHasHeroPhoto,
} from "@/lib/market/news-hero";

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

function headline(overrides: Partial<MarketNarrativeHeadline>): MarketNarrativeHeadline {
  return {
    title: "Headline",
    url: "https://example.com/story",
    date: "2026-08-24T10:00:00.000Z",
    publisher: "Reuters",
    imageUrl: null,
    ...overrides,
  };
}

function theme(overrides: Partial<MarketNarrativeTheme> & { id: string; score: number }): MarketNarrativeTheme {
  const lead = overrides.headline ?? headline({ title: `${overrides.id} lead` });
  return {
    label: overrides.id,
    heatmapGroup: "Major Index",
    heat: "building",
    marketTone: "mixed",
    velocity: 2,
    summary: "test",
    headlines: overrides.headlines ?? [lead],
    newsTicker: "SPY",
    assets: [],
    headline: lead,
    ...overrides,
  };
}

describe("pickHeroHeadline", () => {
  it("keeps a pictured lead as the hero article", () => {
    const lead = headline({
      title: "Nvidia books another AI order",
      publisher: "Yahoo Finance",
      imageUrl: "https://s.yimg.com/os/hero.jpg",
    });
    const picked = pickHeroHeadline(theme({
      id: "ai-compute",
      score: 72,
      headline: lead,
      headlines: [lead],
    }), NOW);

    expect(picked?.title).toBe(lead.title);
    expect(picked?.imageUrl).toBe(lead.imageUrl);
  });

  it("attaches a same-story sibling photo without swapping the lead title", () => {
    const lead = headline({
      title: "Oil falls as US prepares to unveil new Iran sanctions",
      publisher: "Reuters",
      url: "https://news.google.com/rss/articles/oil",
    });
    const sibling = headline({
      title: "Oil falls as the US prepares new Iran sanctions",
      publisher: "Yahoo Finance",
      url: "https://finance.yahoo.com/news/oil.html",
      imageUrl: "https://s.yimg.com/os/oil.jpg",
    });
    const picked = pickHeroHeadline(theme({
      id: "energy-oil",
      score: 77,
      headline: lead,
      headlines: [lead, sibling],
    }), NOW);

    expect(picked?.title).toBe(lead.title);
    expect(picked?.imageUrl).toBe(sibling.imageUrl);
  });

  it("promotes a pictured non-filler story in the same theme when the lead has no photo", () => {
    const lead = headline({
      title: "Oil falls as US prepares to unveil new Iran sanctions",
      publisher: "Reuters",
    });
    const pictured = headline({
      title: "If an AI Bubble Burst Is Coming, Warren Buffett's 1999 Warning",
      publisher: "Yahoo Finance",
      imageUrl: "https://g.foolcdn.com/image/?url=hero.jpg",
    });
    const picked = pickHeroHeadline(theme({
      id: "ai-compute",
      score: 72,
      headline: lead,
      headlines: [lead, pictured],
    }), NOW);

    expect(picked?.title).toBe(pictured.title);
    expect(picked?.imageUrl).toBe(pictured.imageUrl);
  });

  it("does not treat a filler pictured headline as a hero photo", () => {
    const lead = headline({ title: "Rates hold as Treasury yields rebound" });
    const filler = headline({
      title: "Sector Update: Consumer Stocks Higher Late Afternoon",
      publisher: "Yahoo Finance",
      imageUrl: "https://s.yimg.com/os/filler.jpg",
    });
    const result = theme({
      id: "consumer-demand",
      score: 61,
      headline: lead,
      headlines: [lead, filler],
    });

    expect(pickHeroHeadline(result, NOW)?.title).toBe(lead.title);
    expect(themeHasHeroPhoto(result, NOW)).toBe(false);
  });
});

describe("orderNewsBriefThemes", () => {
  it("promotes the important pictured Brief ahead of a higher-score text-only lead", () => {
    const oilLead = headline({
      title: "Oil falls as US prepares to unveil new Iran sanctions",
      publisher: "Reuters",
    });
    const aiLead = headline({
      title: "If an AI Bubble Burst Is Coming, Warren Buffett's 1999 Warning",
      publisher: "Yahoo Finance",
      imageUrl: "https://s.yimg.com/os/ai.jpg",
    });
    const ordered = orderNewsBriefThemes([
      theme({ id: "energy-oil", score: 90, headline: oilLead, headlines: [oilLead] }),
      theme({ id: "ai-compute", score: 72, headline: aiLead, headlines: [aiLead] }),
    ], NOW);

    expect(ordered.map((item) => item.id)).toEqual(["ai-compute", "energy-oil"]);
  });

  it("keeps editorial order when no Brief has a usable photo", () => {
    const oilLead = headline({ title: "Oil falls on Iran sanctions", publisher: "Reuters" });
    const fedLead = headline({ title: "White House undermines the Fed", publisher: "Bloomberg.com" });
    const ordered = orderNewsBriefThemes([
      theme({ id: "energy-oil", score: 77, headline: oilLead, headlines: [oilLead] }),
      theme({ id: "rates-fed", score: 65, headline: fedLead, headlines: [fedLead] }),
    ], NOW);

    expect(ordered.map((item) => item.id)).toEqual(["energy-oil", "rates-fed"]);
  });
});
