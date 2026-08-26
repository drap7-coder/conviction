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

  it("swaps the chart benchmark with Compare against and nests the pills under the chart", () => {
    const chart = read("src/components/PortfolioBenchmarkChart.tsx");
    const fit = read("src/lib/portfolio/fit.ts");
    const portfolio = read("src/components/Portfolio.tsx");
    const css = read("src/app/portfolio.css");

    expect(fit).toContain("PROFILE_BENCHMARK");
    expect(fit).toContain('ticker: "QQQ"');
    expect(fit).toContain('ticker: "SCHD"');
    expect(chart).toContain("benchmarkTicker");
    expect(chart).toContain("fetchHistory(benchTicker");
    expect(chart).toContain("pf-benchmark-compare");
    expect(chart).toContain("children");
    expect(portfolio).toContain("PROFILE_BENCHMARK[profile]");
    expect(portfolio).toContain("benchmarkTicker={benchmark.ticker}");
    expect(css).toContain(".pf-benchmark-compare");
    expect(css).toMatch(/\.pf-benchmark-compare[\s\S]*border-top:\s*1px solid var\(--divider\)/);
  });
});
