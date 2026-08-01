import { describe, expect, it } from "vitest";
import {
  blendEvidenceAndQuality,
  buildQualityFactors,
  calculateConvictionScore,
  calculateQualityComposite,
  EVIDENCE_BLEND_WEIGHT,
  labelForScore,
  QUALITY_BLEND_WEIGHT,
  QUALITY_FACTOR_WEIGHTS,
  SCORING_VERSION,
  type CategoryScore,
  type ConvictionScoreResult,
  type QualityFactorScore,
} from "@/lib/conviction/score";
import { fundamentalsFromNasdaqPayload } from "@/lib/market/fundamentals";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

function evidenceResult(score: number | null): ConvictionScoreResult {
  if (score === null) {
    return {
      score: null,
      label: "insufficient_evidence",
      coverage: 0.4,
      agreementAdjustment: 0,
      includedCategories: ["institutional"],
      excludedCategories: ["technicals", "short_interest"],
    };
  }
  return {
    score,
    label: labelForScore(score),
    coverage: 1,
    agreementAdjustment: 0,
    includedCategories: ["institutional", "technicals", "short_interest"],
    excludedCategories: [],
  };
}

function factor(
  overrides: Partial<QualityFactorScore> & Pick<QualityFactorScore, "factor">,
): QualityFactorScore {
  return {
    score: 0,
    baseWeight: QUALITY_FACTOR_WEIGHTS[overrides.factor],
    hasData: true,
    explanation: "test",
    ...overrides,
  };
}

describe("SCORING_VERSION", () => {
  it("bumps for the quality blend contract", () => {
    expect(SCORING_VERSION).toBe("1.4.0");
  });
});

describe("calculateQualityComposite", () => {
  it("returns null when quality coverage is too thin", () => {
    const result = calculateQualityComposite([
      factor({ factor: "ownership_base", score: 40 }),
      factor({ factor: "margin_moat", hasData: false }),
      factor({ factor: "balance_sheet", hasData: false }),
      factor({ factor: "fcf_strength", hasData: false }),
      factor({ factor: "earnings_consistency", hasData: false }),
      factor({ factor: "capital_return", hasData: false }),
    ]);
    expect(result.coverage).toBeCloseTo(0.12);
    expect(result.score).toBeNull();
  });

  it("scores when enough slow-moving factors are present", () => {
    const result = calculateQualityComposite([
      factor({ factor: "margin_moat", score: 60 }),
      factor({ factor: "balance_sheet", score: 40 }),
      factor({ factor: "fcf_strength", score: 50 }),
      factor({ factor: "earnings_consistency", hasData: false }),
      factor({ factor: "ownership_base", hasData: false }),
      factor({ factor: "capital_return", hasData: false }),
    ]);
    const coverage = 0.22 + 0.2 + 0.18;
    const expected = Math.round((60 * 0.22 + 40 * 0.2 + 50 * 0.18) / coverage);
    expect(result.coverage).toBeCloseTo(coverage);
    expect(result.score).toBe(expected);
  });
});

describe("blendEvidenceAndQuality", () => {
  it("keeps 65/35 weights", () => {
    expect(QUALITY_BLEND_WEIGHT).toBe(0.65);
    expect(EVIDENCE_BLEND_WEIGHT).toBe(0.35);
  });

  it("withholds when evidence coverage is insufficient", () => {
    const quality = calculateQualityComposite([
      factor({ factor: "margin_moat", score: 80 }),
      factor({ factor: "balance_sheet", score: 70 }),
      factor({ factor: "fcf_strength", score: 60 }),
      factor({ factor: "earnings_consistency", score: 50 }),
      factor({ factor: "ownership_base", hasData: false }),
      factor({ factor: "capital_return", hasData: false }),
    ]);
    const blended = blendEvidenceAndQuality(evidenceResult(null), quality);
    expect(blended.score).toBeNull();
    expect(blended.label).toBe("insufficient_evidence");
    expect(blended.qualityScore).not.toBeNull();
    expect(blended.blended).toBe(false);
  });

  it("falls back to evidence when quality is missing", () => {
    const quality = calculateQualityComposite([
      factor({ factor: "margin_moat", hasData: false }),
      factor({ factor: "balance_sheet", hasData: false }),
      factor({ factor: "fcf_strength", hasData: false }),
      factor({ factor: "earnings_consistency", hasData: false }),
      factor({ factor: "ownership_base", hasData: false }),
      factor({ factor: "capital_return", hasData: false }),
    ]);
    const blended = blendEvidenceAndQuality(evidenceResult(10), quality);
    expect(blended.score).toBe(10);
    expect(blended.label).toBe("mixed");
    expect(blended.blended).toBe(false);
  });

  it("lifts a mixed evidence week when quality is strong (AAPL-style)", () => {
    const quality = calculateQualityComposite([
      factor({ factor: "margin_moat", score: 70 }),
      factor({ factor: "balance_sheet", score: 55 }),
      factor({ factor: "fcf_strength", score: 65 }),
      factor({ factor: "earnings_consistency", score: 50 }),
      factor({ factor: "ownership_base", score: 40 }),
      factor({ factor: "capital_return", score: 60 }),
    ]);
    expect(quality.score).not.toBeNull();
    const blended = blendEvidenceAndQuality(evidenceResult(0), quality);
    const expected = Math.round(quality.score! * 0.65 + 0 * 0.35);
    expect(blended.score).toBe(expected);
    expect(blended.blended).toBe(true);
    expect(blended.label).toBe("positive");
    expect(expected).toBeGreaterThanOrEqual(25);
  });

  it("does not let quality agreement interfere with evidence agreement", () => {
    const categories: CategoryScore[] = [
      {
        ticker: "TEST",
        category: "institutional",
        score: 40,
        baseWeight: 0.45,
        hasData: true,
        isStale: false,
        sourceDate: "2026-07-01",
        updatedAt: "2026-07-27T12:00:00.000Z",
        explanation: "inst",
        scoringVersion: SCORING_VERSION,
      },
      {
        ticker: "TEST",
        category: "technicals",
        score: 40,
        baseWeight: 0.38,
        hasData: true,
        isStale: false,
        sourceDate: "2026-07-01",
        updatedAt: "2026-07-27T12:00:00.000Z",
        explanation: "tech",
        scoringVersion: SCORING_VERSION,
      },
      {
        ticker: "TEST",
        category: "short_interest",
        score: 40,
        baseWeight: 0.17,
        hasData: true,
        isStale: false,
        sourceDate: "2026-07-01",
        updatedAt: "2026-07-27T12:00:00.000Z",
        explanation: "si",
        scoringVersion: SCORING_VERSION,
      },
    ];
    const evidence = calculateConvictionScore(categories);
    expect(evidence.agreementAdjustment).toBe(5);
    expect(evidence.score).toBe(45);

    const quality = calculateQualityComposite([
      factor({ factor: "margin_moat", score: -80 }),
      factor({ factor: "balance_sheet", score: -80 }),
      factor({ factor: "fcf_strength", score: -80 }),
      factor({ factor: "earnings_consistency", score: -80 }),
      factor({ factor: "ownership_base", score: -80 }),
      factor({ factor: "capital_return", score: -80 }),
    ]);
    const blended = blendEvidenceAndQuality(evidence, quality);
    // Evidence half still includes +5; blend uses that evidence score as-is.
    expect(blended.evidenceScore).toBe(45);
    expect(blended.score).toBe(Math.round(quality.score! * 0.65 + 45 * 0.35));
  });
});

describe("buildQualityFactors", () => {
  it("scores ownership by who holds, not flow direction", () => {
    const holders: InstitutionalAccumulation[] = [
      {
        manager: "Berkshire Hathaway",
        displayName: "Berkshire Hathaway",
        cik: "0001067983",
        issuer: "Apple Inc",
        classTitle: "COM",
        cusip: "037833100",
        shares: 1_000_000,
        previousShares: 1_000_000,
        shareChange: 0,
        percentageChange: 0,
        reportedValue: 1,
        filingQuarter: "2026-03-31",
        filingDate: "2026-05-15",
        status: "Unchanged",
      },
      {
        manager: "Citadel Advisors",
        displayName: "Citadel",
        cik: "0001423053",
        issuer: "Apple Inc",
        classTitle: "COM",
        cusip: "037833100",
        shares: 500_000,
        previousShares: 100_000,
        shareChange: 400_000,
        percentageChange: 400,
        reportedValue: 1,
        filingQuarter: "2026-03-31",
        filingDate: "2026-05-15",
        status: "Increased",
      },
    ];

    const factors = buildQualityFactors({ institutionalResults: holders });
    const ownership = factors.find((item) => item.factor === "ownership_base");
    expect(ownership?.hasData).toBe(true);
    expect(ownership?.score).toBeGreaterThan(0);
    expect(ownership?.explanation).toMatch(/Berkshire/);
  });

  it("builds fundamentals factors from Nasdaq payload shape", () => {
    const fundamentals = fundamentalsFromNasdaqPayload("AAPL", {
      data: {
        incomeStatementTable: {
          headers: { value2: "Period Ending: 9/27/2025" },
          rows: [
            { value1: "Total Revenue", value2: "$416,161,000" },
            { value1: "Gross Profit", value2: "$195,201,000" },
            { value1: "Operating Income", value2: "$133,050,000" },
            { value1: "Net Income", value2: "$112,010,000" },
          ],
        },
        balanceSheetTable: {
          rows: [
            { value1: "Cash and Cash Equivalents", value2: "$35,934,000" },
            { value1: "Short-Term Investments", value2: "$18,763,000" },
            { value1: "Short-Term Debt / Current Portion of Long-Term Debt", value2: "$20,329,000" },
            { value1: "Long-Term Debt", value2: "$78,328,000" },
            { value1: "Total Equity", value2: "$73,733,000" },
            { value1: "Total Assets", value2: "$359,241,000" },
            { value1: "Total Liabilities", value2: "$285,508,000" },
          ],
        },
        cashFlowTable: {
          rows: [
            { value1: "Net Cash Flow-Operating", value2: "$111,482,000" },
            { value1: "Capital Expenditures", value2: "-$12,715,000" },
            { value1: "Sale and Purchase of Stock", value2: "-$90,711,000" },
          ],
        },
        financialRatiosTable: {
          rows: [
            { value1: "Gross Margin", value2: "46.90516%" },
            { value1: "Operating Margin", value2: "31.9708%" },
            { value1: "Profit Margin", value2: "26.91506%" },
            { value1: "After Tax ROE", value2: "151.91298%" },
            { value1: "Current Ratio", value2: "89.32929%" },
          ],
        },
      },
    });

    expect(fundamentals.status).toBe("success");
    expect(fundamentals.freeCashFlow).toBe(111_482_000 - 12_715_000);

    const earnings: EarningsEvidence = {
      ticker: "AAPL",
      history: [
        {
          fiscalQuarter: "2025-09",
          reportedDate: "2025-10-30",
          actualEps: 1.5,
          estimatedEps: 1.4,
          surprisePercent: 7,
        },
        {
          fiscalQuarter: "2025-06",
          reportedDate: "2025-07-30",
          actualEps: 1.4,
          estimatedEps: 1.3,
          surprisePercent: 7,
        },
      ],
      forecasts: [],
      historyScore: 50,
      revisionScore: null,
      score: 50,
      momentum: "Stable",
      nextEarningsDate: null,
      asOf: "2025-10-30",
      source: "nasdaq",
      status: "partial",
    };

    const factors = buildQualityFactors({ fundamentals, earnings });
    expect(factors.filter((item) => item.hasData).length).toBeGreaterThanOrEqual(4);
    expect(factors.find((item) => item.factor === "margin_moat")?.score).toBeGreaterThan(0);
    expect(factors.find((item) => item.factor === "fcf_strength")?.hasData).toBe(true);
    expect(factors.find((item) => item.factor === "capital_return")?.score).toBeGreaterThan(0);
    expect(factors.find((item) => item.factor === "earnings_consistency")?.score).toBe(50);
  });
});
