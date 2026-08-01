/**
 * Client helper for the shared Conviction Score API.
 * Every list/dashboard surface should use this — no local score heuristics.
 *
 * List pages fetch per-ticker with limited concurrency so scores paint as
 * they arrive (batch endpoints can exceed client timeouts once quality is included).
 */

import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";

const SINGLE_TIMEOUT_MS = 45_000;
const LIST_CONCURRENCY = 4;

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

export type ConvictionScoresProgress = (
  scores: Record<string, ConvictionScoreView>,
) => void;

/**
 * Load shared Conviction Scores for many tickers.
 * Calls `onProgress` as each ticker completes so Watchlist rings fill in.
 */
export async function fetchConvictionScores(
  tickers: string[],
  signal?: AbortSignal,
  onProgress?: ConvictionScoresProgress,
): Promise<Record<string, ConvictionScoreView>> {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  const scores: Record<string, ConvictionScoreView> = {};
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      if (signal?.aborted) return;
      const index = cursor++;
      const ticker = unique[index];
      const score = await fetchConvictionScore(ticker, signal);
      if (signal?.aborted) return;
      if (score) {
        scores[ticker] = score;
        onProgress?.({ ...scores });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(LIST_CONCURRENCY, unique.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return scores;
}
