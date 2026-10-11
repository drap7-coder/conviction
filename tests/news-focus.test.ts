import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/components/market/PulseNewsFeed.tsx", import.meta.url), "utf8");
describe("market-wide news", () => {
  it("retains topic selection without duplicate personalized navigation", () => {
    expect(source).toContain('value="all">All topics');
    expect(source).toContain('aria-label="Filter by theme"');
    expect(source).not.toContain("Your Stocks");
    expect(source).not.toContain("personalThemeIds");
    expect(source).not.toContain("loadPortfolioForViewer");
    expect(source).not.toContain("/api/watchlist");
    expect(source).not.toContain("localStorage");
  });
  it("retains sources and editorial cards, and distinguishes unavailable news", () => {
    expect(source).toContain("orderNewsBriefThemes(filteredThemes)");
    expect(source).toContain("href={headline.url}");
    expect(source).toContain("Market news is temporarily unavailable");
  });
});
