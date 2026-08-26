import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSectorColor } from "@/lib/display/sector-colors";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("portfolio concentration ladder colors", () => {
  it("paints bars with shared industry colors, not P&L red", () => {
    const css = read("src/app/globals.css");
    const ladder = read("src/components/PortfolioAllocationLadder.tsx");
    const portfolio = read("src/components/Portfolio.tsx");
    const donut = read("src/components/SectorDonut.tsx");
    const colors = read("src/lib/display/sector-colors.ts");

    expect(colors).toContain("Technology");
    expect(getSectorColor("Technology")).toBe("#0052CC");
    expect(getSectorColor("Industrials")).toBe("#00B8D9");
    expect(donut).toContain("getSectorColor");
    expect(ladder).toContain("getSectorColor");
    expect(ladder).toContain("item.sector");
    expect(ladder).toContain("--allocation-color");
    expect(ladder).not.toContain("tone-high");
    expect(portfolio).toContain("resolveHoldingExposure");
    expect(portfolio).toContain("sector:");
    expect(portfolio).toContain("Bar color matches industry");
    expect(css).toContain(".pf-allocation-values .down { color: var(--red); }");
    expect(css).not.toContain(".pf-allocation-row.tone-high");
  });
});
