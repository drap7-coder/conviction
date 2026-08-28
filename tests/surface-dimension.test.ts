import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("surface dimension layer", () => {
  it("wires real elevation tokens instead of flat none shadows", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("--border-raised:");
    expect(css).toContain("--shadow-sm:");
    expect(css).not.toMatch(/--shadow-sm:\s*none;/);
    expect(css).toContain("inset 0 1px 0");
    expect(css).toContain(".market-heatmap-shell");
    expect(css).toContain("box-shadow: var(--shadow-sm)");
  });

  it("raises shared panels, tables, and portfolio cards", () => {
    const css = read("src/app/globals.css");
    const portfolio = read("src/app/portfolio.css");
    const legal = read("src/app/legal.module.css");

    expect(css).toContain(".pf-table-wrap");
    expect(css).toMatch(/\.pf-table-wrap[\s\S]*box-shadow: var\(--shadow-sm\)/);
    expect(css).toMatch(/\.product-stage[\s\S]*box-shadow: var\(--shadow-sm\)/);
    expect(css).toMatch(/\.smart-money-insight-card[\s\S]*box-shadow: var\(--shadow-sm\)/);
    expect(css).toMatch(/\.for-you-feed-card:hover[\s\S]*box-shadow: var\(--shadow-md\)/);
    expect(css).toContain(".surface-shell");
    expect(css).toMatch(/\.surface-shell[\s\S]*box-shadow: var\(--shadow-sm\)/);
    expect(portfolio).toMatch(/\.pf-holding-card[\s\S]*box-shadow: var\(--shadow-sm\)/);
    expect(legal).toMatch(/\.hero,[\s\S]*box-shadow: var\(--shadow-sm\)/);
  });
});
