import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { easternSessionCacheKey } from "@/lib/market/live-quote";
import { fetchTrendingCompanies } from "@/lib/market/trending";

/** Match quotes freshness so Movers % stay near company-dashboard prints. */
export const revalidate = 300;

const loadTrending = unstable_cache(
  async (limit: number, _sessionKey: string) => fetchTrendingCompanies(limit),
  ["market-trending-v2"],
  { revalidate: 300 },
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam)
    ? Math.max(3, Math.min(24, Math.floor(limitParam)))
    : 8;

  const companies = await loadTrending(limit, easternSessionCacheKey());

  return NextResponse.json(
    {
      companies,
      fetchedAt: new Date().toISOString(),
      note: "Trending is ranked from a curated liquid-stock universe using the existing quote provider.",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
