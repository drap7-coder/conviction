import { describe, expect, it } from "vitest";
import { buildConvictionHeader } from "@/lib/conviction/header";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

const now = new Date("2026-07-15T12:00:00Z");

function institutional(status: InstitutionalAccumulation["status"]): InstitutionalAccumulation {
  return {
    manager: "test",
    displayName: "Test Manager",
    cik: "0000000001",
    issuer: "Test Co",
    classTitle: "COM",
    cusip: "000000000",
    shares: status === "Exited" ? 0 : 100,
    previousShares: status === "New" ? 0 : 50,
    shareChange: status === "Reduced" || status === "Exited" ? -50 : 50,
    percentageChange: null,
    reportedValue: 1000,
    filingQuarter: "2026-Q2",
    filingDate: "2026-05-15",
    status,
  };
}

function insider(type: "purchase" | "sale", date: string): EvidenceEvent {
  return {
    id: `${type}-${date}`,
    ticker: "TEST",
    type: type === "purchase" ? "insider-buy" : "insider-sell",
    direction: type === "purchase" ? "positive" : "negative",
    title: "Insider transaction",
    summary: "Open-market transaction.",
    source: "sec-edgar",
    sourceUrl: "https://www.sec.gov",
    date,
    disclosureDelay: 2,
    size: 0.2,
    strength: 0.7,
    isContradiction: type === "sale",
    aiExplanation: "",
    metadata: {
      transactionType: type,
    },
  };
}

function politicalSummary(direction: "purchase" | "sale", filingDate: string): PoliticalTradeSummary {
  const trade = {
    id: `${direction}-${filingDate}`,
    ticker: "TEST",
    assetName: "Test Co",
    filerName: "Public filer",
    office: "House",
    chamber: "House",
    party: null,
    state: null,
    transactionType: direction,
    direction,
    amountRange: "$1,001 - $15,000",
    amountLow: 1001,
    amountHigh: 15000,
    estimatedAmount: 8000,
    transactionDate: filingDate,
    filingDate,
    daysToFile: 12,
    isLate: false,
    sourceUrl: "https://example.com",
  };

  return {
    ticker: "TEST",
    trades: [trade],
    purchases: direction === "purchase" ? [trade] : [],
    sales: direction === "sale" ? [trade] : [],
    totalEstimatedPurchases: direction === "purchase" ? 8000 : 0,
    totalEstimatedSales: direction === "sale" ? 8000 : 0,
    latestFilingDate: filingDate,
    source: "kadoa-open-data",
    sourceUrl: "https://example.com",
    fetchedAt: now.toISOString(),
  };
}

describe("conviction header", () => {
  it("returns monitor for no active positive signals", () => {
    const header = buildConvictionHeader({
      institutionalRows: [],
      insiderEvents: [],
      politicalSummary: null,
      shortInterest: null,
      corporateActivity: null,
      now,
    });

    expect(header.status).toBe("monitor");
    expect(header.confidence).toBe("low");
    expect(header.supportingSignals).toHaveLength(0);
  });

  it("returns institutional when latest 13F rows are accumulating", () => {
    const header = buildConvictionHeader({
      institutionalRows: [institutional("Increased")],
      insiderEvents: [],
      politicalSummary: null,
      shortInterest: null,
      corporateActivity: null,
      now,
    });

    expect(header.status).toBe("institutional");
    expect(header.supportingSignals.map((signal) => signal.kind)).toEqual(["institutional"]);
  });

  it("returns multi for institutional plus recent insider purchase", () => {
    const header = buildConvictionHeader({
      institutionalRows: [institutional("New")],
      insiderEvents: [insider("purchase", "2026-06-20")],
      politicalSummary: null,
      shortInterest: null,
      corporateActivity: null,
      now,
    });

    expect(header.status).toBe("multi");
    expect(header.headline).toBe("Multi-signal conviction");
  });

  it("returns broad for institutional, insider, and political alignment", () => {
    const header = buildConvictionHeader({
      institutionalRows: [institutional("Increased")],
      insiderEvents: [insider("purchase", "2026-06-20")],
      politicalSummary: politicalSummary("purchase", "2026-07-01"),
      shortInterest: null,
      corporateActivity: null,
      now,
    });

    expect(header.status).toBe("broad");
    expect(header.confidence).toBe("high");
    expect(header.supportingSignals).toHaveLength(3);
  });

  it("keeps short pressure and leadership changes as offsets only", () => {
    const header = buildConvictionHeader({
      institutionalRows: [],
      insiderEvents: [],
      politicalSummary: null,
      shortInterest: { changePercent: 16, daysToCover: 1.2 },
      corporateActivity: {
        recentLeadershipCount: 3,
        recentAcquisitionCount: 0,
        latestEventDate: "2026-06-23",
        hasRecentLeadershipCluster: true,
        hasRecentActivity: true,
        copy: "3 leadership-change 8-K filings in the last 90 days.",
      },
      now,
    });

    expect(header.status).toBe("monitor");
    expect(header.offsets.map((signal) => signal.kind)).toEqual(["short-interest", "management"]);
  });

  it("ignores stale insider purchases as active support", () => {
    const header = buildConvictionHeader({
      institutionalRows: [],
      insiderEvents: [insider("purchase", "2026-01-01")],
      politicalSummary: null,
      shortInterest: null,
      corporateActivity: null,
      now,
    });

    expect(header.status).toBe("monitor");
    expect(header.inactiveSignals.some((signal) => signal.kind === "insider")).toBe(true);
  });
});
