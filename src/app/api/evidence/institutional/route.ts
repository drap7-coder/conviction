import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalAccumulationForCompany,
} from "@/lib/sec/institutional";
import { getWatchlist } from "@/lib/watchlist/persist";
import { validateTicker } from "@/lib/watchlist/validate";

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
  let resolvedTicker: string;
  let resolvedCompanyName: string;

  if (entry) {
    resolvedTicker = entry.ticker;
    resolvedCompanyName = entry.companyName;
  } else {
    const resolved = await validateTicker(ticker);
    if (!resolved.valid) {
      return NextResponse.json(
        { error: "ticker is not supported", ticker },
        { status: 404 },
      );
    }
    resolvedTicker = resolved.ticker;
    resolvedCompanyName = resolved.companyName ?? ticker;
  }

  if (refresh) clearInstitutionalCache();

  const result = await getInstitutionalAccumulationForCompany(
    resolvedTicker,
    resolvedCompanyName,
  );

  return NextResponse.json(result);
}
