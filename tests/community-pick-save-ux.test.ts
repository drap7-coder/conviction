import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  averageStudentBalanceUsd,
  formatUsd,
  formatUsdDelta,
  notionalDeltaUsd,
  notionalValueUsd,
  PLAYER_BANKROLL_USD,
} from "@/lib/community-picks/notional";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("community pick save UX", () => {
  it("shows explicit Save Pick and Confirm Swap on Your Picks", () => {
    const source = read("src/components/YourPicksCard.tsx");
    expect(source).toContain('"Save Pick"');
    expect(source).toContain('"Confirm Swap"');
    expect(source).toContain("your-picks-save");
    expect(source).toContain("your-picks-success");
    expect(source).toContain("your-picks-error");
  });

  it("uses company typeahead and logos for stocks only — not BTC/Gold or countries", () => {
    const source = read("src/components/YourPicksCard.tsx");
    const typeahead = read("src/components/CompanyTypeahead.tsx");
    expect(source).toContain("CompanyTypeahead");
    expect(source).toContain("LogoDisplay");
    expect(source).toContain("pick.pricingSymbol");
    expect(source).not.toContain("asset.pricingSymbol");
    expect(source).toContain("your-picks-added-chip");
    expect(source).toContain("is-just-saved");
    expect(source).toContain("added ·");
    expect(typeahead).toContain("LogoDisplay");
    expect(typeahead).toContain("ticker-suggestion-logo");
  });

  it("leads Your Picks with $100,000 performance and styles Crowd chrome", () => {
    const source = read("src/components/YourPicksCard.tsx");
    const css = read("src/app/globals.css");
    const board = read("src/components/CrowdBoard.tsx");
    expect(source).toContain("your-picks-bankroll");
    expect(source).toContain("PLAYER_BANKROLL_USD");
    expect(source).not.toContain("your-picks-iqbulls");
    expect(board).toContain("crowd-bankroll-lead");
    expect(board).toContain("average student");
    expect(css).toContain(".your-picks-card");
    expect(css).toContain(".your-picks-binary");
    expect(css).toContain(".your-picks-bankroll");
    expect(css).toContain(".your-picks-logo");
    expect(css).toContain(".your-picks-success.is-banner");
    expect(css).toContain(".ticker-suggestion-logo");
  });
});

describe("$100k notional premise", () => {
  it("keeps school dollars as average student balance, not headcount × $100k", () => {
    expect(PLAYER_BANKROLL_USD).toBe(100_000);
    expect(notionalValueUsd(1.24)).toBe(101_240);
    expect(notionalDeltaUsd(1.24)).toBe(1_240);
    expect(averageStudentBalanceUsd(1.24)).toBe(101_240);
    // Same avg % → same dollars whether 5 or 500 members.
    expect(averageStudentBalanceUsd(2.5)).toBe(notionalValueUsd(2.5));
    expect(formatUsd(100_000)).toBe("$100,000");
    expect(formatUsdDelta(1_240)).toBe("+$1,240");
    const notional = read("src/lib/community-picks/notional.ts");
    expect(notional).not.toContain("playerCount");
    expect(notional).toContain("Independent of member count");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("averageStudentBalanceUsd");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("averageStudentBalanceUsd");
  });
});
