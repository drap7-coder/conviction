import { describe, expect, it } from "vitest";
import { buildCompanyDecisionBrief } from "@/lib/company/company-decision-brief";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

const score: ConvictionScoreView = {
  ticker: "TEST",
  score: 58,
  displayScore: 79,
  label: "positive",
  displayLabel: "Accumulating",
  ringLabel: "Accumulating",
  tone: "green",
  evidenceTone: "positive",
  evidenceScore: 40,
  qualityScore: 74,
  blended: true,
  coverage: 0.82,
  includedCategories: ["technicals", "short_interest"],
  includedQualityFactors: ["earnings_consistency"],
  detail: "Test score",
  categories: [
    {
      category: "technicals",
      score: 70,
      hasData: true,
      isStale: false,
      explanation: "Price is above both moving averages",
    },
    {
      category: "short_interest",
      score: -20,
      hasData: true,
      isStale: false,
      explanation: "Short interest rose 8%",
    },
  ],
  qualityFactors: [
    {
      factor: "earnings_consistency",
      score: 90,
      hasData: true,
      explanation: "Four recent quarters beat estimates",
    },
  ],
  scoringVersion: "1.0",
};

const earnings: EarningsEvidence = {
  ticker: "TEST",
  history: [{
    fiscalQuarter: "Jun 2026",
    reportedDate: "2026-07-20",
    actualEps: 1.2,
    estimatedEps: 1,
    surprisePercent: 20,
  }],
  forecasts: [{
    fiscalQuarter: "Sep 2026",
    consensusEps: 1.35,
    revisionsUp: 3,
    revisionsDown: 0,
  }],
  gradeActions: [],
  historyScore: 100,
  revisionScore: 100,
  score: 100,
  momentum: "Estimates rising",
  nextEarningsDate: null,
  asOf: "2026-07-20T00:00:00.000Z",
  source: "nasdaq",
  status: "success",
};

describe("company decision brief", () => {
  it("turns score and earnings data into a decision-first read", () => {
    const brief = buildCompanyDecisionBrief(score, earnings);

    expect(brief).toMatchObject({
      tone: "positive",
      status: "Accumulating",
      scoreValue: "79/100",
      coverageValue: "82%",
      earningsValue: "Estimates rising",
    });
    expect(brief.support).toContain("Technicals");
    expect(brief.pressure).toContain("Short interest");
    expect(brief.nextCheck).toContain("Sep 2026");
    expect(brief.scoreDetail).toBe("Quality 74 · evidence +40");
  });

  it("keeps missing evidence visible instead of inventing a read", () => {
    const brief = buildCompanyDecisionBrief(null, null);

    expect(brief.tone).toBe("quiet");
    expect(brief.scoreValue).toBe("—");
    expect(brief.earningsValue).toBe("Not sourced");
    expect(brief.headline).toContain("still forming");
  });
});
