/**
 * Shared market-data coordinator for the browser.
 *
 * Caching + in-flight dedupe live in `cachedFetch`. This module only:
 * - owns one quote timer + one trending timer for all UI subscribers
 * - sleeps while document.hidden
 * - refreshes when the tab becomes visible again
 */

import { cachedFetch, expireCacheEntry, invalidateCache } from "@/lib/request-cache";
import type { StockQuote } from "@/lib/market/quotes";

export type MarketFetchReason =
  | "initial"
  | "interval"
  | "visibility"
  | "manual"
  | "subscriber";

/** Quotes: ~5 min while visible. Trending: ~12 min while visible. */
export const QUOTE_TTL_MS = 5 * 60_000;
export const TRENDING_TTL_MS = 12 * 60_000;

type TrendingPayload = {
  companies: Array<{ ticker: string; quote?: StockQuote; companyName?: string }>;
};

type Subscriber = {
  id: number;
  onQuotes?: (quotes: StockQuote[]) => void;
  onTrending?: (payload: TrendingPayload) => void;
  quoteTickers?: string[];
  trendingLimit?: number;
};

let nextSubscriberId = 1;
const subscribers = new Map<number, Subscriber>();
let quoteTimer: number | undefined;
let trendingTimer: number | undefined;
let visibilityBound = false;

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function logFetch(kind: "quotes" | "trending", reason: MarketFetchReason, detail: string) {
  if (!isDev()) return;
  console.info(`[market-data] ${kind} reason=${reason} ${detail}`);
}

function normalizeTickers(tickers: string[]): string[] {
  return Array.from(
    new Set(
      tickers
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();
}

function quotesUrl(tickers: string[]): string {
  return `/api/market/quotes?tickers=${encodeURIComponent(normalizeTickers(tickers).join(","))}`;
}

function trendingUrl(limit: number): string {
  const safe = Math.max(3, Math.min(24, Math.floor(limit)));
  return `/api/market/trending?limit=${safe}`;
}

function tabVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export async function fetchMarketQuotes(
  tickers: string[],
  options: { force?: boolean; reason?: MarketFetchReason; signal?: AbortSignal } = {},
): Promise<StockQuote[]> {
  const normalized = normalizeTickers(tickers);
  if (normalized.length === 0) return [];
  const url = quotesUrl(normalized);
  const reason = options.reason ?? "manual";
  if (options.force) expireCacheEntry(url);
  logFetch("quotes", reason, url);
  const data = await cachedFetch<{ quotes?: StockQuote[] }>(url, {
    ttl: QUOTE_TTL_MS,
    forceFresh: options.force,
    signal: options.signal,
  });
  return data.quotes ?? [];
}

export async function fetchMarketTrending(
  limit: number,
  options: { force?: boolean; reason?: MarketFetchReason; signal?: AbortSignal } = {},
): Promise<TrendingPayload> {
  const url = trendingUrl(limit);
  const reason = options.reason ?? "manual";
  if (options.force) expireCacheEntry(url);
  logFetch("trending", reason, url);
  const data = await cachedFetch<{ companies?: TrendingPayload["companies"] }>(url, {
    ttl: TRENDING_TTL_MS,
    forceFresh: options.force,
    signal: options.signal,
  });
  return { companies: data.companies ?? [] };
}

function unionQuoteTickers(): string[] {
  const all: string[] = [];
  for (const sub of subscribers.values()) {
    if (sub.quoteTickers?.length) all.push(...sub.quoteTickers);
  }
  return normalizeTickers(all);
}

function maxTrendingLimit(): number | null {
  let max: number | null = null;
  for (const sub of subscribers.values()) {
    if (typeof sub.trendingLimit === "number") {
      max = max === null ? sub.trendingLimit : Math.max(max, sub.trendingLimit);
    }
  }
  return max;
}

async function refreshQuotes(reason: MarketFetchReason, force = false) {
  if (!tabVisible() && reason === "interval") return;
  const tickers = unionQuoteTickers();
  if (tickers.length === 0) return;
  try {
    const quotes = await fetchMarketQuotes(tickers, { force, reason });
    for (const sub of subscribers.values()) {
      if (!sub.onQuotes || !sub.quoteTickers?.length) continue;
      const wanted = new Set(normalizeTickers(sub.quoteTickers));
      sub.onQuotes(quotes.filter((quote) => wanted.has(quote.ticker.toUpperCase())));
    }
  } catch {
    // Keep last good data in the UI.
  }
}

async function refreshTrending(reason: MarketFetchReason, force = false) {
  if (!tabVisible() && reason === "interval") return;
  const limit = maxTrendingLimit();
  if (limit === null) return;
  try {
    const payload = await fetchMarketTrending(limit, { force, reason });
    for (const sub of subscribers.values()) {
      sub.onTrending?.(payload);
    }
  } catch {
    // Keep last good data in the UI.
  }
}

function clearTimers() {
  if (quoteTimer !== undefined) {
    window.clearInterval(quoteTimer);
    quoteTimer = undefined;
  }
  if (trendingTimer !== undefined) {
    window.clearInterval(trendingTimer);
    trendingTimer = undefined;
  }
}

function armTimers() {
  clearTimers();
  if (subscribers.size === 0 || !tabVisible()) return;

  if (unionQuoteTickers().length > 0) {
    quoteTimer = window.setInterval(() => {
      void refreshQuotes("interval");
    }, QUOTE_TTL_MS);
  }
  if (maxTrendingLimit() !== null) {
    trendingTimer = window.setInterval(() => {
      void refreshTrending("interval");
    }, TRENDING_TTL_MS);
  }
}

function ensureVisibilityListener() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshQuotes("visibility");
      void refreshTrending("visibility");
      armTimers();
    } else {
      clearTimers();
    }
  });
}

export type MarketDataSubscription = {
  unsubscribe: () => void;
  refresh: () => void;
};

/** One global timer set serves every subscriber. */
export function subscribeMarketData(options: {
  quoteTickers?: string[];
  trendingLimit?: number;
  onQuotes?: (quotes: StockQuote[]) => void;
  onTrending?: (payload: TrendingPayload) => void;
}): MarketDataSubscription {
  const id = nextSubscriberId++;
  subscribers.set(id, { id, ...options });
  ensureVisibilityListener();
  armTimers();

  void refreshQuotes("subscriber");
  void refreshTrending("subscriber");

  return {
    unsubscribe: () => {
      subscribers.delete(id);
      if (subscribers.size === 0) clearTimers();
      else armTimers();
    },
    refresh: () => {
      void refreshQuotes("manual", true);
      void refreshTrending("manual", true);
    },
  };
}

/** Test helper. */
export function __resetMarketDataClientForTests() {
  subscribers.clear();
  clearTimers();
  invalidateCache("/api/market");
}
