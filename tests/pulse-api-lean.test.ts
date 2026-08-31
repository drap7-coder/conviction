import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Pulse API stays lean and cached", () => {
  it("caches the payload and drops unused triage / narrative / regime fan-out", () => {
    const route = read("src/app/api/market/pulse/route.ts");

    expect(route).toContain("unstable_cache");
    expect(route).toContain("market-pulse-v2");
    expect(route).toContain("s-maxage=300");
    expect(route).toContain("export const revalidate = 300");
    expect(route).not.toContain("force-dynamic");

    expect(route).not.toContain("getWatchlist");
    expect(route).not.toContain("runTriage");
    expect(route).not.toContain("fetchMarketNarrativePulse");
    expect(route).not.toContain("classifyMacroRegime");
    expect(route).not.toContain("classifySectorLeadership");
    expect(route).not.toContain("macroRegime");
    expect(route).not.toContain("sectorLeadership");
    expect(route).not.toContain("marketNarratives");
    expect(route).not.toMatch(/\btriage\b/);

    // Gauges only need VIX + 10Y; indexes stay DIA/SPY/QQQ/IWM (no MDY/RSP).
    expect(route).toContain('"^VIX"');
    expect(route).toContain('"^TNX"');
    expect(route).not.toContain('ticker: "UUP"');
    expect(route).not.toContain('ticker: "MDY"');
    expect(route).not.toContain('ticker: "RSP"');
    expect(route).toContain('ticker: "DIA"');
    expect(route).toContain('ticker: "IWM"');
    expect(route).toContain('ticker: "UNG"');
    expect(route).not.toContain("SOL-USD");
  });

  it("Pulse page only consumes scoreboard fields from the lean payload", () => {
    const page = read("src/app/pulse/page.tsx");
    expect(page).toContain("data.indicators");
    expect(page).toContain("data?.globalMarkets");
    expect(page).toContain("data?.sectors");
    expect(page).toContain("data.sessionLabel");
    expect(page).not.toContain("macroRegime");
    expect(page).not.toContain("marketNarratives");
    expect(page).not.toContain("sectorLeadership");
    expect(page).not.toMatch(/data\.triage|\.triage\b/);
  });
});
