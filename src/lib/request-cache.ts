/**
 * In-memory GET cache with TTL + in-flight dedupe.
 *
 * Concurrent callers for the same URL share one network request. A caller's
 * AbortSignal only rejects that waiter — it does not cancel the shared fetch
 * (so sibling components keep the result).
 */

export type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
  ttl: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Default TTLs by URL prefix (ms). History ranges override in fetchMarketHistory. */
const DEFAULT_TTL: Record<string, number> = {
  "/api/market/quotes": 5 * 60 * 1000,
  "/api/market/trending": 5 * 60 * 1000,
  "/api/market/history": 30 * 60 * 1000,
  "/api/evidence/news": 15 * 60 * 1000,
};

function defaultTtl(url: string): number {
  for (const [prefix, ttl] of Object.entries(DEFAULT_TTL)) {
    if (url.startsWith(prefix) || url.includes(prefix)) return ttl;
  }
  return 5 * 60 * 1000;
}

function awaitWithOptionalAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Fetch JSON with in-memory caching and request deduplication.
 */
export async function cachedFetch<T>(
  url: string,
  options: {
    ttl?: number;
    forceFresh?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const ttl = options.ttl ?? defaultTtl(url);
  const cacheKey = url;

  if (!options.forceFresh) {
    const entry = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.fetchedAt < entry.ttl) {
      return entry.data;
    }
  }

  if (!options.forceFresh) {
    const existing = inflight.get(cacheKey);
    if (existing) {
      return awaitWithOptionalAbort(existing as Promise<T>, options.signal);
    }
  }

  const shared = (async () => {
    // Intentionally omit caller AbortSignal so unmounting one consumer does not
    // cancel work other mounted components are waiting on.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as T;
    cache.set(cacheKey, { data, fetchedAt: Date.now(), ttl });
    return data;
  })().finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, shared);

  return awaitWithOptionalAbort(shared, options.signal);
}

export function invalidateCache(urlOrPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlOrPrefix) || key.includes(urlOrPrefix)) {
      cache.delete(key);
    }
  }
}

export function pruneCache(maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.fetchedAt > maxAge) cache.delete(key);
  }
}

export function expireCacheEntry(url: string) {
  cache.delete(url);
  inflight.delete(url);
}

/** Test helper — clears memory cache + inflight map. */
export function __resetRequestCacheForTests() {
  cache.clear();
  inflight.clear();
}
