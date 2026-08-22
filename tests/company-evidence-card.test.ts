import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCompanyEvidenceItem,
  companyEvidenceSignal,
  newsSummaryFromEvents,
} from "@/lib/company/company-evidence-brief";
import type { StockQuote } from "@/lib/market/types";
import type { WatchlistNewsSummary, WatchlistTransition } from "@/components/WatchlistDailyBrief";

const now = new Date("2026-08-11T02:00:00.000Z");

function quote(ticker: string, changePercent: number): StockQuote {
  return {
    ticker,
    price: 100,
    change: changePercent,
    changePercent,
    volume: 1_000,
    dollarVolume: 100_000,
    currency: "USD",
    marketState: "REGULAR",
    marketCap: 1_000_000,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    sparkline: [],
  };
}

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("company evidence brief", () => {
  it("maps a fresh news driver into dashboard SignalBlock fields", () => {
    const news: WatchlistNewsSummary = {
      headline: "Nvidia unveils next Blackwell rack",
      url: "https://example.com/nvda",
      date: "2026-08-11T01:00:00.000Z",
      publisher: "Reuters",
      driver: {
        label: "AI positioning",
        explanation: "Customer demand and capex remain the core question.",
        confidence: "likely",
      },
      headlines: [
        {
          headline: "Nvidia unveils next Blackwell rack",
          url: "https://example.com/nvda",
          date: "2026-08-11T01:00:00.000Z",
          publisher: "Reuters",
        },
        {
          headline: "Cloud buyers keep raising GPU budgets",
          url: "https://example.com/gpu",
          date: "2026-08-11T00:30:00.000Z",
          publisher: "Bloomberg",
        },
      ],
    };

    const item = buildCompanyEvidenceItem({
      ticker: "NVDA",
      companyName: "NVIDIA Corporation",
      quote: quote("NVDA", 0.8),
      news,
      transitions: [],
      now,
    });
    expect(item).toMatchObject({ kind: "Fresh evidence", headline: "Nvidia unveils next Blackwell rack" });

    const signal = companyEvidenceSignal(item!, news);
    expect(signal).toMatchObject({
      eyebrow: "Fresh evidence",
      conclusion: "Nvidia unveils next Blackwell rack",
      conclusionHref: "https://example.com/nvda",
      evidence: "Customer demand and capex remain the core question.",
      whyItMatters: "Customer demand and capital spending",
      source: "Reuters",
      dateLabel: "Aug 11",
    });
    expect(signal.badge).toEqual({ label: "Evidence-backed", tone: "quiet" });
    expect(signal.extraHeadlines.map((headline) => headline.headline)).toEqual([
      "Cloud buyers keep raising GPU budgets",
    ]);
    expect(signal.conclusion).not.toMatch(/Open company brief/i);
    expect(JSON.stringify(signal)).not.toContain("NVDA");
  });

  it("keeps a large unexplained move as price-only proof", () => {
    const item = buildCompanyEvidenceItem({
      ticker: "MOVE",
      companyName: "Moving Company",
      quote: quote("MOVE", -4.5),
      news: null,
      transitions: [],
      now,
    });
    const signal = companyEvidenceSignal(item!, null);
    expect(signal.eyebrow).toBe("Large move");
    expect(signal.badge).toEqual({ label: "Price only", tone: "amber" });
    expect(signal.evidence).toContain("price alone does not prove");
    expect(signal.conclusionHref).toBeNull();
    expect(signal.extraHeadlines).toEqual([]);
  });

  it("prefers a conviction transition over the news fallback", () => {
    const transitions: WatchlistTransition[] = [{
      id: "nvda-change",
      ticker: "NVDA",
      type: "status_upgrade",
      reason: "Institutional support broadened enough to raise the state.",
      createdAt: "2026-08-11T01:00:00.000Z",
    }];
    const item = buildCompanyEvidenceItem({
      ticker: "NVDA",
      companyName: "NVIDIA Corporation",
      quote: quote("NVDA", 1.2),
      news: newsSummaryFromEvents([], null),
      transitions,
      now,
    });
    const signal = companyEvidenceSignal(item!, newsSummaryFromEvents([], null));
    expect(signal.eyebrow).toBe("Conviction change");
    expect(signal.conclusion).toContain("Institutional support");
    expect(signal.badge).toEqual({ label: "Evidence-backed", tone: "up" });
  });

  it("stays quiet when there is no brief-worthy evidence", () => {
    expect(buildCompanyEvidenceItem({
      ticker: "CALM",
      companyName: "Calm Company",
      quote: quote("CALM", 0.4),
      news: null,
      transitions: [],
      now,
    })).toBeNull();
  });
});

describe("company evidence composition", () => {
  it("puts the evidence brief on the company dashboard and keeps sector news", () => {
    const companyPage = read("src/app/companies/[ticker]/page.tsx");
    const sectorPage = read("src/app/industries/[ticker]/page.tsx");
    const watchlist = read("src/components/Watchlist.tsx");

    expect(companyPage).toContain("CompanyEvidenceCard");
    expect(companyPage).not.toContain("MaterialNewsCard");
    expect(sectorPage).toContain("MaterialNewsCard");
    expect(watchlist).not.toContain("buildWatchlistBriefItems");
    expect(watchlist).not.toContain("ProductStage");
    expect(watchlist).not.toContain("<WatchlistDailyBrief");
    expect(watchlist).not.toContain("Fresh on your watchlist");
    expect(watchlist).not.toContain(">Updates<");
    expect(watchlist).not.toContain(">Higher<");
    expect(watchlist).not.toContain(">Lower<");
    expect(existsSync(new URL("../src/app/components/CompanyEvidenceCard.tsx", import.meta.url))).toBe(true);
    const card = read("src/app/components/CompanyEvidenceCard.tsx");
    expect(card).toContain("Why it matters");
    expect(card).toContain("Watch next");
    expect(card).not.toContain("Open company brief");
    expect(card).toContain("SignalBlock");
  });
});
