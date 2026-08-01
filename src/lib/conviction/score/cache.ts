/**
 * Short-lived in-memory cache for Conviction Score views.
 * Keeps Watchlist/Trending rings from re-running the full SEC + quality
 * pipeline on every navigation within the same server instance.
 */

import type { ConvictionScoreView } from "./view";

const TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  view: ConvictionScoreView;
};

const cache = new Map<string, CacheEntry>();

export function getCachedConvictionScore(
  ticker: string,
): ConvictionScoreView | null {
  const key = ticker.trim().toUpperCase();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.view;
}

export function setCachedConvictionScore(view: ConvictionScoreView): void {
  const key = view.ticker.trim().toUpperCase();
  if (!key) return;
  cache.set(key, {
    expiresAt: Date.now() + TTL_MS,
    view,
  });
}

export function warmConvictionScoreCache(
  views: Iterable<ConvictionScoreView>,
): void {
  for (const view of views) {
    setCachedConvictionScore(view);
  }
}
