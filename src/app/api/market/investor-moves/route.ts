import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalMarketIdeas,
} from "@/lib/sec/institutional";
import { isRequestTimeout, withTimeout } from "@/lib/request-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INVESTOR_MOVES_CACHE_CONTROL =
  "public, max-age=300, s-maxage=21600, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (refresh) clearInstitutionalCache();

  try {
    const result = await withTimeout(
      getInstitutionalMarketIdeas({ forceRefresh: refresh }),
      48_000,
    );
    return NextResponse.json(
      { ...result, status: "success" },
      {
        headers: {
          "Cache-Control": refresh ? "no-store" : INVESTOR_MOVES_CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json(
      {
        ideas: [],
        managerCount: 0,
        filingQuarter: null,
        latestFilingDate: null,
        fetchedAt: new Date().toISOString(),
        source: timedOut ? "timeout" : "error",
        status: timedOut ? "timeout" : "error",
        message: timedOut
          ? "Investor filings are taking longer than usual."
          : "Investor moves could not be loaded.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
