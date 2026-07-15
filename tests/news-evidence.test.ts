import { describe, expect, it } from "vitest";
import { getNewsEvidenceSummary, moveEventToNewsEvidence } from "@/lib/evidence/news-evidence";
import type { MoveEvent } from "@/lib/evidence/move-events";

describe("news evidence", () => {
  it("converts a sourced IBM earnings warning into contradicting material evidence", () => {
    const summary = getNewsEvidenceSummary("IBM");

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

  it("does not create evidence from fallback no-catalyst events", () => {
    const summary = getNewsEvidenceSummary("OXY", "Occidental Petroleum");

    expect(summary.status).toBe("empty");
    expect(summary.events).toEqual([]);
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
});
