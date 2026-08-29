import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("watchlist + news surface slicers", () => {
  it("shares Portfolio-style slicer chrome with leader/laggard accents", () => {
    const css = read("src/app/globals.css");
    const slicer = read("src/components/SurfaceSlicer.tsx");

    expect(slicer).toContain("surface-slicer-track");
    expect(slicer).toContain("surface-slicer-pill");
    expect(css).toContain(".surface-slicer");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("-webkit-overflow-scrolling: touch");
    expect(css).toContain(".surface-slicer-pill.tone-up.is-active");
    expect(css).toContain(".surface-slicer-pill.tone-down.is-active");
    expect(css).toContain("var(--green)");
    expect(css).toContain("var(--red)");
  });

  it("wires Watchlist performance and News category bars to SurfaceSlicer", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const movers = read("src/components/market/MarketMoversBoard.tsx");
    const newsFeed = read("src/components/market/PulseNewsFeed.tsx");
    const newsPage = read("src/app/news/page.tsx");

    expect(watchlist).toContain("SurfaceSlicer");
    expect(watchlist).toContain("All Assets");
    expect(watchlist).toContain("Leaders");
    expect(watchlist).toContain("Laggards");
    expect(watchlist).toContain('columns={');
    expect(movers).toContain('columns?: "both" | "top" | "bottom"');
    expect(movers).toContain("showVolume");
    expect(movers).toContain("pulse-movers-stack");
    expect(movers).toContain("pulse-day-status");
    expect(movers).toContain("Highest volume");
    expect(newsFeed).toContain("SurfaceSlicer");
    expect(newsFeed).toContain('className="pulse-news-filters"');
    expect(newsPage).toContain("PulseNewsFeed");
    expect(newsPage).toContain("news-page");
  });
});
