/**
 * ── Tests for Display Layer ──
 *
 * Covers:
 * - Formatting utilities
 * - Summary prioritization
 * - Supporting fact selection
 * - Ticker deduplication
 * - Quote freshness classification
 */

import { describe, it, expect } from "vitest";
import {
  isFiniteNumber,
  fmtCurrency,
  fmtCompactCurrency,
  fmtPercent,
  fmtPrice,
  fmtSignedDollar,
  fmtMarketCap,
  fmtDate,
  classifyFreshness,
} from "@/lib/display/format";
import {
  normalizeTicker,
  deduplicateByTicker,
  countDuplicates,
} from "@/lib/display/dedup";
import { selectSummary, selectSupportingFacts } from "@/lib/display/summary";
import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";
import type { PortfolioContext } from "@/lib/display/types";

// ═══════════════════════════════════════════════════════════════
// Formatting utilities
// ═══════════════════════════════════════════════════════════════

describe("isFiniteNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(-3.14)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFiniteNumber(null)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe("fmtCurrency", () => {
  it("formats a value as USD", () => {
    expect(fmtCurrency(1234.5)).toBe("$1,234.50");
  });

  it("returns — for null", () => {
    expect(fmtCurrency(null)).toBe("—");
  });

  it("returns — for NaN", () => {
    expect(fmtCurrency(NaN)).toBe("—");
  });
});

describe("fmtCompactCurrency", () => {
  it("formats billions", () => {
    expect(fmtCompactCurrency(1_500_000_000)).toBe("$1.5B");
  });

  it("formats millions", () => {
    expect(fmtCompactCurrency(2_300_000)).toBe("$2.3M");
  });

  it("formats thousands", () => {
    expect(fmtCompactCurrency(450_000)).toBe("$450.0K");
  });

  it("formats small values with decimals", () => {
    expect(fmtCompactCurrency(123.45)).toBe("$123.45");
  });

  it("returns — for null", () => {
    expect(fmtCompactCurrency(null)).toBe("—");
  });
});

describe("fmtPercent", () => {
  it("formats a positive percentage", () => {
    expect(fmtPercent(3.42)).toBe("+3.42%");
  });

  it("formats a negative percentage", () => {
    expect(fmtPercent(-0.15)).toBe("-0.15%");
  });

  it("formats zero", () => {
    expect(fmtPercent(0)).toBe("+0.00%");
  });

  it("returns — for null", () => {
    expect(fmtPercent(null)).toBe("—");
  });

  it("respects decimal places", () => {
    expect(fmtPercent(3.456, 1)).toBe("+3.5%");
  });
});

describe("fmtPrice", () => {
  it("formats high values without decimals", () => {
    expect(fmtPrice(5469)).toBe("5,469");
  });

  it("formats medium values with 2 decimals", () => {
    expect(fmtPrice(150.25)).toBe("150.25");
  });

  it("formats small values with 3 decimals", () => {
    expect(fmtPrice(0.123)).toBe("0.123");
  });

  it("returns — for null", () => {
    expect(fmtPrice(null)).toBe("—");
  });
});

describe("fmtSignedDollar", () => {
  it("formats a positive value", () => {
    expect(fmtSignedDollar(420.69)).toBe("+$420.69");
  });

  it("formats a negative value", () => {
    expect(fmtSignedDollar(-50)).toBe("−$50.00");
  });

  it("formats zero", () => {
    expect(fmtSignedDollar(0)).toBe("$0.00");
  });

  it("returns — for null", () => {
    expect(fmtSignedDollar(null)).toBe("—");
  });
});

describe("fmtMarketCap", () => {
  it("formats billions", () => {
    expect(fmtMarketCap(185_200_000_000)).toBe("$185.2B");
  });

  it("formats millions", () => {
    expect(fmtMarketCap(12_400_000)).toBe("$12.4M");
  });

  it("returns — for null", () => {
    expect(fmtMarketCap(null)).toBe("—");
  });
});

describe("fmtDate", () => {
  it("returns 'today' for current date", () => {
    expect(fmtDate(new Date().toISOString())).toBe("today");
  });

  it("returns '—' for null", () => {
    expect(fmtDate(null)).toBe("—");
  });

  it("returns '—' for invalid date", () => {
    expect(fmtDate("not-a-date")).toBe("—");
  });
});

// ═══════════════════════════════════════════════════════════════
// Quote freshness classification
// ═══════════════════════════════════════════════════════════════

describe("classifyFreshness", () => {
  it("classifies live data within 60s", () => {
    const now = new Date().toISOString();
    expect(classifyFreshness(now)).toBe("live");
  });

  it("classifies recent data within 5m", () => {
    const fiveMinAgo = new Date(Date.now() - 120_000).toISOString();
    expect(classifyFreshness(fiveMinAgo)).toBe("recent");
  });

  it("classifies stale data older than 15m", () => {
    const old = new Date(Date.now() - 1_000_000).toISOString();
    expect(classifyFreshness(old)).toBe("stale");
  });

  it("returns 'unavailable' for null", () => {
    expect(classifyFreshness(null)).toBe("unavailable");
  });

  it("returns 'delayed' for explicit delayed provider", () => {
    expect(classifyFreshness(new Date().toISOString(), true)).toBe("delayed");
  });
});

// ═══════════════════════════════════════════════════════════════
// Ticker deduplication
// ═══════════════════════════════════════════════════════════════

describe("normalizeTicker", () => {
  it("uppercases and trims", () => {
    expect(normalizeTicker("  aapl  ")).toBe("AAPL");
  });

  it("strips leading carets", () => {
    expect(normalizeTicker("^VIX")).toBe("VIX");
  });

  it("strips leading dots", () => {
    expect(normalizeTicker(".SPX")).toBe("SPX");
  });
});

describe("deduplicateByTicker", () => {
  it("removes duplicates preserving first order", () => {
    const input = [
      { ticker: "AAPL", value: 1 },
      { ticker: "GOOG", value: 2 },
      { ticker: "aapl", value: 3 },
    ];
    const result = deduplicateByTicker(input);
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe("AAPL");
    expect(result[0].value).toBe(1);
  });

  it("merges complementary fields from duplicates", () => {
    const input = [
      { ticker: "AAPL", name: "Apple", value: null },
      { ticker: "AAPL", name: null, value: 150 },
    ];
    const result = deduplicateByTicker(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Apple");
    expect(result[0].value).toBe(150);
  });

  it("handles empty array", () => {
    expect(deduplicateByTicker([])).toEqual([]);
  });
});

describe("countDuplicates", () => {
  it("counts duplicate tickers", () => {
    const input = [
      { ticker: "AAPL" },
      { ticker: "GOOG" },
      { ticker: "AAPL" },
    ];
    expect(countDuplicates(input)).toBe(1);
  });

  it("returns 0 for no duplicates", () => {
    const input = [{ ticker: "AAPL" }, { ticker: "GOOG" }];
    expect(countDuplicates(input)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Evidence summary prioritization
// ═══════════════════════════════════════════════════════════════

function makeMinimalSnapshot(
  overrides?: Partial<ConvictionSnapshot>,
): ConvictionSnapshot {
  return {
    ticker: "TEST",
    modelVersion: "1",
    evidence: {
      score: 0,
      verdict: "mixed",
      direction: "stable",
      signals: {
        institutional: {
          sentiment: "neutral",
          score: 0,
          confidence: 0,
          freshness: 0,
          evidenceFor: [],
          evidenceAgainst: [],
          summary: "",
          updatedAt: null,
        },
        insider: {
          sentiment: "neutral",
          score: 0,
          confidence: 0,
          freshness: 0,
          evidenceFor: [],
          evidenceAgainst: [],
          summary: "",
          updatedAt: null,
        },
        earnings: {
          sentiment: "neutral",
          score: 0,
          confidence: 0,
          freshness: 0,
          evidenceFor: [],
          evidenceAgainst: [],
          summary: "",
          updatedAt: null,
        },
        political: {
          sentiment: "neutral",
          score: 0,
          confidence: 0,
          freshness: 0,
          evidenceFor: [],
          evidenceAgainst: [],
          summary: "",
          updatedAt: null,
        },
      },
      primarySignal: null,
      primaryRisk: null,
      supportingSignals: [],
      conflictingSignals: [],
      multiSignalStatus: {
        qualifies: false,
        categories: [],
        explanation: "",
      },
      confidence: 0,
      coverage: 0,
      summary: "",
    },
    technical: {
      state: "unknown",
      shortTermTrend: {
        sentiment: "unknown",
        score: null,
        confidence: 0,
        freshness: 0,
        evidenceFor: [],
        evidenceAgainst: [],
        summary: "",
        updatedAt: null,
      },
      longTermTrend: {
        sentiment: "unknown",
        score: null,
        confidence: 0,
        freshness: 0,
        evidenceFor: [],
        evidenceAgainst: [],
        summary: "",
        updatedAt: null,
      },
      rangePosition: {
        sentiment: "unknown",
        score: null,
        confidence: 0,
        freshness: 0,
        evidenceFor: [],
        evidenceAgainst: [],
        summary: "",
        updatedAt: null,
      },
      price: null,
      previousClose: null,
      sma50: null,
      sma200: null,
      distanceFromSma50Pct: null,
      distanceFromSma200Pct: null,
      week52High: null,
      week52Low: null,
      rangePositionPct: null,
      summary: "",
      updatedAt: null,
    },
    market: {
      session: "regular",
      displayedPrice: null,
      absoluteChange: null,
      percentChange: null,
      referencePrice: null,
      referenceLabel: "",
      updatedAt: null,
    },
    generatedAt: new Date().toISOString(),
    evidenceUpdatedAt: null,
    technicalUpdatedAt: null,
    marketUpdatedAt: null,
    ...overrides,
  };
}

describe("selectSummary", () => {
  it("returns portfolio contribution before institutional", () => {
    const portfolio: PortfolioContext = {
      isHeld: true,
      weightPercent: 15,
      dayContributionAmount: -500,
      relevanceLabel: null,
    };
    const result = selectSummary(null, portfolio);
    expect(result.category).toBe("portfolio");
  });

  it("returns institutional evidence when available", () => {
    const snapshot = makeMinimalSnapshot({
      evidence: {
        score: 30,
        verdict: "positive",
        direction: "improving",
        signals: {
          institutional: {
            sentiment: "strong_positive",
            score: 50,
            confidence: 0.8,
            freshness: 0.9,
            evidenceFor: [
              {
                id: "13f-1",
                type: "institutional",
                summary: "D. E. Shaw increased position by 12%",
                direction: "positive",
                date: new Date().toISOString(),
                strength: 0.7,
                source: "13F",
              },
            ],
            evidenceAgainst: [],
            summary: "Institutional accumulation detected",
            updatedAt: new Date().toISOString(),
          },
          insider: {
            sentiment: "neutral",
            score: 0,
            confidence: 0,
            freshness: 0,
            evidenceFor: [],
            evidenceAgainst: [],
            summary: "",
            updatedAt: null,
          },
          earnings: {
            sentiment: "neutral",
            score: 0,
            confidence: 0,
            freshness: 0,
            evidenceFor: [],
            evidenceAgainst: [],
            summary: "",
            updatedAt: null,
          },
          political: {
            sentiment: "neutral",
            score: 0,
            confidence: 0,
            freshness: 0,
            evidenceFor: [],
            evidenceAgainst: [],
            summary: "",
            updatedAt: null,
          },
        },
        primarySignal: null,
        primaryRisk: null,
        supportingSignals: [],
        conflictingSignals: [],
        multiSignalStatus: {
          qualifies: false,
          categories: [],
          explanation: "",
        },
        confidence: 0.8,
        coverage: 0.8,
        summary: "Institutional accumulation",
      },
    });
    const result = selectSummary(snapshot, null);
    expect(result.category).toBe("institutional");
  });

  it("returns fallback when no significant evidence", () => {
    const result = selectSummary(null, null);
    expect(result.headline).toBe("No material evidence change detected.");
    expect(result.category).toBe("none");
  });
});

// ═══════════════════════════════════════════════════════════════
// Supporting fact selection
// ═══════════════════════════════════════════════════════════════

describe("selectSupportingFacts", () => {
  it("returns at most 2 facts", () => {
    const facts = selectSupportingFacts(null, null);
    expect(facts.length).toBeLessThanOrEqual(2);
  });

  it("includes portfolio weight when > 20%", () => {
    const portfolio: PortfolioContext = {
      isHeld: true,
      weightPercent: 25,
      dayContributionAmount: 100,
      relevanceLabel: null,
    };
    const facts = selectSupportingFacts(null, portfolio);
    expect(facts.some((f) => f.category === "portfolio")).toBe(true);
  });

  it("does not include duplicate categories", () => {
    const portfolio: PortfolioContext = {
      isHeld: true,
      weightPercent: 25,
      dayContributionAmount: 500,
      relevanceLabel: null,
    };
    const facts = selectSupportingFacts(null, portfolio);
    const portfolioFacts = facts.filter((f) => f.category === "portfolio");
    expect(portfolioFacts.length).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// True zero vs missing move
// ═══════════════════════════════════════════════════════════════

describe("true zero vs missing", () => {
  it("formats a true 0% move correctly", () => {
    expect(fmtPercent(0)).toBe("+0.00%");
  });

  it("returns — for null move", () => {
    expect(fmtPercent(null)).toBe("—");
  });

  it("distinguishes $0.00 from null", () => {
    expect(fmtSignedDollar(0)).toBe("$0.00");
    expect(fmtSignedDollar(null)).toBe("—");
  });
});