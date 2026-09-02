import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spotFromQuote } from "@/lib/community-picks/pricing";
import type { StockQuote } from "@/lib/market/quotes";
import { CROWD_SEED_BOOKS } from "@/lib/crowd/seed-books";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function quote(overrides: Partial<StockQuote> = {}): StockQuote {
  return {
    ticker: "AAPL",
    name: "Apple",
    exchange: "NASDAQ",
    price: 190,
    previousClose: 188,
    change: 2,
    changePercent: 1,
    volume: null,
    dollarVolume: null,
    currency: "USD",
    marketState: "REGULAR",
    marketCap: null,
    dayHigh: null,
    dayLow: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    source: "yahoo-chart",
    asOf: new Date().toISOString(),
    sparkline: [],
    ...overrides,
  };
}

describe("Vercel high-risk path fixes", () => {
  it("keeps GET /api/watchlist free of conviction-score warming", () => {
    const route = read("src/app/api/watchlist/route.ts");
    expect(route).not.toContain("after(");
    expect(route).not.toContain("warmScores");
    expect(route).not.toContain("getConvictionScoresForTickers");
    expect(route).not.toContain("getConvictionScoreForTicker");
    expect(route).not.toContain("@/lib/conviction/score");
  });

  it("uses a fresh no-store quote path for pick execution pricing", () => {
    const pricing = read("src/lib/community-picks/pricing.ts");
    const quotes = read("src/lib/market/quotes.ts");
    expect(pricing).toContain("fetchFreshStockQuotes");
    expect(pricing).not.toContain("fetchStockQuotes(");
    expect(quotes).toContain('cache: "no-store"');
    expect(quotes).toContain("fetchFreshStockQuotes");
    expect(quotes).toContain('next: { revalidate: 300 }');
  });

  it("rejects stale regular-session execution quotes", () => {
    const stale = quote({
      marketState: "REGULAR",
      asOf: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    expect(spotFromQuote(stale, "AAPL").ok).toBe(false);

    const fresh = quote({
      marketState: "REGULAR",
      asOf: new Date().toISOString(),
    });
    expect(spotFromQuote(fresh, "AAPL")).toMatchObject({ ok: true, spot: 190 });
  });

  it("adds public caching to market news and history routes", () => {
    const news = read("src/app/api/market/news/route.ts");
    const history = read("src/app/api/market/history/route.ts");
    expect(news).toContain("s-maxage=300");
    expect(news).not.toContain('dynamic = "force-dynamic"');
    expect(history).toContain("s-maxage=60");
    expect(history).toContain("s-maxage=1800");
    expect(history).not.toContain('dynamic = "force-dynamic"');
  });

  it("skips Crowd demo rewrite when seed books already exist", () => {
    const seeds = read("src/lib/crowd/ensure-seeds.ts");
    const load = read("src/lib/crowd/load.ts");
    expect(seeds).toContain("ensureCrowdSeedBooksIfNeeded");
    expect(seeds).toContain("skipped: true");
    expect(load).toContain("ensureCrowdSeedBooksIfNeeded");
    expect(load).not.toMatch(/await ensureCrowdSeedBooks\(\)/);
    expect(CROWD_SEED_BOOKS).toHaveLength(10);
  });

  it("company pages still consume conviction score on demand", () => {
    expect(read("src/app/companies/[ticker]/page.tsx")).toContain("CompanyDecisionBrief");
    expect(read("src/app/companies/[ticker]/page.tsx")).toContain("ConvictionSignalsCard");
    expect(read("src/app/components/CompanyDecisionBrief.tsx")).toContain("/api/conviction/score");
    expect(read("src/app/components/ConvictionSignalsCard.tsx")).toContain("/api/conviction/score");
  });

  it("loads Today's read only after the reader expands the disclosure", () => {
    const brief = read("src/app/components/CompanyDecisionBrief.tsx");
    expect(brief).toContain("<details");
    expect(brief).toContain('id="todays-read"');
    expect(brief).toContain("company-decision-disclosure");
    expect(brief).toContain("if (!expanded || loadedTicker === ticker) return");
    expect(brief).toContain("/api/conviction/score");
    // Must not auto-fetch on mount — only when expanded.
    expect(brief).not.toMatch(/useEffect\(\(\) => \{[\s\S]*void load\(\);[\s\S]*\}, \[ticker\]\)/);
  });
});
