import { describe, expect, it } from "vitest";
import {
  buildInstitutionalBrief,
  buildPoliticalBrief,
  classifyInstitutionalIdea,
  groupPoliticalTrades,
} from "@/lib/market/smart-money-brief";
import type { InstitutionalMarketIdea } from "@/lib/sec/institutional";
import type { PoliticalTrade, PoliticalTradeDirection } from "@/lib/political-trades";

function institutionalIdea(
  ticker: string,
  overrides: Partial<InstitutionalMarketIdea> = {},
): InstitutionalMarketIdea {
  return {
    ticker,
    companyName: `${ticker} Inc.`,
    categories: ["shared"],
    headline: "Shared Conviction",
    holderCount: 4,
    newPositionCount: 0,
    increasedCount: 0,
    filingQuarter: "2026-03-31",
    latestFilingDate: "2026-05-15",
    score: 100,
    moves: [],
    ...overrides,
  };
}

function politicalTrade(
  id: string,
  ticker: string,
  direction: PoliticalTradeDirection,
  amount: number,
  daysToFile: number,
  overrides: Partial<PoliticalTrade> = {},
): PoliticalTrade {
  return {
    id,
    ticker,
    assetName: `${ticker} Fund`,
    filerName: `Filer ${id}`,
    office: "Senator",
    chamber: "Senate",
    party: null,
    state: null,
    transactionType: direction === "purchase" ? "Purchase" : direction === "sale" ? "Sale" : "Exchange",
    direction,
    amountRange: "$1,001 - $15,000",
    amountLow: 1_001,
    amountHigh: 15_000,
    estimatedAmount: amount,
    transactionDate: "2026-06-16",
    filingDate: "2026-08-08",
    daysToFile,
    isLate: daysToFile > 45,
    sourceUrl: "https://example.com/filing",
    ...overrides,
  };
}

describe("Smart Money decision briefs", () => {
  it("advances independent institutional convergence to the research queue", () => {
    const meta = institutionalIdea("META", {
      holderCount: 10,
      newPositionCount: 4,
      increasedCount: 4,
      categories: ["new", "added", "shared"],
      headline: "New Position",
    });

    expect(classifyInstitutionalIdea(meta)).toMatchObject({
      grade: "A",
      label: "Research now",
      tone: "positive",
    });
    expect(buildInstitutionalBrief([meta], 15)).toMatchObject({
      tone: "positive",
      headline: "Fresh fund buying converges on META.",
    });
  });

  it("keeps passive ownership without fresh buying as filing-only evidence", () => {
    expect(classifyInstitutionalIdea(institutionalIdea("CALM"))).toMatchObject({
      grade: "C",
      label: "Filing only",
    });
  });

  it("groups repeat political disclosures and preserves filing lag", () => {
    const groups = groupPoliticalTrades([
      politicalTrade("a", "SPY", "purchase", 75_001, 53),
      politicalTrade("b", "SPY", "purchase", 750_001, 53),
      politicalTrade("c", "PINS", "sale", 32_501, 0),
    ]);

    expect(groups[0]).toMatchObject({
      ticker: "PINS",
      saleCount: 1,
      isBroadMarket: false,
    });
    expect(groups[1]).toMatchObject({
      ticker: "SPY",
      purchaseCount: 2,
      estimatedPurchases: 825_002,
      medianLag: 53,
      lateCount: 2,
      directionLabel: "Purchase cluster",
      isBroadMarket: true,
    });
    expect(groups).toHaveLength(2);
  });

  it("makes late stock reporting part of the political headline", () => {
    const brief = buildPoliticalBrief([
      politicalTrade("a", "SPY", "purchase", 75_001, 53),
      politicalTrade("b", "SPY", "purchase", 750_001, 53),
      politicalTrade("c", "PINS", "sale", 32_501, 53, {
        isLate: true,
        assetName: "Pinterest Inc.",
      }),
    ]);

    expect(brief.tone).toBe("alert");
    expect(brief.headline).toContain("PINS");
    expect(brief.headline).toContain("arrived late");
    expect(brief.headline).not.toContain("SPY");
    expect(brief.summary).toMatch(/ETF or index/i);
    expect(brief.metrics[2].value).toBe("53d");
  });

  it("does not let SPY own the political research lead", () => {
    const brief = buildPoliticalBrief([
      politicalTrade("a", "SPY", "purchase", 750_001, 10, { assetName: "SPDR S&P 500 ETF" }),
      politicalTrade("b", "NVDA", "purchase", 32_501, 10, { assetName: "NVIDIA Corp" }),
    ]);

    expect(brief.headline).toContain("NVDA");
    expect(brief.headline).not.toContain("SPY");
  });
});
