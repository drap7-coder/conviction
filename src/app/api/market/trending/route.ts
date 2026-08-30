import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchTrendingCompanies } from "@/lib/market/trending";

/** Trending is expensive (universe quotes + histories) — cache hard across clients. */
export const revalidate = 720;

const loadTrending = unstable_cache(
  async (limit: number) => fetchTrendingCompanies(limit),
  ["market-trending-v1"],
  { revalidate: 720 },
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam)
    ? Math.max(3, Math.min(24, Math.floor(limitParam)))
    : 8;

  const companies = await loadTrending(limit);

  return NextResponse.json(
    {
      companies,
      fetchedAt: new Date().toISOString(),
      note: "Trending is ranked from a curated liquid-stock universe using the existing quote provider.",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=720, stale-while-revalidate=1800",
      },
    },
  );
}
