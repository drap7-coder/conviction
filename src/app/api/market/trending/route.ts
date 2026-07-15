import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingCompanies } from "@/lib/market/trending";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.max(3, Math.min(24, Math.floor(limitParam))) : 8;
  const companies = await fetchTrendingCompanies(limit);
  return NextResponse.json({
    companies,
    fetchedAt: new Date().toISOString(),
    note: "Trending is ranked from a curated liquid-stock universe using the existing quote provider.",
  });
}
