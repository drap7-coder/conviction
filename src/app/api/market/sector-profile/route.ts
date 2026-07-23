import { NextRequest, NextResponse } from "next/server";
import { fetchSectorProfiles } from "@/lib/market/sector-profile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams
    .get("tickers")
    ?.split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30) ?? [];

  if (tickers.length === 0) {
    return NextResponse.json({ error: "tickers query parameter is required" }, { status: 400 });
  }

  const profiles = await fetchSectorProfiles(tickers);
  const result = tickers
    .map((t) => profiles.get(t) ?? { ticker: t, sector: null, industry: null, longName: null, marketCap: null })
    .filter(Boolean);

  return NextResponse.json({ profiles: result, fetchedAt: new Date().toISOString() });
}