/**
 * Simple in-memory request cache with TTL support.
 *
 * Deduplicates concurrent fetches for the same URL.
 * Provides a `forceFresh` option to bypass cache.
 */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number; // ms
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL: Record<string, number> = {
  // Evidence data: institutional 13F filings are quarterly, cache longer
  "/api/evidence/institutional": 60 * 60 * 1000, // 1 hour
  // Insider filings are more frequent
  "/api/evidence/insider": 30 * 60 * 1000, // 30 minutes
  // Earnings estimates change less frequently
  "/api/evidence/earnings": 60 * 60 * 1000, // 1 hour
  // Political trades are batched
  "/api/evidence/political": 60 * 60 * 1000, // 1 hour
  // Market quotes are fast-changing
  "/api/market/quotes": 60 * 1000, // 1 minute
  // News is fast-changing
  "/api/evidence/news-batch": 5 * 60 * 1000, // 5 minutes
  // Short interest is bi-monthly
  "/api/market/short-interest": 24 * 60 * 60 * 1000, // 24 hours
  // Ownership filings are infrequent
  "/api/evidence/ownership": 60 * 60 * 1000, // 1 hour
  // Corporate disclosures
  "/api/evidence/disclosures": 60 * 60 * 1000, // 1 hour
  // Move evidence
  "/api/evidence/move": 5 * 60 * 1000, // 5 minutes
};

function getDefaultTtl(url: string): number {
  for (const [prefix, ttl] of Object.entries(DEFAULT_TTL)) {
    if (url.startsWith(prefix)) return ttl;
  }
  return 5 * 60 * 1000; // default 5 minutes
}

/**
 * Fetch with in-memory caching and request deduplication.
 *
 * - Deduplicates concurrent requests for the same URL.
 * - Returns cached data if within TTL.
 * - Supports `forceFresh` to bypass cache.
 * - Supports `abortSignal` for cancellation.
 */
export async function cachedFetch<T>(
  url: string,
  options: {
    ttl?: number;
    forceFresh?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const ttl = options.ttl ?? getDefaultTtl(url);
  const cacheKey = url;

  // Check cache
  if (!options.forceFresh) {
    const entry = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.fetchedAt < entry.ttl) {
      return entry.data;
    }
  }

  // Deduplicate inflight
  const inflightKey = cacheKey;
  const existing = inflight.get(inflightKey);
  if (existing && !options.forceFresh) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    const response = await fetch(url, { signal: options.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as T;

    // Store in cache (even if stale, we have a fallback)
    cache.set(cacheKey, { data, fetchedAt: Date.now(), ttl });

    return data;
  })();

  inflight.set(inflightKey, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    inflight.delete(inflightKey);
  }
}

/**
 * Invalidate a specific cache entry (or entries matching a prefix).
 */
export function invalidateCache(urlOrPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlOrPrefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate all cache entries older than the given TTL.
 */
export function pruneCache(maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.fetchedAt > maxAge) {
      cache.delete(key);
    }
  }
}

/**
 * Force-fresh a specific URL: invalidate cache and remove any inflight request.
 */
export function expireCacheEntry(url: string) {
  cache.delete(url);
  inflight.delete(url);
}