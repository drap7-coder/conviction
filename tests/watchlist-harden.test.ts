import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeWatchlistInput,
  sanitizeWatchlistSymbol,
  isWatchlistSymbolFormat,
} from "@/lib/watchlist/sanitize-ticker";
import {
  createMutationQueue,
  flushBrowserWatchlistWrite,
  scheduleBrowserWatchlistWrite,
  writeBrowserWatchlistNow,
} from "@/lib/watchlist/sync-guard";
import type { WatchlistEntry } from "@/lib/watchlist/types";

describe("sanitizeWatchlistInput", () => {
  it("trims, uppercases, and strips junk from ticker-shaped input", () => {
    expect(sanitizeWatchlistInput("  nvda!!  ")).toBe("NVDA");
    expect(sanitizeWatchlistInput("brk.b")).toBe("BRK.B");
    expect(sanitizeWatchlistInput("btc-usd")).toBe("BTC-USD");
  });

  it("preserves company-name queries with spaces", () => {
    expect(sanitizeWatchlistInput("  apple inc. ")).toBe("APPLE INC.");
    expect(sanitizeWatchlistInput("johnson & johnson")).toBe("JOHNSON & JOHNSON");
  });

  it("rejects empty / punctuation-only strings", () => {
    expect(sanitizeWatchlistInput("   ")).toBe("");
    expect(sanitizeWatchlistInput("!!!")).toBe("");
  });
});

describe("isWatchlistSymbolFormat / sanitizeWatchlistSymbol", () => {
  it("accepts equity, share-class, and crypto pairs", () => {
    expect(isWatchlistSymbolFormat("AAPL")).toBe(true);
    expect(isWatchlistSymbolFormat("BRK.B")).toBe(true);
    expect(isWatchlistSymbolFormat("BRK-B")).toBe(true);
    expect(isWatchlistSymbolFormat("ETH-USD")).toBe(true);
    expect(sanitizeWatchlistSymbol(" eth-usd ")).toBe("ETH-USD");
  });

  it("rejects company names and malformed symbols", () => {
    expect(isWatchlistSymbolFormat("APPLE INC")).toBe(false);
    expect(sanitizeWatchlistSymbol("not a ticker!!!")).toBe(null);
    expect(sanitizeWatchlistSymbol("TOOLONG")).toBe(null);
  });
});

describe("sync-guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    flushBrowserWatchlistWrite();
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    flushBrowserWatchlistWrite();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces guest localStorage writes", () => {
    const a: WatchlistEntry[] = [
      { ticker: "A", companyName: "A", addedAt: "2026-01-01", status: "active" },
    ];
    const b: WatchlistEntry[] = [
      ...a,
      { ticker: "B", companyName: "B", addedAt: "2026-01-01", status: "active" },
    ];

    scheduleBrowserWatchlistWrite(a, 280);
    scheduleBrowserWatchlistWrite(b, 280);
    expect(localStorage.getItem("conviction-watchlist")).toBeNull();

    vi.advanceTimersByTime(280);
    expect(JSON.parse(localStorage.getItem("conviction-watchlist")!)).toEqual(b);
  });

  it("serializes mutation queue tasks", async () => {
    const order: number[] = [];
    const enqueue = createMutationQueue();

    const first = enqueue(async () => {
      order.push(1);
      await Promise.resolve();
      order.push(2);
    });
    const second = enqueue(async () => {
      order.push(3);
    });

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("writeBrowserWatchlistNow persists immediately", () => {
    writeBrowserWatchlistNow([
      { ticker: "X", companyName: "X", addedAt: "2026-01-01", status: "active" },
    ]);
    const stored = JSON.parse(localStorage.getItem("conviction-watchlist")!) as Array<{ ticker: string }>;
    expect(stored[0].ticker).toBe("X");
  });
});
