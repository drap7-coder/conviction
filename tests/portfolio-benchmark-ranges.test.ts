import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("portfolio Book vs Benchmark ranges", () => {
  it("exposes Today through 1Y chips and refetches by range", () => {
    const chart = read("src/components/PortfolioBenchmarkChart.tsx");
    const css = read("src/app/portfolio.css");

    expect(chart).toContain('label: "Today"');
    expect(chart).toContain('label: "1M"');
    expect(chart).toContain('label: "6M"');
    expect(chart).toContain('label: "1Y"');
    expect(chart).toContain("pf-benchmark-ranges");
    expect(chart).toContain("setRange");
    expect(chart).toContain("&range=${encodeURIComponent(range)}");
    expect(chart).not.toContain(".slice(-15)");
    expect(css).toContain(".pf-benchmark-head");
    expect(css).toContain(".pf-benchmark-ranges");
  });
});
