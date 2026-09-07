import { NextResponse } from "next/server";
import { loadNewsData } from "@/lib/market/news-data";

/** Public news themes — ~5–10 minute CDN + unstable_cache; not user-specific. */
export const revalidate = 300;

export async function GET() {
  const payload = await loadNewsData();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
