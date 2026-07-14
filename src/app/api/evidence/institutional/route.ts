import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalAccumulationForCompany,
} from "@/lib/sec/institutional";
import { getWatchlist } from "@/lib/watchlist/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const refresh = searchParams.get("refresh") === "1";

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  const entries = await getWatchlist();
  const entry = entries.find((item) => item.ticker === ticker);
  if (!entry) {
    return NextResponse.json(
      { error: "ticker is not in the watchlist", ticker },
      { status: 404 },
    );
  }

  if (refresh) clearInstitutionalCache();

  const result = await getInstitutionalAccumulationForCompany(
    entry.ticker,
    entry.companyName,
  );

  return NextResponse.json(result);
}
