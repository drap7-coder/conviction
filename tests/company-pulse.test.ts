import { describe, expect, it } from "vitest";
import { getCompanyPulseCopy } from "@/lib/market/company-pulse";
import type { OpenAttentionItem } from "@/lib/market/open-attention";

function item(overrides: Partial<OpenAttentionItem>): OpenAttentionItem {
  return {
    ticker: "INTC",
    label: "Intel Corporation",
    scope: "company",
    mentionsLastHour: 6,
    mentionsPreviousHour: 3,
    mentionsLast24Hours: 40,
    uniqueAuthorsLastHour: 5,
    priceChangePercent: 0.2,
    velocity: 3,
    accelerationPercent: 100,
    score: 60,
    signal: "steady",
    confidence: "medium",
    summary: "Conversation is near its recent baseline.",
    ...overrides,
  };
}

describe("getCompanyPulseCopy", () => {
  it("explains attention moving ahead of price", () => {
    expect(getCompanyPulseCopy(item({ signal: "attention-leading" }))).toEqual({
      headline: "Attention is moving before price",
      tone: "leading",
    });
  });

  it("distinguishes a confirming signal", () => {
    expect(getCompanyPulseCopy(item({ signal: "price-confirming" })).tone).toBe("confirming");
  });

  it("describes an empty steady sample as quiet", () => {
    expect(getCompanyPulseCopy(item({ mentionsLastHour: 0 })).headline).toBe("Open-market attention is quiet");
  });
});
