import { describe, expect, it } from "vitest";
import { getNewsEvidenceSummary, moveEventToNewsEvidence } from "@/lib/evidence/news-evidence";
import type { MoveEvent } from "@/lib/evidence/move-events";
import { buildNewsDriver } from "@/lib/evidence/news-driver";
import type { EvidenceEvent } from "@/lib/evidence/types";

function headline(title: string): EvidenceEvent {
  return {
    id: title,
    ticker: "TEST",
    type: "material-news",
    direction: "neutral",
    title,
    summary: "",
    source: "publisher",
    sourceUrl: "https://example.com",
    date: "2026-07-23",
    disclosureDelay: 0,
    size: 0.5,
    strength: 0.5,
    isContradiction: false,
    aiExplanation: "",
  };
}

describe("news evidence", () => {
  it("converts a sourced IBM earnings warning into contradicting material evidence", async () => {
    const summary = await getNewsEvidenceSummary("IBM");

    expect(summary.status).toBe("success");
    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]).toMatchObject({
      ticker: "IBM",
      type: "material-news",
      direction: "negative",
      isContradiction: true,
      source: "publisher",
    });
    expect(summary.events[0].sourceUrl).toMatch(/^https:\/\//);
    expect(summary.events[0].strength).toBeGreaterThanOrEqual(0.8);
  });

  it("falls back to RSS for tickers without curated events", async () => {
    const summary = await getNewsEvidenceSummary("OXY", "Occidental Petroleum");

    // Should find RSS headlines for a major company
    // If RSS fails (e.g. offline), it should still return "empty" gracefully
    expect(["success", "empty"]).toContain(summary.status);
    if (summary.status === "success") {
      expect(summary.source).toBe("yahoo-finance-rss");
      expect(summary.events.length).toBeGreaterThan(0);
      expect(summary.events[0]).toMatchObject({
        ticker: "OXY",
        type: "material-news",
        source: "publisher",
      });
      expect(summary.events[0].sourceUrl).toBeTruthy();
    }
  });

  it("does not lower the bar for low-confidence or unsourced events", () => {
    const base: MoveEvent = {
      ticker: "TEST",
      companyName: "Test Co",
      date: "2026-07-14",
      headline: "Rumor says something maybe happened.",
      answer: "A weak unsourced claim should not become evidence.",
      category: "company-news",
      confidence: "low",
      details: [],
      convictionQuestion: "Do not trade on fog.",
      sources: [{ label: "Example", headline: "Example", url: "https://example.com/story" }],
      updatedAt: "2026-07-14T12:00:00Z",
    };

    expect(moveEventToNewsEvidence(base)).toEqual([]);
    expect(moveEventToNewsEvidence({ ...base, confidence: "high", sources: [] })).toEqual([]);
    expect(moveEventToNewsEvidence({ ...base, confidence: "high", sources: [{ label: "Bad", headline: "Bad", url: "not-a-url" }] })).toEqual([]);
  });

  it("extracts durable themes from company-relevant coverage", () => {
    expect(buildNewsDriver([headline("Stripe and Advent offer to buy PayPal")], "PYPL", "PayPal")).toMatchObject({
      label: "Strategic options",
    });
    expect(buildNewsDriver([headline("Tesla releases second-quarter earnings")], "TSLA", "Tesla")).toMatchObject({
      label: "Execution + margins",
    });
    expect(buildNewsDriver([headline("OXY rises as Brent jumps on Middle East supply fears")], "OXY", "Occidental")).toMatchObject({
      label: "Oil sensitivity",
    });
  });

  it("does not assign an unrelated oil roundup to a healthcare company", () => {
    const driver = buildNewsDriver([
      headline("Oil rises on Middle East supply fears as markets open"),
      headline("Pfizer updates investors on its product pipeline"),
    ], "PFE", "Pfizer");

    expect(driver?.label).not.toBe("Oil sensitivity");
    expect(driver?.explanation).not.toMatch(/oil|geopolitical/i);
    expect(driver).toMatchObject({ label: "Pipeline renewal" });
  });
});
