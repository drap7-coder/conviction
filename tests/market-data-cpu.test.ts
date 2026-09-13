import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  QUOTE_TTL_MS,
  TRENDING_TTL_MS,
  __resetMarketDataClientForTests,
  fetchMarketHistory,
  fetchMarketQuotes,
  fetchMarketTrending,
  historyClientTtlMs,
} from "@/lib/market/client-market-data";
import { mapPool } from "@/lib/map-pool";
import { __resetRequestCacheForTests } from "@/lib/request-cache";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function emptyHistoryPayload(ticker: string, range: string) {
  return {
    history: {
      ticker,
      range,
      points: [
        { date: "2026-01-01", close: 10 },
        { date: "2026-01-02", close: 11 },
      ],
      startPrice: 10,
      endPrice: 11,
      change: 1,
      changePercent: 10,
      fiftyTwoWeekHigh: 12,
      fiftyTwoWeekLow: 9,
      marketCap: null,
      source: "yahoo-chart",
    },
  };
}

afterEach(() => {
  __resetMarketDataClientForTests();
  __resetRequestCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("market-data CPU architecture", () => {
  it("has no 60s market-data setInterval pollers left", () => {
    const tape = read("src/components/MarketTape.tsx");
    const watchlist = read("src/components/Watchlist.tsx");
    expect(tape).not.toMatch(/setInterval\([^)]*60_000/);
    expect(watchlist).not.toMatch(/setInterval\([^)]*60_000/);
    expect(tape).toContain("subscribeMarketData");
    expect(watchlist).toContain("subscribeMarketData");
  });

  it("routes browser quote loads through fetchMarketQuotes (shared cache with tape)", () => {
    expect(read("src/app/components/CompanyQuoteCard.tsx")).toContain("fetchMarketQuotes");
    expect(read("src/app/components/CompanyEvidenceCard.tsx")).toContain("fetchMarketQuotes");
    expect(read("src/app/components/MaterialNewsCard.tsx")).toContain("fetchMarketQuotes");
    expect(read("src/components/Portfolio.tsx")).toContain("fetchMarketQuotes");
    expect(read("src/app/components/CompanyQuoteCard.tsx")).not.toContain('/api/market/quotes?tickers=');
  });

  it("keeps quote and trending browser refresh at ~5 min", () => {
    expect(QUOTE_TTL_MS).toBe(5 * 60_000);
    expect(TRENDING_TTL_MS).toBe(5 * 60_000);
    expect(read("src/lib/request-cache.ts")).toContain('"/api/market/quotes": 5 * 60 * 1000');
    expect(read("src/lib/request-cache.ts")).toContain('"/api/market/trending": 5 * 60 * 1000');
  });

  it("drops force-dynamic on quotes and trending routes and sets CDN cache", () => {
    const quotes = read("src/app/api/market/quotes/route.ts");
    const trending = read("src/app/api/market/trending/route.ts");
    expect(quotes).not.toContain('dynamic = "force-dynamic"');
    expect(trending).not.toContain('dynamic = "force-dynamic"');
    expect(quotes).toContain("unstable_cache");
    expect(trending).toContain("unstable_cache");
    expect(trending).toContain("easternSessionCacheKey");
    expect(quotes).toContain("s-maxage=300");
    expect(trending).toContain("s-maxage=300");
  });

  it("history route is not force-dynamic and sets range CDN + server cache", () => {
    const history = read("src/app/api/market/history/route.ts");
    expect(history).not.toContain('dynamic = "force-dynamic"');
    expect(history).toContain("unstable_cache");
    expect(history).toContain("s-maxage=60");
    expect(history).toContain("stale-while-revalidate");
    expect(history).toContain("s-maxage=1800");
    expect(history).toContain("s-maxage=3600");
  });

  it("uses shorter browser TTL for intraday history than multi-month", () => {
    expect(historyClientTtlMs("1d")).toBe(60_000);
    expect(historyClientTtlMs("1w")).toBe(5 * 60_000);
    expect(historyClientTtlMs("1y")).toBe(60 * 60_000);
  });

  it("refreshes Pulse Movers through the shared market-data subscriber", () => {
    const panel = read("src/components/market/MarketMovesPanel.tsx");
    expect(panel).toContain("subscribeMarketData");
    expect(panel).toContain("fetchMarketTrending");
  });

  it("dedupes in-flight quote requests through cachedFetch", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
        return {
          ok: true,
          json: async () => ({
            quotes: [{ ticker: "SPY", price: 1, changePercent: 0 }],
          }),
        };
      }),
    );

    const [a, b] = await Promise.all([
      fetchMarketQuotes(["SPY", "QQQ"], { reason: "initial" }),
      fetchMarketQuotes(["qqq", "spy"], { reason: "subscriber" }),
    ]);

    expect(calls).toBe(1);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    await fetchMarketQuotes(["SPY", "QQQ"], { reason: "interval" });
    expect(calls).toBe(1);
  });

  it("dedupes trending through cachedFetch", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({ companies: [{ ticker: "NVDA" }] }),
        };
      }),
    );

    await Promise.all([
      fetchMarketTrending(5, { reason: "initial" }),
      fetchMarketTrending(5, { reason: "subscriber" }),
    ]);
    expect(calls).toBe(1);
    await fetchMarketTrending(5, { reason: "interval" });
    expect(calls).toBe(1);
  });

  it("dedupes identical concurrent history requests through fetchMarketHistory", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
        return {
          ok: true,
          json: async () => emptyHistoryPayload("AAPL", "1y"),
        };
      }),
    );

    const [a, b, c] = await Promise.all([
      fetchMarketHistory("AAPL", "1y", { reason: "initial" }),
      fetchMarketHistory("aapl", "1y", { reason: "initial" }),
      fetchMarketHistory("AAPL", "1y", { reason: "manual" }),
    ]);

    expect(calls).toBe(1);
    expect(a.points).toHaveLength(2);
    expect(b.endPrice).toBe(11);
    expect(c.ticker).toBe("AAPL");

    await fetchMarketHistory("AAPL", "1y", { reason: "interval" });
    expect(calls).toBe(1);
  });

  it("keeps shared history fetch alive when one waiter aborts", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
        return {
          ok: true,
          json: async () => emptyHistoryPayload("MSFT", "1m"),
        };
      }),
    );

    const controller = new AbortController();
    const aborted = fetchMarketHistory("MSFT", "1m", {
      reason: "initial",
      signal: controller.signal,
    });
    const kept = fetchMarketHistory("MSFT", "1m", { reason: "initial" });
    controller.abort();

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    await expect(kept).resolves.toMatchObject({ ticker: "MSFT", endPrice: 11 });
    expect(calls).toBe(1);
  });

  it("does not create per-component duplicate history calls on MarketPanel pages", () => {
    const panel = read("src/app/components/MarketPanel.tsx");
    const trend = read("src/app/components/PriceTrendCard.tsx");
    const quoteCard = read("src/app/components/CompanyQuoteCard.tsx");
    const companyPage = read("src/app/companies/[ticker]/page.tsx");
    const industries = read("src/app/industries/[ticker]/page.tsx");

    expect(panel).toContain("fetchMarketHistory");
    expect(panel).toContain("history={history}");
    expect(panel).toContain("<TechnicalStateCard");
    expect(trend).toContain("if (externalHistory !== undefined) return");
    expect(trend).toContain("fetchMarketHistory");
    expect(trend).not.toContain("fetchJsonWithTimeout");
    expect(quoteCard).toContain("<PriceTrendCard");
    expect(quoteCard).not.toContain("MarketPanel");
    expect(companyPage).toContain("CompanyQuoteCard");
    expect(companyPage).not.toContain("MarketPanel");
    expect(industries).toContain("<MarketPanel");
  });

  it("caps portfolio history fan-out with mapPool", () => {
    const chart = read("src/components/PortfolioBenchmarkChart.tsx");
    expect(chart).toContain("mapPool");
    expect(chart).toContain("HISTORY_FETCH_CONCURRENCY");
    expect(chart).toContain("fetchMarketHistory");
    expect(chart).not.toContain("Promise.all(allTickers");
  });

  it("mapPool preserves order and concurrency limit", async () => {
    let live = 0;
    let peak = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 15));
      live -= 1;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("documents no production route-sweep in CI and keeps daily sync", () => {
    const ci = read(".github/workflows/ci.yml");
    const agents = read("AGENTS.md");
    const cron = read("src/app/api/cron/daily-sync/route.ts");
    expect(ci).not.toMatch(/playwright|puppeteer|crawl/i);
    expect(ci).toContain("npm run typecheck");
    expect(ci).toContain("npm test");
    expect(ci).toContain("npm run build");
    expect(agents).toContain("Do not** run post-deploy browser sweeps");
    expect(cron).toContain("daily-sync");
  });
});
