import { describe, expect, it } from "vitest";
import { scoreAttention } from "@/lib/market/open-attention";

describe("scoreAttention", () => {
  it("detects attention moving before price", () => {
    const result = scoreAttention({
      mentionsLastHour: 12,
      mentionsPreviousHour: 3,
      mentionsLast24Hours: 60,
      uniqueAuthorsLastHour: 10,
      largestAuthorShare: 0.2,
      priceChangePercent: 0.2,
    });

    expect(result.signal).toBe("attention-leading");
    expect(result.velocity).toBeGreaterThan(2);
    expect(result.confidence).toBe("high");
  });

  it("detects attention confirming a material price move", () => {
    const result = scoreAttention({
      mentionsLastHour: 8,
      mentionsPreviousHour: 4,
      mentionsLast24Hours: 80,
      uniqueAuthorsLastHour: 6,
      largestAuthorShare: 0.25,
      priceChangePercent: -2.1,
    });

    expect(result.signal).toBe("price-confirming");
    expect(result.confidence).toBe("medium");
  });

  it("detects conversation cooling from the previous hour", () => {
    const result = scoreAttention({
      mentionsLastHour: 1,
      mentionsPreviousHour: 5,
      mentionsLast24Hours: 30,
      uniqueAuthorsLastHour: 1,
      largestAuthorShare: 1,
      priceChangePercent: 0.1,
    });

    expect(result.signal).toBe("cooling");
    expect(result.accelerationPercent).toBe(-80);
  });

  it("reduces confidence when one author dominates the sample", () => {
    const result = scoreAttention({
      mentionsLastHour: 10,
      mentionsPreviousHour: 2,
      mentionsLast24Hours: 40,
      uniqueAuthorsLastHour: 4,
      largestAuthorShare: 0.8,
      priceChangePercent: 0.1,
    });

    expect(result.signal).toBe("attention-leading");
    expect(result.confidence).toBe("low");
  });

  it("handles an empty signal without invalid numbers", () => {
    const result = scoreAttention({
      mentionsLastHour: 0,
      mentionsPreviousHour: 0,
      mentionsLast24Hours: 0,
      uniqueAuthorsLastHour: 0,
      largestAuthorShare: 0,
      priceChangePercent: null,
    });

    expect(result.signal).toBe("steady");
    expect(result.velocity).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });
});
