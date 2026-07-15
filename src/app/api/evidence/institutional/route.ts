import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalAccumulationForCompany,
} from "@/lib/sec/institutional";
import { isRequestTimeout, withTimeout } from "@/lib/request-timeout";
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

  try {
    const result = await withTimeout(
      getInstitutionalAccumulationForCompany(
        resolvedTicker,
        resolvedCompanyName,
      ),
      22_000,
    );
    return NextResponse.json({ ...result, status: "success" });
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json({
      ticker: resolvedTicker,
      companyName: resolvedCompanyName,
      results: [],
      fetchedAt: new Date().toISOString(),
      source: timedOut ? "timeout" : "error",
      status: timedOut ? "timeout" : "error",
      message: timedOut
        ? "Institutional filing data is temporarily unavailable."
        : "Institutional filing data could not be loaded.",
    });
  }
}
