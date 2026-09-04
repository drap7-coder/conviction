import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { communityRankingRequirementLabel, MIN_RANKED_MEMBERS } from "@/lib/community-picks/constants";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("UX trust polish", () => {
  it("keeps matchup identity neutral and performance color semantic", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.h2h-side\s*\{[\s\S]*?var\(--color-surface-neutral\)/);
    expect(css).toMatch(/\.h2h-return\.is-up\s*\{[\s\S]*?var\(--positive/);
    expect(css).toMatch(/\.h2h-return\.is-down\s*\{[\s\S]*?var\(--negative/);
  });

  it("uses a shared ranking requirement in scoring copy", () => {
    expect(communityRankingRequirementLabel()).toBe(`needs ${MIN_RANKED_MEMBERS} members`);
    expect(read("src/components/CommunityPickCard.tsx")).toContain("communityRankingRequirementLabel()");
    expect(read("src/components/CrowdBoard.tsx")).toContain("communityRankingRequirementLabel()");
  });

  it("shows mathematically aligned allocation threshold labels", () => {
    const ladder = read("src/components/PortfolioAllocationLadder.tsx");
    const css = read("src/app/globals.css");
    expect(ladder).toContain("12% watch");
    expect(ladder).toContain("20% concentrated");
    expect(css).toContain(".pf-allocation-scale-track .is-watch { left: 48%; }");
    expect(css).toContain(".pf-allocation-scale-track .is-high { left: 80%; }");
  });

  it("keeps full-day portfolio dollars and percentage on the same baseline", () => {
    const card = read("src/components/PortfolioHoldingCard.tsx");
    expect(card).toContain("fmtPercent(metrics.dailyChangePercent, 2)");
  });

  it("disambiguates year-chart endpoints", () => {
    const chart = read("src/app/components/PriceTrendCard.tsx");
    expect(chart).toContain('year: range === "1y" ? "numeric" : undefined');
  });

  it("uses neutral topic tags and gates Manage for signed-out users", () => {
    const css = read("src/app/globals.css");
    const menu = read("src/components/BottomTabBar.tsx");
    expect(css).toMatch(/\.pulse-news-narrative-label\s*\{[\s\S]*?var\(--color-topic-bg\)[\s\S]*?var\(--color-topic\)/);
    expect(menu).toContain('authenticated === false && href === "/manage"');
    expect(menu).toContain('aria-disabled="true"');
  });
});
