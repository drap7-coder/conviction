import { NewsBoard } from "@/components/market/NewsBoard";
import { loadNewsData, type NewsData } from "@/lib/market/news-data";

export const revalidate = 300;

/**
 * SSR cache-first News: paint themes from `unstable_cache`, then soft-refresh
 * on visibility / 5m. Quotes + RSS run in parallel on the cold path.
 */
export default async function NewsPage() {
  let initialData: NewsData | null = null;
  try {
    initialData = await loadNewsData();
  } catch {
    initialData = null;
  }

  return <NewsBoard initialData={initialData} />;
}
