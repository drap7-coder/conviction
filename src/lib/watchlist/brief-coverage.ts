import type { EvidenceEvent } from "@/lib/evidence/types";
import { selectBriefStories, type BriefName, type BriefStory } from "./daily-brief";

export const BRIEF_BATCH_SIZE = 6;
export const BRIEF_CACHE_MS = 15 * 60_000;
export type BriefNews = { status: string; events: EvidenceEvent[] };
export type BriefCoverage = {
  stories: BriefStory[];
  checked: string[];
  failed: string[];
  fetchedAt: number | null;
};

/** Browser-only instance; public news cache contains no holdings or identity. */
export function createBriefLoader(
  request: (ticker: string, signal: AbortSignal) => Promise<BriefNews>,
  now = Date.now,
) {
  const cache = new Map<string, { at: number; value: BriefNews }>();
  return {
    invalidate(tickers: string[]) {
      for (const ticker of tickers) cache.delete(ticker);
    },
    async load(names: BriefName[], signal: AbortSignal): Promise<BriefCoverage> {
      let cursor = 0;
      const stories: BriefStory[] = [];
      const checked: string[] = [];
      const failed: string[] = [];
      const times: number[] = [];
      async function worker() {
        while (cursor < names.length && !signal.aborted) {
          const name = names[cursor++];
          try {
            let cached = cache.get(name.ticker);
            if (!cached || now() - cached.at >= BRIEF_CACHE_MS) {
              const value = await request(name.ticker, signal);
              if (signal.aborted) return;
              if (!["success", "empty"].includes(value.status) || !Array.isArray(value.events)) throw new Error("Unavailable");
              cached = { at: now(), value };
              cache.set(name.ticker, cached);
              if (cache.size > 200) cache.delete(cache.keys().next().value!);
            }
            checked.push(name.ticker);
            times.push(cached.at);
            const story = selectBriefStories(cached.value.events.map((event) => ({ ...name, event })), now())[0];
            if (story) stories.push(story);
          } catch {
            if (!signal.aborted) failed.push(name.ticker);
          }
        }
      }
      await Promise.all([worker(), worker()]);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return { stories: selectBriefStories(stories, now()), checked, failed, fetchedAt: times.length ? Math.min(...times) : null };
    },
  };
}
