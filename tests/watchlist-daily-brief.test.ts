import { describe, expect, it } from "vitest";
import {
  buildWatchlistBriefItems,
  type WatchlistNewsSummary,
  type WatchlistTransition,
} from "@/components/WatchlistDailyBrief";
import type { StockQuote } from "@/lib/market/types";
import type { WatchlistEntry } from "@/lib/watchlist/types";

const now = new Date("2026-08-11T02:00:00.000Z");

function entry(ticker: string, companyName: string): WatchlistEntry {
  return { ticker, companyName, addedAt: now.toISOString(), status: "active" };
}

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

describe("watchlist daily brief", () => {
  it("prioritizes a fresh conviction transition over a large price move", () => {
    const entries = [entry("AAA", "Alpha Inc"), entry("BBB", "Beta Inc")];
    const transitions: WatchlistTransition[] = [{
      id: "aaa-change",
      ticker: "AAA",
      type: "status_downgrade",
      reason: "Broad support downgraded to watch.",
      createdAt: "2026-08-11T01:00:00.000Z",
    }];

    const items = buildWatchlistBriefItems({
      entries,
      quotes: { AAA: quote("AAA", -1), BBB: quote("BBB", 7) },
      newsByTicker: {},
      transitions,
      now,
    });

    expect(items[0]).toMatchObject({ ticker: "AAA", kind: "Conviction change", tone: "down" });
    expect(items[1]).toMatchObject({ ticker: "BBB", kind: "Large move", tone: "up" });
  });

  it("uses the company-relevant headline instead of a generic market roundup", () => {
    const news: WatchlistNewsSummary = {
      headline: "Markets brace for inflation data",
      url: "https://example.com/market",
      date: "2026-08-11T01:00:00.000Z",
      driver: {
        label: "Manufacturing turnaround",
        explanation: "Manufacturing execution remains pivotal.",
        confidence: "likely",
      },
      headlines: [
        { headline: "Markets brace for inflation data", url: null, date: "2026-08-11T01:00:00.000Z" },
        { headline: "Intel locks in its next chip manufacturing milestone", url: null, date: "2026-08-11T00:30:00.000Z" },
      ],
    };

    const items = buildWatchlistBriefItems({
      entries: [entry("INTC", "Intel Corporation")],
      quotes: { INTC: quote("INTC", -3.2) },
      newsByTicker: { INTC: news },
      transitions: [],
      now,
    });

    expect(items[0]?.headline).toContain("Intel");
    expect(items[0]?.headline).not.toContain("Markets brace");
    expect(items[0]?.watchNext).toContain("Process milestones");
  });

  it("does not manufacture urgency for a quiet company without fresh evidence", () => {
    const items = buildWatchlistBriefItems({
      entries: [entry("CALM", "Calm Company")],
      quotes: { CALM: quote("CALM", 0.4) },
      newsByTicker: {},
      transitions: [],
      now,
    });

    expect(items).toEqual([]);
  });
});
