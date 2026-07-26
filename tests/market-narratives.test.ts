import { describe, expect, it } from "vitest";
import { scoreNarrative } from "@/lib/market/market-narratives";

describe("scoreNarrative", () => {
  it("marks broad, accelerating chatter as surging", () => {
    const result = scoreNarrative({
      mentionsLastHour: 15,
      mentionsPreviousHour: 3,
      mentionsLast24Hours: 60,
      uniqueAuthorsLastHour: 12,
      assetMoves: [2, 1, 0.5],
    });

    expect(result.heat).toBe("surging");
    expect(result.marketTone).toBe("positive");
    expect(result.velocity).toBeGreaterThan(2.5);
  });

  it("marks a smaller multi-author acceleration as building", () => {
    const result = scoreNarrative({
      mentionsLastHour: 4,
      mentionsPreviousHour: 1,
      mentionsLast24Hours: 45,
      uniqueAuthorsLastHour: 3,
      assetMoves: [-1, -0.7, null],
    });

    expect(result.heat).toBe("building");
    expect(result.marketTone).toBe("negative");
  });

  it("keeps a theme quiet when there is no current chatter", () => {
    const result = scoreNarrative({
      mentionsLastHour: 0,
      mentionsPreviousHour: 2,
      mentionsLast24Hours: 20,
      uniqueAuthorsLastHour: 0,
      assetMoves: [1, -1, 0],
    });

    expect(result.heat).toBe("quiet");
    expect(result.marketTone).toBe("mixed");
    expect(result.velocity).toBe(0);
  });

  it("returns finite scores when market data is missing", () => {
    const result = scoreNarrative({
      mentionsLastHour: 2,
      mentionsPreviousHour: 2,
      mentionsLast24Hours: 30,
      uniqueAuthorsLastHour: 2,
      assetMoves: [null, null],
    });

    expect(result.marketTone).toBe("mixed");
    expect(Number.isFinite(result.score)).toBe(true);
  });
});
