import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("portfolio Sector Mix depth", () => {
  it("uses a larger 3D donut in an inset well that fills the card", () => {
    const donut = read("src/components/SectorDonut.tsx");
    const chart = read("src/components/DonutChart.tsx");
    const css = read("src/app/portfolio.css");
    const globals = read("src/app/globals.css");
    const portfolio = read("src/components/Portfolio.tsx");

    expect(donut).toContain("size={228}");
    expect(chart).toContain("DEPTH_LAYERS = 11");
    expect(css).toContain(".pf-sector-mix-donut");
    expect(portfolio).toContain("surface-well");
    expect(globals).toContain("var(--card-inset)");
    expect(css).toContain("grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr)");
    expect(css).toContain("drop-shadow(0 18px 22px");
  });
});
