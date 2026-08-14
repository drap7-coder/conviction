import { describe, expect, it } from "vitest";
import {
  buildIndexTapeBrief,
  buildMomentumBrief,
  buildTrendingBreadthBrief,
} from "@/lib/market/pulse-brief";

describe("Pulse decision briefs", () => {
  it("identifies broad major-index participation", () => {
    const brief = buildIndexTapeBrief([
      { ticker: "SPY", name: "S&P 500", changePercent: 1.1 },
      { ticker: "QQQ", name: "Nasdaq 100", changePercent: 1.7 },
      { ticker: "IWM", name: "Russell 2000", changePercent: 0.8 },
      { ticker: "DIA", name: "Dow", changePercent: -0.1 },
    ]);

    expect(brief.tone).toBe("positive");
    expect(brief.headline).toContain("broadening");
    expect(brief.metrics[0].value).toContain("QQQ");
    expect(brief.metrics[1].value).toBe("3 / 4 up");
  });

  it("calls out narrow index leadership", () => {
    const brief = buildIndexTapeBrief([
      { ticker: "QQQ", name: "Nasdaq 100", changePercent: 1.2 },
      { ticker: "SPY", name: "S&P 500", changePercent: 0.1 },
      { ticker: "IWM", name: "Russell 2000", changePercent: -0.4 },
      { ticker: "DIA", name: "Dow", changePercent: -0.3 },
    ]);

    expect(brief.tone).toBe("mixed");
    expect(brief.headline).toContain("narrow");
  });

  it("distinguishes broad from concentrated trending confirmation", () => {
    expect(buildTrendingBreadthBrief(0.6, 0.4)).toMatchObject({
      tone: "positive",
      headline: "Breadth confirms the move.",
    });
    expect(buildTrendingBreadthBrief(-0.7, -0.5)).toMatchObject({
      tone: "negative",
      headline: "Narrow tape — top-heavy.",
    });
  });

  it("summarizes both direction and leadership in active names", () => {
    const brief = buildMomentumBrief([
      { ticker: "AAA", companyName: "Alpha", changePercent: 6.2 },
      { ticker: "BBB", companyName: "Beta", changePercent: 2.1 },
      { ticker: "CCC", companyName: "Gamma", changePercent: 1.2 },
      { ticker: "DDD", companyName: "Delta", changePercent: -0.4 },
    ]);

    expect(brief.tone).toBe("positive");
    expect(brief.metrics[0].value).toContain("AAA +6.2%");
    expect(brief.metrics[1].value).toBe("3 / 4");
    expect(brief.metrics[2].value).toContain("DDD -0.4%");
  });
});
