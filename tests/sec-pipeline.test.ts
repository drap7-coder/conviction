/**
 * Unit tests for SEC Form 4 insider transaction pipeline.
 *
 * Tests:
 * - Transaction code classification
 * - Directional type identification
 * - Conviction engine scoring
 * - Materiality calculation
 * - Evidence conversion
 * - Realistic fixture scenarios
 */

import { describe, it, expect } from "vitest";
import { codeToType, isDirectionalType, TX_TYPE_LABELS } from "@/lib/sec/types";
import { calculateConviction, calculateNetInsiderShares, summarizeTransactions } from "@/lib/sec/conviction-engine";
import { calculateMateriality, detectClusteredBuying, calculateInsiderConviction } from "@/lib/sec/materiality";
import { TX_WEIGHTS, ROLE_MULTIPLIERS, CONVICTION_WINDOW_DAYS, MIN_VALUE_THRESHOLD } from "@/lib/sec/conviction-config";
import { insiderToEvidenceEvent, getEmergingReasonCodes } from "@/lib/sec/evidence-converter";
import type { InsiderTransaction } from "@/lib/sec/types";

// ── Helpers ──

function makeTx(overrides: Partial<InsiderTransaction> = {}): InsiderTransaction {
  return {
    id: "test-001",
    ticker: "TEST",
    cik: "0000000001",
    accessionNumber: "0000000001-25-000001",
    filingUrl: "https://sec.gov/Archives/edgar/data/1/0000000001-25-000001-index.htm",
    insiderName: "John Doe",
    insiderRole: "CEO",
    isDirector: true,
    isOfficer: true,
    isTenPercentOwner: false,
    transactionDate: "2026-06-01",
    filingDate: "2026-06-02",
    transactionCode: "P",
    transactionType: "purchase",
    shares: 10000,
    pricePerShare: 100,
    totalValue: 1000000,
    sharesOwnedAfter: 100000,
    isDirectOwnership: true,
    ownershipChange: 11.11,
    ...overrides,
  };
}

// ── 1. Transaction Code Classification ──

describe("codeToType", () => {
  it("maps P to purchase", () => {
    expect(codeToType("P")).toBe("purchase");
  });
  it("maps S to sale", () => {
    expect(codeToType("S")).toBe("sale");
  });
  it("maps D to sale", () => {
    expect(codeToType("D")).toBe("sale");
  });
  it("maps A to grant", () => {
    expect(codeToType("A")).toBe("grant");
  });
  it("maps M and C to option_exercise", () => {
    expect(codeToType("M")).toBe("option_exercise");
    expect(codeToType("C")).toBe("option_exercise");
  });
  it("maps G to gift", () => {
    expect(codeToType("G")).toBe("gift");
  });
  it("maps F to tax_withholding", () => {
    expect(codeToType("F")).toBe("tax_withholding");
  });
  it("maps V/I/W/U/X/J/L/K/Z to other", () => {
    for (const code of ["V", "I", "W", "U", "X", "J", "L", "K", "Z"]) {
      expect(codeToType(code as any)).toBe("other");
    }
  });
});

// ── 2. Directional Type ──

describe("isDirectionalType", () => {
  it("returns true for purchase", () => {
    expect(isDirectionalType("purchase")).toBe(true);
  });
  it("returns true for sale", () => {
    expect(isDirectionalType("sale")).toBe(true);
  });
  it("returns false for grant", () => {
    expect(isDirectionalType("grant")).toBe(false);
  });
  it("returns false for option_exercise", () => {
    expect(isDirectionalType("option_exercise")).toBe(false);
  });
  it("returns false for gift", () => {
    expect(isDirectionalType("gift")).toBe(false);
  });
  it("returns false for tax_withholding", () => {
    expect(isDirectionalType("tax_withholding")).toBe(false);
  });
  it("returns false for other", () => {
    expect(isDirectionalType("other")).toBe(false);
  });
});

// ── 3. TX_TYPE_LABELS ──

describe("TX_TYPE_LABELS", () => {
  it("provides display labels for all types", () => {
    expect(TX_TYPE_LABELS.purchase).toBe("Open Market Purchase");
    expect(TX_TYPE_LABELS.sale).toBe("Open Market Sale");
    expect(TX_TYPE_LABELS.grant).toBe("Equity Grant");
    expect(TX_TYPE_LABELS.option_exercise).toBe("Option Exercise");
    expect(TX_TYPE_LABELS.gift).toBe("Gift");
    expect(TX_TYPE_LABELS.tax_withholding).toBe("Tax Withholding");
    expect(TX_TYPE_LABELS.other).toBe("Other");
  });
});

// ── 4. Conviction Config ──

describe("TX_WEIGHTS", () => {
  it("purchase has base 100 and is meaningful", () => {
    expect(TX_WEIGHTS.purchase.base).toBe(100);
    expect(TX_WEIGHTS.purchase.meaningful).toBe(true);
  });
  it("sale has base -40 and is meaningful", () => {
    expect(TX_WEIGHTS.sale.base).toBe(-40);
    expect(TX_WEIGHTS.sale.meaningful).toBe(true);
  });
  it("grant has base 0 and is not meaningful", () => {
    expect(TX_WEIGHTS.grant.base).toBe(0);
    expect(TX_WEIGHTS.grant.meaningful).toBe(false);
  });
  it("option_exercise has base 0", () => {
    expect(TX_WEIGHTS.option_exercise.base).toBe(0);
  });
  it("tax_withholding has base 0", () => {
    expect(TX_WEIGHTS.tax_withholding.base).toBe(0);
  });
  it("gift has base 0", () => {
    expect(TX_WEIGHTS.gift.base).toBe(0);
  });
  it("ROLE_MULTIPLIERS includes CEO at 3x", () => {
    const ceoRule = ROLE_MULTIPLIERS.roleTitleMatch?.find((r) =>
      r.pattern.test("CEO"),
    );
    expect(ceoRule?.multiplier).toBe(3.0);
  });
  it("CONVICTION_WINDOW_DAYS is 90", () => {
    expect(CONVICTION_WINDOW_DAYS).toBe(90);
  });
  it("MIN_VALUE_THRESHOLD is 10000", () => {
    expect(MIN_VALUE_THRESHOLD).toBe(10000);
  });
});

// ── 5. Conviction Engine ──

describe("calculateConviction", () => {
  it("returns no_signal for no transactions", () => {
    const result = calculateConviction([]);
    expect(result.label).toBe("no_signal");
    expect(result.netScore).toBe(0);
    expect(result.meaningfulCount).toBe(0);
  });

  it("returns no_signal for non-directional transactions", () => {
    const txs = [
      makeTx({ transactionCode: "A", transactionType: "grant", totalValue: 500000 }),
    ];
    const result = calculateConviction(txs);
    expect(result.label).toBe("no_signal");
  });

  it("correctly scores a CEO purchase as bullish", () => {
    const txs = [
      makeTx({
        transactionType: "purchase",
        transactionCode: "P",
        shares: 10000,
        totalValue: 1000000,
        insiderRole: "CEO",
      }),
    ];
    const result = calculateConviction(txs);
    expect(result.label).toBe("bullish");
    expect(result.netScore).toBeGreaterThan(0);
    expect(result.meaningfulCount).toBe(1);
    expect(result.totalPurchased).toBe(1000000);
    expect(result.netShares).toBe(10000);
  });

  it("correctly scores a sale as bearish", () => {
    const txs = [
      makeTx({
        transactionType: "sale",
        transactionCode: "S",
        shares: 50000,
        totalValue: 2500000,
        insiderRole: "CFO",
      }),
    ];
    const result = calculateConviction(txs);
    expect(result.label).toBe("bearish");
    expect(result.netScore).toBeLessThan(0);
    expect(result.totalSold).toBe(2500000);
    expect(result.netShares).toBe(-50000);
  });

  it("ignores grants and option exercises in conviction score", () => {
    const txs = [
      makeTx({ transactionCode: "A", transactionType: "grant", totalValue: 0, shares: 5000, ownershipChange: 0 }),
      makeTx({ transactionCode: "M", transactionType: "option_exercise", totalValue: 0, shares: 2000, ownershipChange: 0 }),
      makeTx({ transactionCode: "F", transactionType: "tax_withholding", totalValue: 0, shares: 500, ownershipChange: 0 }),
    ];
    const result = calculateConviction(txs);
    expect(result.meaningfulCount).toBe(0);
    expect(result.label).toBe("no_signal");
  });

  it("calculates net shares correctly with mixed buys and sells", () => {
    const txs = [
      makeTx({ id: "buy1", transactionType: "purchase", shares: 10000, totalValue: 500000 }),
      makeTx({ id: "buy2", transactionType: "purchase", shares: 5000, totalValue: 250000 }),
      makeTx({ id: "sell1", transactionType: "sale", shares: 3000, totalValue: 150000 }),
    ];
    const result = calculateConviction(txs);
    expect(result.netShares).toBe(12000); // 10000 + 5000 - 3000
    expect(result.meaningfulCount).toBe(3);
  });

  it("applies role multipliers (CEO > director > other)", () => {
    const ceoTx = makeTx({
      id: "ceo-buy",
      transactionType: "purchase",
      shares: 5000,
      totalValue: 500000,
      insiderRole: "CEO",
      isDirector: true,
      isOfficer: true,
    });
    const directorTx = makeTx({
      id: "dir-buy",
      transactionType: "purchase",
      shares: 5000,
      totalValue: 500000,
      insiderRole: "Director",
      isDirector: true,
      isOfficer: false,
    });
    const officerTx = makeTx({
      id: "off-buy",
      transactionType: "purchase",
      shares: 5000,
      totalValue: 500000,
      insiderRole: "VP Engineering",
      isDirector: false,
      isOfficer: true,
    });

    const ceoScore = calculateConviction([ceoTx]);
    const dirScore = calculateConviction([directorTx]);
    const offScore = calculateConviction([officerTx]);

    // CEO (3x) > Director (1x) > Officer (0.8x)
    expect(ceoScore.netScore).toBeGreaterThan(dirScore.netScore);
    expect(dirScore.netScore).toBeGreaterThan(offScore.netScore);
  });

  it("filters transactions below MIN_VALUE_THRESHOLD from contribution", () => {
    const smallTx = makeTx({
      transactionType: "purchase",
      totalValue: 5000, // Below MIN_VALUE_THRESHOLD of 10000
      shares: 50,
    });
    const result = calculateConviction([smallTx]);
    expect(result.contributingTransactions).toBe(0);
    expect(result.netScore).toBe(0);
    // Transaction is still counted as directional, so label is neutral (not no_signal)
    expect(result.meaningfulCount).toBe(1);
  });
});

// ── 6. Materiality Calculation ──

describe("calculateMateriality", () => {
  it("returns higher score for CEO large purchase", () => {
    const tx = makeTx({
      transactionType: "purchase",
      totalValue: 10000000,
      insiderRole: "CEO",
      isDirector: true,
      isOfficer: true,
    });
    const result = calculateMateriality(tx);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.label).toBe("high");
  });

  it("returns lower score for small non-market transaction", () => {
    const tx = makeTx({
      transactionType: "option_exercise",
      totalValue: 10000,
      insiderRole: "VP Engineering",
      isDirector: false,
      isOfficer: true,
    });
    const result = calculateMateriality(tx);
    expect(result.label).toMatch(/low|medium/);
  });

  it("includes explanation factors", () => {
    const tx = makeTx({ transactionType: "purchase", totalValue: 1000000 });
    const result = calculateMateriality(tx);
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.factors[0].name).toBeTruthy();
  });
});

// ── 7. Evidence Conversion ──

describe("insiderToEvidenceEvent", () => {
  it("creates EvidenceEvent from purchase transaction", () => {
    const tx = makeTx({ transactionType: "purchase", shares: 5000, totalValue: 500000 });
    const event = insiderToEvidenceEvent(tx);
    expect(event.ticker).toBe("TEST");
    expect(event.direction).toBe("positive");
    expect(event.source).toBe("sec-edgar");
    expect(event.sourceUrl).toBe(tx.filingUrl);
    expect(event.metadata?.insiderName).toBe("John Doe");
    expect(event.metadata?.transactionType).toBe("purchase");
    expect(event.metadata?.shares).toBe(5000);
    expect(event.metadata?.totalValue).toBe(500000);
    expect(event.isContradiction).toBe(false);
  });

  it("creates EvidenceEvent from sale transaction as contradictory", () => {
    const tx = makeTx({
      transactionType: "sale",
      transactionCode: "S",
      shares: 10000,
      totalValue: 500000,
    });
    const event = insiderToEvidenceEvent(tx);
    expect(event.direction).toBe("negative");
    expect(event.isContradiction).toBe(true);
    expect(event.metadata?.transactionType).toBe("sale");
  });

  it("creates neutral EvidenceEvent for grant", () => {
    const tx = makeTx({
      transactionType: "grant",
      transactionCode: "A",
      shares: 1000,
      totalValue: 0,
    });
    const event = insiderToEvidenceEvent(tx);
    expect(event.direction).toBe("neutral");
    expect(event.isContradiction).toBe(false);
  });

  it("includes deterministic AI explanation", () => {
    const tx = makeTx({ transactionType: "purchase", shares: 10000, totalValue: 1000000 });
    const event = insiderToEvidenceEvent(tx);
    expect(event.aiExplanation).toContain("purchased");
    expect(event.aiExplanation).toContain("10,000 shares");
    expect(event.aiExplanation).toContain("$1,000,000");
  });
});

// ── 8. Emerging Evidence ──

describe("getEmergingReasonCodes", () => {
  it("returns empty for no transactions", () => {
    const result = getEmergingReasonCodes([], "TEST", "Test Co");
    expect(result.qualify).toBe(false);
    expect(result.reasonCodes).toHaveLength(0);
  });

  it("returns bullish codes for clustered purchases", () => {
    const txs = [
      makeTx({ id: "b1", insiderName: "Alice", transactionType: "purchase", totalValue: 500000 }),
      makeTx({ id: "b2", insiderName: "Bob", transactionType: "purchase", totalValue: 300000 }),
      makeTx({ id: "b3", insiderName: "Alice", transactionType: "purchase", totalValue: 200000 }),
    ];
    const result = getEmergingReasonCodes(txs, "TEST", "Test Co");
    expect(result.qualify).toBe(true);
    expect(result.reasonCodes.length).toBeGreaterThanOrEqual(2);
    const codes = result.reasonCodes.map((r) => r.code);
    expect(codes).toContain("insider-conviction-bullish");
    expect(codes).toContain("clustered-insider");
  });

  it("does not qualify for grants only", () => {
    const txs = [
      makeTx({ id: "g1", transactionType: "grant", totalValue: 0 }),
      makeTx({ id: "g2", transactionType: "option_exercise", totalValue: 0 }),
    ];
    const result = getEmergingReasonCodes(txs, "TEST", "Test Co");
    expect(result.qualify).toBe(false);
  });
});

// ── 9. Helper Functions ──

describe("summarizeTransactions", () => {
  it("groups transactions by type", () => {
    const txs = [
      makeTx({ transactionType: "purchase" }),
      makeTx({ id: "s1", transactionType: "sale" }),
      makeTx({ id: "g1", transactionType: "grant" }),
      makeTx({ id: "o1", transactionType: "option_exercise" }),
      makeTx({ id: "o2", transactionType: "purchase" }),
    ];
    const summary = summarizeTransactions(txs);
    expect(summary.purchases).toBe(2);
    expect(summary.sales).toBe(1);
    expect(summary.grants).toBe(1);
    expect(summary.options).toBe(1);
    expect(summary.others).toBe(0);
  });
});

describe("calculateNetInsiderShares", () => {
  it("calculates net shares correctly", () => {
    const txs = [
      makeTx({ transactionType: "purchase", shares: 10000 }),
      makeTx({ id: "s1", transactionType: "sale", shares: 3000 }),
    ];
    expect(calculateNetInsiderShares(txs)).toBe(7000);
  });
});

describe("detectClusteredBuying", () => {
  it("detects multiple insiders buying", () => {
    const txs = [
      makeTx({ id: "a1", insiderName: "Alice", transactionType: "purchase" }),
      makeTx({ id: "b1", insiderName: "Bob", transactionType: "purchase" }),
    ];
    expect(detectClusteredBuying(txs)).toBe(true);
  });

  it("single insider single purchase is not clustered", () => {
    const txs = [makeTx({ transactionType: "purchase" })];
    expect(detectClusteredBuying(txs)).toBe(false);
  });
});

describe("calculateInsiderConviction", () => {
  it("returns 0 for empty", () => {
    expect(calculateInsiderConviction([])).toBe(0);
  });

  it("returns positive score for more buys than sells", () => {
    const txs = [
      makeTx({ id: "b1", transactionType: "purchase", totalValue: 500000, insiderRole: "CEO" }),
      makeTx({ id: "b2", transactionType: "purchase", totalValue: 300000, insiderRole: "Director" }),
    ];
    expect(calculateInsiderConviction(txs)).toBeGreaterThan(0);
  });
});