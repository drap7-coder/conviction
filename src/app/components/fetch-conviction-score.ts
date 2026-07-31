/**
 * Client helper for the shared Conviction Score API.
 */

import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";

export async function fetchConvictionScore(
  ticker: string,
  signal?: AbortSignal,
): Promise<ConvictionScoreView | null> {
  try {
    return await fetchJsonWithTimeout<ConvictionScoreView>(
      `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
      45_000,
      signal,
    );
  } catch {
    return null;
  }
}

export async function fetchConvictionScores(
  tickers: string[],
  signal?: AbortSignal,
): Promise<Record<string, ConvictionScoreView>> {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  const scores: Record<string, ConvictionScoreView> = {};
  const batches = Array.from(
    { length: Math.ceil(unique.length / 25) },
    (_, index) => unique.slice(index * 25, index * 25 + 25),
  );

  for (const batch of batches) {
    try {
      const data = await fetchJsonWithTimeout<{ scores?: Record<string, ConvictionScoreView> }>(
        `/api/conviction/score?tickers=${encodeURIComponent(batch.join(","))}`,
        55_000,
        signal,
      );
      Object.assign(scores, data.scores ?? {});
    } catch {
      // Leave missing tickers absent — UI falls back to awaiting.
    }
  }

  return scores;
}
