import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("portfolio concentration ladder colors", () => {
  it("keeps high concentration off P&L red", () => {
    const css = read("src/app/globals.css");
    const ladder = read("src/components/PortfolioAllocationLadder.tsx");
    const portfolio = read("src/components/Portfolio.tsx");

    const highBlock = css.slice(
      css.indexOf(".pf-allocation-row.tone-high"),
      css.indexOf(".pf-allocation-rank"),
    );
    expect(highBlock).toContain("#e8874a");
    expect(highBlock).not.toContain("#dc2626");
    expect(highBlock).not.toContain("var(--red)");
    expect(css).toContain(".pf-allocation-values .down { color: var(--red); }");
    expect(css).toContain(".pf-allocation-values .flat");
    expect(ladder).toContain("dayMoveClass");
    expect(ladder).toContain("not today’s move");
    expect(portfolio).toContain("not today’s move");
  });
});
