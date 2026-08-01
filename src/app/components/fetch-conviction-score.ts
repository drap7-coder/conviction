/**
 * Client helper for the shared Conviction Score API.
 * Every list/dashboard surface should use this — no local score heuristics.
 *
 * List pages fetch per-ticker with limited concurrency so scores paint as
 * they arrive. Browser sessionStorage keeps last-known scores so remounts
 * and aborted navigations do not flash empty rings.
 */

import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";

const SINGLE_TIMEOUT_MS = 45_000;
const LIST_CONCURRENCY = 6;
const SESSION_CACHE_KEY = "conviction-score-cache-v14";

export async function fetchConvictionScore(
  ticker: string,
  signal?: AbortSignal,
): Promise<ConvictionScoreView | null> {
  try {
    return await fetchJsonWithTimeout<ConvictionScoreView>(
      `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
      SINGLE_TIMEOUT_MS,
      signal,
    );
  } catch {
    return null;
  }
}

export type ConvictionScoreSettled = {
  ticker: string;
  ok: boolean;
};

export type ConvictionScoresProgress = (
  scores: Record<string, ConvictionScoreView>,
  settled?: ConvictionScoreSettled,
) => void;

function readSessionScoreCache(): Record<string, ConvictionScoreView> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ConvictionScoreView>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeSessionScoreCache(scores: Record<string, ConvictionScoreView>) {
  if (typeof window === "undefined") return;
  try {
    const existing = readSessionScoreCache();
    window.sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ ...existing, ...scores }),
    );
  } catch {
    // best-effort
  }
}

/** Immediate last-known scores for the given tickers (may be empty). */
export function peekCachedConvictionScores(
  tickers: string[],
): Record<string, ConvictionScoreView> {
  const cached = readSessionScoreCache();
  const out: Record<string, ConvictionScoreView> = {};
  for (const ticker of tickers) {
    const upper = ticker.trim().toUpperCase();
    if (cached[upper]?.displayScore != null) out[upper] = cached[upper];
  }
  return out;
}

/**
 * Load shared Conviction Scores for many tickers.
 * Calls `onProgress` as each ticker completes so Watchlist rings fill in.
 * `settled` is set on every finished fetch (success or failure) so rings can stop spinning.
 */
export async function fetchConvictionScores(
  tickers: string[],
  signal?: AbortSignal,
  onProgress?: ConvictionScoresProgress,
): Promise<Record<string, ConvictionScoreView>> {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  const scores: Record<string, ConvictionScoreView> = {
    ...peekCachedConvictionScores(unique),
  };
  if (Object.keys(scores).length > 0) {
    onProgress?.({ ...scores });
  }

  const missing = unique.filter((ticker) => scores[ticker]?.displayScore == null);
  if (missing.length === 0) return scores;

  let cursor = 0;

  async function worker() {
    while (cursor < missing.length) {
      if (signal?.aborted) return;
      const index = cursor++;
      const ticker = missing[index]!;
      const score = await fetchConvictionScore(ticker, signal);
      if (signal?.aborted) return;
      if (score) {
        scores[ticker] = score;
        writeSessionScoreCache({ [ticker]: score });
      }
      onProgress?.({ ...scores }, { ticker, ok: Boolean(score) });
    }
  }

  const workers = Array.from(
    { length: Math.min(LIST_CONCURRENCY, missing.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return scores;
}
