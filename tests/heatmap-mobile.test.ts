import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEATMAP_MOBILE_PREVIEW } from "@/components/HeatmapGrid";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("mobile heatmaps", () => {
  it("caps the collapsed phone preview at 3 rows of 2", () => {
    expect(HEATMAP_MOBILE_PREVIEW).toBe(6);
  });

  it("forces every heatmap grid to 2-across on phones, including uniform and compact", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain(".stock-heat-grid--uniform");
    expect(css).toContain(".market-heatmap--uniform");
    expect(css).toContain(".market-heatmap.compact");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).not.toMatch(
      /@media \(max-width: 767px\)[\s\S]{0,220}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(css).toContain(".stock-heat-grid.is-collapsed > .heat-tile:nth-child(n + 7)");
    expect(css).toContain(".market-heatmap.is-collapsed > .heat-tile:nth-child(n + 7)");
    expect(css).toContain(".heat-show-more");
  });

  it("re-asserts Pulse auto-fill after the 6-col market-heatmap rule", () => {
    const css = read("src/app/globals.css");
    const page = read("src/app/pulse/page.tsx");
    const heatmap = read("src/components/market/GlobalMarketsHeatmap.tsx");
    const sixCol = css.indexOf(
      ".market-heatmap {\n  display: grid;\n  grid-template-columns: repeat(6, minmax(0, 1fr));",
    );
    const pulseUniform = css.indexOf(".pulse-page .market-heatmap--uniform");
    const phoneTwoCol = css.indexOf(
      ".pulse-page .market-heatmap,\n  .pulse-page .market-heatmap.compact,\n  .pulse-page .market-heatmap--uniform {\n    grid-template-columns: repeat(2, minmax(0, 1fr));",
    );

    expect(page).toContain('className="markets-page pulse-page"');
    expect(page).toContain("GlobalMarketsHeatmap");
    expect(page).toContain("uniformTiles");
    expect(heatmap).toContain('uniformTiles ? "market-heatmap--uniform"');
    expect(page).not.toContain("uniformTiles && markets.length > 3");
    expect(sixCol).toBeGreaterThan(-1);
    expect(pulseUniform).toBeGreaterThan(sixCol);
    expect(phoneTwoCol).toBeGreaterThan(pulseUniform);
    expect(css).toContain("repeat(auto-fill, minmax(150px, 1fr))");
    expect(css).toContain(".pulse-more-markets {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".pulse-movers-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain(".pulse-more-markets > * {\n  min-width: 0;");
  });

  it("wires Show more through the shared heatmap shells", () => {
    const stock = read("src/components/StockHeatmap.tsx");
    const global = read("src/components/market/GlobalMarketsHeatmap.tsx");
    const grid = read("src/components/HeatmapGrid.tsx");

    expect(stock).toContain("HeatmapGrid");
    expect(global).toContain("HeatmapGrid");
    expect(grid).toContain("Show ${hidden} more");
    expect(grid).toContain("Show less");
    expect(grid).toContain("heat-show-more");
  });
});
