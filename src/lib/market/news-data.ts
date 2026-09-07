import { unstable_cache } from "next/cache";
import {
  fetchMarketNarrativePulse,
  type MarketNarrativePulse,
} from "@/lib/market/market-narratives";

export interface NewsData {
  marketNarratives: MarketNarrativePulse;
  fetchedAt: string;
}

async function buildNewsPayload(): Promise<Omit<NewsData, "fetchedAt">> {
  // Quotes + theme RSS run in parallel inside fetchMarketNarrativePulse.
  const marketNarratives = await fetchMarketNarrativePulse();
  return { marketNarratives };
}

const loadNewsCached = unstable_cache(
  async () => buildNewsPayload(),
  ["market-news-v1"],
  { revalidate: 300 },
);

/** Shared by `/news` SSR and `/api/market/news` — same cache key. */
export async function loadNewsData(): Promise<NewsData> {
  const payload = await loadNewsCached();
  return {
    ...payload,
    fetchedAt: new Date().toISOString(),
  };
}
