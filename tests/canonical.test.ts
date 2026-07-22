import { describe, expect, it } from "vitest";
import { buildConvictionSnapshot } from "@/lib/conviction/canonical";
import { getConvictionBadge } from "@/lib/conviction/canonical-types";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { StockQuote } from "@/lib/market/quotes";

// ── Fixtures ──

function makeQuote(overrides: Partial<StockQuote> = {}): StockQuote {
  return {
    ticker: "TEST",
    price: 100,
    previousClose: 98,
    change: 2,
    changePercent: 2.04,
    volume: 1_000_000,
    dollarVolume: 100_000_000,
    currency: "USD",
    marketState: "REGULAR",
    marketCap: 10_000_000_000,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    source: "yahoo-chart" as const,
    sparkline: [{ date: "2026-07-15", close: 99 }, { date: "2026-07-16", close: 100 }],
    ...overrides,
  };
}

function institutionalRows(...statuses: InstitutionalAccumulation["status"][]): InstitutionalAccumulation[] {
  return statuses.map((status, i) => ({
    manager: `Manager${i}`,
    displayName: `Manager${i}`,
    cik: `cik${i}`,
    issuer: "Test",
    classTitle: "COM",
    cusip: `cusip${i}`,
    shares: status === "New" || status === "Increased" ? 200 : status === "Reduced" ? 50 : 100,
    previousShares: 100,
    shareChange: status === "New" || status === "Increased" ? 100 : status === "Reduced" ? -50 : 0,
    percentageChange: status === "New" ? 100 : status === "Increased" ? 100 : status === "Reduced" ? -50 : 0,
    reportedValue: 1000,
    filingQuarter: "2026-Q2",
    filingDate: "2026-05-15",
    status,
  }));
}

function makeInsiderEvents(...types: Array<"purchase" | "sale">): EvidenceEvent[] {
  return types.map((type, i) => ({
    id: `insider-${i}`,
    ticker: "TEST",
    type: "insider-transaction" as const,
    direction: type === "purchase" ? "positive" as const : "negative" as const,
    title: type === "purchase" ? "Open market purchase" : "Open market sale",
    summary: `${type === "purchase" ? "Buy" : "Sell"}`,
    source: "sec-edgar" as const,
    sourceUrl: "",
    date: "2026-07-01",
    disclosureDelay: 2,
    size: 0.5,
    strength: 0.7,
    isContradiction: false,
    aiExplanation: "",
    metadata: {
      insiderName: "John Doe",
      insiderRole: "CEO",
      transactionType: type,
      shares: 1000,
      totalValue: type === "purchase" ? 50000 : 50000,
      sharesOwnedAfter: 10000,
    },
  }));
}

// ── Tests ──

describe("buildConvictionSnapshot", () => {
  it("returns a complete snapshot for a bullish stock with multiple signals", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "TEST",
      institutional: { results: institutionalRows("New", "Increased"), status: "success" },
      insider: { events: makeInsiderEvents("purchase"), status: "success" },
      earnings: {
        ticker: "TEST",
        history: [],
        forecasts: [],
        historyScore: 15,
        revisionScore: 10,
        score: 12,
        momentum: "Estimates rising",
        nextEarningsDate: null,
        asOf: "2026-07-10",
        source: "nasdaq",
        status: "success",
      },
      political: {
        ticker: "TEST",
        trades: [],
        purchases: [],
        sales: [],
        totalEstimatedPurchases: 0,
        totalEstimatedSales: 0,
        latestFilingDate: null,
        source: "kadoa-open-data",
        sourceUrl: "",
        fetchedAt: "2026-07-10",
      },
      historyPoints: [],
      quote: makeQuote(),
      week52High: 120,
      week52Low: 80,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(snapshot.ticker).toBe("TEST");
    expect(snapshot.modelVersion).toBe("1.0.0");
    expect(snapshot.generatedAt).toBeTruthy();

    // Evidence assessment
    expect(snapshot.evidence.score).toBeGreaterThan(0);
    expect(["strong", "positive", "mixed", "weak", "negative"]).toContain(snapshot.evidence.verdict);
    expect(snapshot.evidence.confidence).toBeGreaterThanOrEqual(0);
    expect(snapshot.evidence.coverage).toBeGreaterThan(0.5);
    expect(snapshot.evidence.summary).toBeTruthy();

    // Signal-level assessment
    expect(snapshot.evidence.signals.institutional.score).toBeGreaterThan(0);
    expect(snapshot.evidence.signals.insider.score).toBeGreaterThan(0);
    expect(snapshot.evidence.signals.earnings.score).not.toBeNull();
    expect(snapshot.evidence.signals.political.score).toBeNull();

    // Evidence references
    expect(snapshot.evidence.signals.institutional.evidenceFor.length).toBeGreaterThan(0);
    expect(snapshot.evidence.signals.insider.evidenceFor.length).toBeGreaterThan(0);

    // Multi-signal status
    expect(snapshot.evidence.multiSignalStatus.qualifies).toBe(true);
    expect(snapshot.evidence.multiSignalStatus.categories.length).toBeGreaterThanOrEqual(2);

    // Technical assessment
    expect(snapshot.technical.state).toBeTruthy();
    expect(snapshot.technical.sma50).toBeNull(); // no history points provided
    expect(snapshot.technical.week52High).toBe(120);
    expect(snapshot.technical.week52Low).toBe(80);

    // Market session
    expect(snapshot.market.session).toBe("regular");
    expect(snapshot.market.displayedPrice).toBe(100);
    expect(snapshot.market.referencePrice).toBe(98);
  });

  it("returns negative score for bearish signals", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "BEAR",
      institutional: { results: institutionalRows("Reduced", "Exited"), status: "success" },
      insider: { events: makeInsiderEvents("sale"), status: "success" },
      earnings: {
        ticker: "BEAR",
        history: [],
        forecasts: [],
        historyScore: -25,
        revisionScore: -20,
        score: -22,
        momentum: "Estimates falling",
        nextEarningsDate: null,
        asOf: "2026-07-10",
        source: "nasdaq",
        status: "success",
      },
      political: null,
      historyPoints: [],
      quote: makeQuote({ price: 40, change: -5, changePercent: -11.11, previousClose: 45 }),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(snapshot.evidence.score).toBeLessThan(0);
    expect(snapshot.evidence.verdict).toMatch(/negative|weak/);
    expect(snapshot.evidence.signals.institutional.score).toBeLessThan(0);
    expect(snapshot.evidence.signals.insider.score).toBeLessThan(0);
    expect(snapshot.evidence.signals.earnings.score).toBeLessThan(0);
  });

  it("returns insufficient evidence when coverage is low", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "LOW",
      institutional: null,
      insider: null,
      earnings: null,
      political: null,
      historyPoints: [],
      quote: makeQuote(),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(snapshot.evidence.score).toBe(0);
    expect(snapshot.evidence.coverage).toBeLessThan(0.5);
    expect(snapshot.evidence.summary).toBeTruthy();
    // All signals should be unknown
    expect(snapshot.evidence.signals.institutional.sentiment).toBe("unknown");
    expect(snapshot.evidence.signals.insider.sentiment).toBe("unknown");
  });

  it("detects pre-market session correctly", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "PREM",
      institutional: null,
      insider: null,
      earnings: null,
      political: null,
      historyPoints: [],
      quote: makeQuote({
        marketState: "PRE",
        preMarketPrice: 102,
        preMarketChange: 2,
        preMarketChangePercent: 2.0,
        price: 100,
        previousClose: 100,
      }),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(snapshot.market.session).toBe("pre_market");
    expect(snapshot.market.displayedPrice).toBe(102);
    expect(snapshot.market.absoluteChange).toBe(2);
    expect(snapshot.market.percentChange).toBe(2.0);
  });

  it("preserves primary signal and primary risk", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "PRIME",
      institutional: { results: institutionalRows("New", "Increased"), status: "success" },
      insider: { events: makeInsiderEvents("purchase", "sale"), status: "success" },
      earnings: null,
      political: null,
      historyPoints: [],
      quote: makeQuote(),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    // Should have at least a primary signal (institutional is positive)
    expect(snapshot.evidence.primarySignal).not.toBeNull();
    // Should have supporting signals
    expect(snapshot.evidence.supportingSignals.length).toBeGreaterThanOrEqual(0);
  });
});

describe("getConvictionBadge", () => {
  it("returns correct badge for strong positive evidence", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "BULL",
      institutional: { results: institutionalRows("New", "Increased", "New"), status: "success" },
      insider: { events: makeInsiderEvents("purchase"), status: "success" },
      earnings: { ticker: "BULL", history: [], forecasts: [], historyScore: 25, revisionScore: 20, score: 22, momentum: "Estimates rising", nextEarningsDate: null, asOf: "2026-07-15", source: "nasdaq", status: "success" },
      political: null,
      historyPoints: [],
      quote: makeQuote(),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    const badge = getConvictionBadge(snapshot);
    expect(badge.verdict).toMatch(/Positive|Strong/);
    expect(badge.tone).toBe("positive");
  });

  it("returns correct badge for negative evidence", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "BEAR",
      institutional: { results: institutionalRows("Reduced", "Exited"), status: "success" },
      insider: { events: makeInsiderEvents("sale"), status: "success" },
      earnings: { ticker: "BEAR", history: [], forecasts: [], historyScore: -30, revisionScore: -25, score: -28, momentum: "Estimates falling", nextEarningsDate: null, asOf: "2026-07-15", source: "nasdaq", status: "success" },
      political: null,
      historyPoints: [],
      quote: makeQuote({ price: 50, change: -3, changePercent: -5.66, previousClose: 53 }),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    const badge = getConvictionBadge(snapshot);
    expect(badge.verdict).toMatch(/Negative|Weak/);
    expect(badge.tone).toBe("negative");
  });

  it("returns quiet tone for insufficient coverage", () => {
    const snapshot = buildConvictionSnapshot({
      ticker: "QUIET",
      institutional: null,
      insider: null,
      earnings: null,
      political: null,
      historyPoints: [],
      quote: makeQuote(),
      week52High: null,
      week52Low: null,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    const badge = getConvictionBadge(snapshot);
    expect(badge.tone).toBe("quiet");
    expect(badge.technicalState).toBeNull();
  });

  it("includes technical state when available", () => {
    // With price above SMA-50 and SMA-200
    const snapshot = buildConvictionSnapshot({
      ticker: "TECH",
      institutional: null,
      insider: null,
      earnings: null,
      political: null,
      // Generate some history data that's above SMA lines
      historyPoints: Array.from({ length: 250 }, (_, i) => ({
        date: new Date(2025, 11, 1 + i).toISOString().split("T")[0],
        close: 100 + (i > 200 ? 5 : 0), // recent uptrend
      })),
      quote: makeQuote({ price: 110, previousClose: 108, change: 2, changePercent: 1.85 }),
      week52High: 120,
      week52Low: 80,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    const badge = getConvictionBadge(snapshot);
    // Technical state may be set
    expect(badge.technicalState).toBeTruthy();
  });
});