/**
 * Client helper for the shared Conviction Score API.
 * Every list/dashboard surface should use this — no local score heuristics.
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
      // Batch failed — fall through to per-ticker backfill below.
    }
  }

  // Backfill any missing tickers individually so a batch timeout cannot leave
  // a name stuck on a different (legacy) score path.
  const missing = unique.filter((ticker) => !scores[ticker]);
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (ticker) => {
        const score = await fetchConvictionScore(ticker, signal);
        if (score) scores[ticker] = score;
      }),
    );
  }

  return scores;
}
