import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Pulse / News cold-path SSR", () => {
  it("server-renders Pulse and News from shared unstable_cache loaders", () => {
    const pulsePage = read("src/app/pulse/page.tsx");
    const newsPage = read("src/app/news/page.tsx");
    const pulseData = read("src/lib/market/pulse-data.ts");
    const newsData = read("src/lib/market/news-data.ts");
    const pulseBoard = read("src/components/market/PulseBoard.tsx");
    const newsBoard = read("src/components/market/NewsBoard.tsx");
    const narratives = read("src/lib/market/market-narratives.ts");

    expect(pulsePage).not.toContain('"use client"');
    expect(newsPage).not.toContain('"use client"');
    expect(pulsePage).toContain("loadPulseData");
    expect(newsPage).toContain("loadNewsData");
    expect(pulsePage).toContain("export const revalidate = 300");
    expect(newsPage).toContain("export const revalidate = 300");

    expect(pulseData).toContain("unstable_cache");
    expect(newsData).toContain("unstable_cache");
    expect(newsData).toContain("market-news-v1");

    // Soft refresh keeps freshness without blanking SSR paint.
    expect(pulseBoard).toContain("initialData");
    expect(newsBoard).toContain("initialData");
    expect(pulseBoard).toContain("visibilitychange");
    expect(newsBoard).toContain("visibilitychange");
    expect(pulseBoard).toContain("PULSE_REFRESH_MS");
    expect(newsBoard).toContain("NEWS_REFRESH_MS");

    // Quotes + RSS overlap; image HTML capped.
    expect(narratives).toContain("fetchThemeCoverage");
    expect(narratives).toContain("Promise.all([\n      fetchStockQuotes(tickers)");
    expect(narratives).toContain("maxHtmlThemes: 2");
    expect(narratives).toContain("maxUnwrapThemes: 1");
  });

  it("ships the three trivial visual fixes with the cold-path PR", () => {
    const css = read("src/app/globals.css");
    const board = read("src/components/market/IndexScoreboard.tsx");
    const movers = read("src/components/market/MarketMoversBoard.tsx");

    expect(css).toContain("--line: var(--border)");
    expect(css).toMatch(
      /\.session-quote-change\.is-up[\s\S]*?color:\s*var\(--green\)/,
    );
    expect(board).toContain('"surface-shell"');
    expect(movers).toContain("surface-shell");
  });
});
