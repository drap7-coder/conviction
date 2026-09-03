import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Pulse API stays lean and cached", () => {
  it("caches the payload and drops unused triage / narrative / regime fan-out", () => {
    const data = read("src/lib/market/pulse-data.ts");
    const route = read("src/app/api/market/pulse/route.ts");
    const page = read("src/app/pulse/page.tsx");

    expect(data).toContain("unstable_cache");
    expect(data).toContain("market-pulse-v2");
    expect(route).toContain("loadPulseData");
    expect(route).toContain("s-maxage=300");
    expect(route).toContain("export const revalidate = 300");
    expect(page).toContain("loadPulseData");
    expect(page).toContain("export const revalidate = 300");
    expect(route).not.toContain("force-dynamic");

    expect(data).not.toContain("getWatchlist");
    expect(data).not.toContain("runTriage");
    expect(data).not.toContain("fetchMarketNarrativePulse");
    expect(data).not.toContain("classifyMacroRegime");
    expect(data).not.toContain("classifySectorLeadership");
    expect(data).not.toContain("macroRegime");
    expect(data).not.toContain("sectorLeadership");
    expect(data).not.toContain("marketNarratives");
    expect(data).not.toMatch(/\btriage\b/);

    // Gauges only need VIX + 10Y; indexes stay DIA/SPY/QQQ/IWM (no MDY/RSP).
    expect(data).toContain('"^VIX"');
    expect(data).toContain('"^TNX"');
    expect(data).not.toContain('ticker: "UUP"');
    expect(data).not.toContain('ticker: "MDY"');
    expect(data).not.toContain('ticker: "RSP"');
    expect(data).toContain('ticker: "DIA"');
    expect(data).toContain('ticker: "IWM"');
    expect(data).toContain('ticker: "UNG"');
    expect(data).not.toContain("SOL-USD");
  });

  it("Pulse board only consumes scoreboard fields from the lean payload", () => {
    const board = read("src/components/market/PulseBoard.tsx");
    expect(board).toContain("data.indicators");
    expect(board).toContain("data?.globalMarkets");
    expect(board).toContain("data?.sectors");
    expect(board).toContain("data.sessionLabel");
    expect(board).not.toContain("macroRegime");
    expect(board).not.toContain("marketNarratives");
    expect(board).not.toContain("sectorLeadership");
    expect(board).not.toMatch(/data\.triage|\.triage\b/);
  });
});
