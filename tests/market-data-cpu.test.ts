import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  QUOTE_TTL_MS,
  TRENDING_TTL_MS,
  __resetMarketDataClientForTests,
  fetchMarketQuotes,
  fetchMarketTrending,
} from "@/lib/market/client-market-data";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

afterEach(() => {
  __resetMarketDataClientForTests();
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

  it("keeps quote refresh at ~5 min and trending at ~12 min", () => {
    expect(QUOTE_TTL_MS).toBe(5 * 60_000);
    expect(TRENDING_TTL_MS).toBe(12 * 60_000);
    expect(read("src/lib/request-cache.ts")).toContain('"/api/market/quotes": 5 * 60 * 1000');
    expect(read("src/lib/request-cache.ts")).toContain('"/api/market/trending": 12 * 60 * 1000');
  });

  it("drops force-dynamic on quotes and trending routes and sets CDN cache", () => {
    const quotes = read("src/app/api/market/quotes/route.ts");
    const trending = read("src/app/api/market/trending/route.ts");
    expect(quotes).not.toContain('dynamic = "force-dynamic"');
    expect(trending).not.toContain('dynamic = "force-dynamic"');
    expect(quotes).toContain("unstable_cache");
    expect(trending).toContain("unstable_cache");
    expect(quotes).toContain("s-maxage=300");
    expect(trending).toContain("s-maxage=720");
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
});
