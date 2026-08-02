import { describe, expect, it } from "vitest";
import {
  classifyGradeDirection,
  earningsTickerVariants,
  mapFmpGradeActions,
  scoreEarningsParts,
} from "@/lib/earnings/fetch";
import type { EarningsForecast, EarningsQuarter } from "@/lib/earnings/types";

describe("earningsTickerVariants", () => {
  it("tries both BRK-B and BRK.B forms", () => {
    expect(earningsTickerVariants("BRK-B")).toEqual(["BRK-B", "BRK.B"]);
    expect(earningsTickerVariants("brk.b")).toEqual(["BRK.B", "BRK-B"]);
  });

  it("leaves plain tickers alone", () => {
    expect(earningsTickerVariants("AAPL")).toEqual(["AAPL"]);
  });
});

describe("scoreEarningsParts", () => {
  it("scores beat history and rising revisions", () => {
    const history: EarningsQuarter[] = [
      { fiscalQuarter: "Q1", reportedDate: "2026-04-30", actualEps: 2, estimatedEps: 1.8, surprisePercent: 11 },
      { fiscalQuarter: "Q4", reportedDate: "2026-01-30", actualEps: 2, estimatedEps: 1.9, surprisePercent: 5 },
      { fiscalQuarter: "Q3", reportedDate: "2025-10-30", actualEps: 1.5, estimatedEps: 1.6, surprisePercent: -6 },
      { fiscalQuarter: "Q2", reportedDate: "2025-07-30", actualEps: 1.4, estimatedEps: 1.3, surprisePercent: 8 },
    ];
    const forecasts: EarningsForecast[] = [
      { fiscalQuarter: "Q2", consensusEps: 2.1, revisionsUp: 8, revisionsDown: 2 },
    ];
    const scored = scoreEarningsParts(history, forecasts);
    expect(scored.historyScore).toBe(50); // 25+25-25+25
    expect(scored.revisionScore).toBe(60); // (8-2)/10 * 100
    expect(scored.score).toBe(54); // 50*0.6 + 60*0.4
    expect(scored.momentum).toBe("Estimates rising");
    expect(scored.status).toBe("success");
  });

  it("marks empty inputs unavailable", () => {
    const scored = scoreEarningsParts([], []);
    expect(scored.status).toBe("unavailable");
    expect(scored.score).toBeNull();
  });

  it("allows history-only partial coverage", () => {
    const history: EarningsQuarter[] = [
      { fiscalQuarter: "Q1", reportedDate: "2026-04-30", actualEps: 1, estimatedEps: 1, surprisePercent: 0 },
    ];
    const scored = scoreEarningsParts(history, []);
    expect(scored.status).toBe("partial");
    expect(scored.historyScore).toBe(25);
    expect(scored.revisionScore).toBeNull();
    expect(scored.score).toBe(25);
  });
});

describe("analyst grade mapping", () => {
  it("classifies upgrade, downgrade, initiate, and maintain actions", () => {
    expect(classifyGradeDirection("upgrade")).toBe("upgrade");
    expect(classifyGradeDirection("downgrade")).toBe("downgrade");
    expect(classifyGradeDirection("initiate")).toBe("initiate");
    expect(classifyGradeDirection("maintain")).toBe("maintain");
    expect(classifyGradeDirection("buy", "Hold", "Buy")).toBe("upgrade");
    expect(classifyGradeDirection("sell", "Hold", "Sell")).toBe("downgrade");
  });

  it("maps FMP grade rows into UI actions", () => {
    const actions = mapFmpGradeActions([
      {
        date: "2026-07-31",
        gradingCompany: "Morgan Stanley",
        action: "upgrade",
        previousGrade: "Equal-Weight",
        newGrade: "Overweight",
      },
      {
        date: "2026-07-28",
        gradingCompany: "JPMorgan",
        action: "maintain",
        previousGrade: "Overweight",
        newGrade: "Overweight",
      },
    ]);

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      firm: "Morgan Stanley",
      direction: "upgrade",
      previousGrade: "Equal-Weight",
      newGrade: "Overweight",
    });
    expect(actions[1]?.direction).toBe("maintain");
  });
});
