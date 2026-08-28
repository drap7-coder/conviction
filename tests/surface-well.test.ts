import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("shared surface well", () => {
  it("defines shell + well utilities and shares well chrome with heatmaps and depth charts", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".surface-shell");
    expect(css).toContain(".surface-well");
    expect(css).toContain("--surface-well-radius:");
    expect(css).toContain("--surface-well-highlight:");
    expect(css).toMatch(
      /\.surface-well,\s*\.stock-heat-grid,\s*\.market-heatmap-shell \.market-heatmap,\s*\.market-macro-chart--depth/,
    );
    expect(css).toContain("var(--card-inset)");
    expect(css).toContain("var(--surface-well-highlight)");
  });

  it("nests Sector Mix, Concentration, Pulse scoreboards, and movers in the well", () => {
    const portfolio = read("src/components/Portfolio.tsx");
    const ladder = read("src/components/PortfolioAllocationLadder.tsx");
    const scoreboard = read("src/components/market/IndexScoreboard.tsx");
    const movers = read("src/components/market/MarketMoversBoard.tsx");
    const benchmark = read("src/components/PortfolioBenchmarkChart.tsx");

    expect(portfolio).toContain('className="pf-section pf-sector-mix surface-shell"');
    expect(portfolio).toContain('className="pf-sector-mix-donut surface-well"');
    expect(ladder).toContain("surface-shell");
    expect(ladder).toContain('className="pf-allocation-list surface-well"');
    expect(scoreboard).toContain('className="surface-well pulse-index-well"');
    expect(movers).toContain('className="surface-well pulse-movers-well"');
    expect(benchmark).toContain('className="pf-benchmark surface-shell"');
  });
});
