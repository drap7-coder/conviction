/**
 * Caps for unauthenticated single-ticker evidence refresh.
 *
 * - Per-ticker cooldown uses the last successful fetch timestamp in persist
 * - Per-IP burst window is process-local (best-effort on serverless)
 *
 * Cron Bearer requests skip these caps.
 */

import { SYNC_CONFIG } from "@/lib/sync/sync-config";

type Bucket = { count: number; resetAt: number };

const ipBuckets = new Map<string, Bucket>();

/** Prune stale IP buckets occasionally so the Map cannot grow without bound. */
function pruneIpBuckets(now: number) {
  if (ipBuckets.size < 500) return;
  for (const [key, bucket] of ipBuckets) {
    if (bucket.resetAt <= now) ipBuckets.delete(key);
  }
}

export function clientIpFromRequest(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function checkSingleTickerIpLimit(
  ip: string,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  pruneIpBuckets(now);
  const windowMs = SYNC_CONFIG.SINGLE_TICKER_IP_WINDOW_MS;
  const max = SYNC_CONFIG.SINGLE_TICKER_IP_MAX;
  const existing = ipBuckets.get(ip);

  if (!existing || existing.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

/** Test helper — clears in-memory IP buckets. */
export function resetSingleTickerIpLimitForTests() {
  ipBuckets.clear();
}

export function checkSingleTickerCooldown(
  lastFetchIso: string | null,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  if (!lastFetchIso) return { ok: true };
  const lastMs = Date.parse(lastFetchIso);
  if (Number.isNaN(lastMs)) return { ok: true };

  const cooldownMs = SYNC_CONFIG.SINGLE_TICKER_COOLDOWN_SECONDS * 1000;
  const elapsed = now - lastMs;
  if (elapsed >= cooldownMs) return { ok: true };

  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000)),
  };
}
