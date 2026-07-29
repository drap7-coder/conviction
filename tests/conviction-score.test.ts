import { describe, expect, it } from "vitest";
import {
  applyAgreementAdjustment,
  calculateConvictionScore,
  calculateCoverage,
  CATEGORY_WEIGHTS,
  labelForScore,
  SCORING_VERSION,
  type CategoryScore,
  type EvidenceCategory,
} from "@/lib/conviction/score";

function category(
  overrides: Partial<CategoryScore> & Pick<CategoryScore, "category">,
): CategoryScore {
  const cat = overrides.category;
  return {
    ticker: "AAPL",
    score: 0,
    baseWeight: CATEGORY_WEIGHTS[cat],
    hasData: true,
    isStale: false,
    sourceDate: "2026-07-01",
    updatedAt: "2026-07-27T12:00:00.000Z",
    explanation: `${cat} evidence`,
    scoringVersion: SCORING_VERSION,
    ...overrides,
  };
}

function allCategories(
  scores: Partial<Record<EvidenceCategory, Partial<CategoryScore>>>,
): CategoryScore[] {
  return (Object.keys(CATEGORY_WEIGHTS) as EvidenceCategory[]).map((cat) =>
    category({ category: cat, ...(scores[cat] ?? { hasData: false, score: 0 }) }),
  );
}

describe("calculateCoverage", () => {
  it("sums base weights of usable categories only", () => {
    const coverage = calculateCoverage([
      category({ category: "institutional", score: 40 }),
      category({ category: "technicals", hasData: false }),
      category({ category: "short_interest", hasData: true, isStale: true, score: 80 }),
    ]);
    // 0.45 only
    expect(coverage).toBeCloseTo(0.45);
  });
});

describe("applyAgreementAdjustment", () => {
  it("adds +5 when at least three usable categories are >= +25", () => {
    const usable = [
      category({ category: "institutional", score: 25 }),
      category({ category: "technicals", score: 30 }),
      category({ category: "short_interest", score: 50 }),
    ];
    expect(applyAgreementAdjustment(usable)).toBe(5);
  });

  it("subtracts 5 when at least three usable categories are <= -25", () => {
    const usable = [
      category({ category: "institutional", score: -25 }),
      category({ category: "technicals", score: -30 }),
      category({ category: "short_interest", score: -50 }),
    ];
    expect(applyAgreementAdjustment(usable)).toBe(-5);
  });

  it("applies no adjustment below three agreeing categories", () => {
    const usable = [
      category({ category: "institutional", score: 40 }),
      category({ category: "technicals", score: 40 }),
      category({ category: "short_interest", score: 10 }),
    ];
    expect(applyAgreementAdjustment(usable)).toBe(0);
  });
});

describe("labelForScore", () => {
  it("maps every score-label boundary", () => {
    expect(labelForScore(null)).toBe("insufficient_evidence");

    expect(labelForScore(100)).toBe("strong_positive");
    expect(labelForScore(60)).toBe("strong_positive");
    expect(labelForScore(59)).toBe("positive");
    expect(labelForScore(25)).toBe("positive");
    expect(labelForScore(24)).toBe("mixed");
    expect(labelForScore(0)).toBe("mixed");
    expect(labelForScore(-24)).toBe("mixed");
    expect(labelForScore(-25)).toBe("negative");
    expect(labelForScore(-59)).toBe("negative");
    expect(labelForScore(-60)).toBe("strong_negative");
    expect(labelForScore(-100)).toBe("strong_negative");
  });
});

describe("calculateConvictionScore", () => {
  it("returns insufficient evidence when no category has data", () => {
    const result = calculateConvictionScore(
      allCategories({
        institutional: { hasData: false },
        technicals: { hasData: false },
        short_interest: { hasData: false },
      }),
    );

    expect(result.score).toBeNull();
    expect(result.label).toBe("insufficient_evidence");
    expect(result.coverage).toBe(0);
    expect(result.agreementAdjustment).toBe(0);
    expect(result.includedCategories).toEqual([]);
    expect(result.excludedCategories).toHaveLength(3);
  });

  it("returns insufficient evidence when coverage is below 50%", () => {
    const result = calculateConvictionScore([
      category({ category: "institutional", score: 80 }),
      category({ category: "technicals", hasData: false }),
    ]);

    // 0.45 < 0.50
    expect(result.coverage).toBeCloseTo(0.45);
    expect(result.score).toBeNull();
    expect(result.label).toBe("insufficient_evidence");
    expect(result.includedCategories).toEqual(["institutional"]);
    expect(result.excludedCategories).toEqual(["technicals"]);
  });

  it("scores when institutional + technicals clear the coverage gate", () => {
    const result = calculateConvictionScore([
      category({ category: "institutional", score: 100 }),
      category({ category: "technicals", score: 0 }),
    ]);

    expect(result.coverage).toBeCloseTo(0.83);
    // Renormalized: (100*0.45 + 0*0.38) / 0.83 ≈ 54.2 → 54
    expect(result.score).toBe(Math.round((100 * 0.45) / 0.83));
    expect(result.label).toBe("positive");
    expect(result.agreementAdjustment).toBe(0);
    expect(result.includedCategories).toEqual(["institutional", "technicals"]);
  });

  it("scores full three-category coverage", () => {
    const result = calculateConvictionScore(
      allCategories({
        institutional: { score: 40 },
        technicals: { score: 10 },
        short_interest: { score: 0 },
      }),
    );

    const expected = Math.round((40 * 0.45 + 10 * 0.38 + 0 * 0.17) / 1);

    expect(result.coverage).toBeCloseTo(1);
    expect(result.score).toBe(expected);
    expect(result.label).toBe("mixed");
    expect(result.agreementAdjustment).toBe(0);
    expect(result.includedCategories).toHaveLength(3);
    expect(result.excludedCategories).toEqual([]);
  });

  it("renormalizes usable weights instead of treating missing as neutral", () => {
    const result = calculateConvictionScore([
      category({ category: "institutional", score: 100 }),
      category({ category: "technicals", score: 50 }),
      category({ category: "short_interest", hasData: false }),
    ]);

    // coverage 0.83; weighted avg = (100*0.45 + 50*0.38) / 0.83
    expect(result.coverage).toBeCloseTo(0.83);
    expect(result.score).toBe(Math.round((100 * 0.45 + 50 * 0.38) / 0.83));
    expect(result.label).toBe("strong_positive");
  });

  it("excludes stale categories from coverage and the composite", () => {
    const result = calculateConvictionScore([
      category({ category: "institutional", score: 100, isStale: true }),
      category({ category: "technicals", score: 50 }),
      category({ category: "short_interest", score: 50 }),
    ]);

    // usable: technicals 0.38 + short 0.17 = 0.55
    expect(result.coverage).toBeCloseTo(0.55);
    expect(result.includedCategories).toEqual(["technicals", "short_interest"]);
    expect(result.excludedCategories).toEqual(["institutional"]);
    expect(result.score).toBe(50);
  });

  it("applies positive agreement adjustment when three categories are bullish", () => {
    const result = calculateConvictionScore(
      allCategories({
        institutional: { score: 40 },
        technicals: { score: 40 },
        short_interest: { score: 40 },
      }),
    );

    expect(result.coverage).toBeCloseTo(1);
    expect(result.agreementAdjustment).toBe(5);
    expect(result.score).toBe(45);
    expect(result.label).toBe("positive");
  });

  it("applies negative agreement adjustment when three categories are bearish", () => {
    const result = calculateConvictionScore(
      allCategories({
        institutional: { score: -40 },
        technicals: { score: -40 },
        short_interest: { score: -40 },
      }),
    );

    expect(result.agreementAdjustment).toBe(-5);
    expect(result.score).toBe(-45);
    expect(result.label).toBe("negative");
  });

  it("does not apply agreement adjustment with only two agreeing categories", () => {
    const result = calculateConvictionScore(
      allCategories({
        institutional: { score: 50 },
        technicals: { score: 50 },
        short_interest: { hasData: false },
      }),
    );

    expect(result.coverage).toBeCloseTo(0.83);
    expect(result.agreementAdjustment).toBe(0);
    expect(result.score).toBe(50);
  });

  it("clamps the final score to [-100, +100]", () => {
    const high = calculateConvictionScore(
      allCategories({
        institutional: { score: 100 },
        technicals: { score: 100 },
        short_interest: { score: 100 },
      }),
    );
    expect(high.agreementAdjustment).toBe(5);
    expect(high.score).toBe(100);

    const low = calculateConvictionScore(
      allCategories({
        institutional: { score: -100 },
        technicals: { score: -100 },
        short_interest: { score: -100 },
      }),
    );
    expect(low.agreementAdjustment).toBe(-5);
    expect(low.score).toBe(-100);
  });

  it("treats hasData false and isStale true differently in excluded set", () => {
    const result = calculateConvictionScore([
      category({ category: "institutional", score: 80, hasData: true, isStale: true }),
      category({ category: "technicals", score: 10 }),
      category({ category: "short_interest", hasData: false, score: 0 }),
    ]);

    expect(result.excludedCategories).toEqual(["institutional", "short_interest"]);
    expect(result.includedCategories).toEqual(["technicals"]);
    expect(result.coverage).toBeCloseTo(0.38);
    expect(result.score).toBeNull();
  });
});
