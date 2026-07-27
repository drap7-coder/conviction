import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalMarketIdeas,
} from "@/lib/sec/institutional";
import { isRequestTimeout, withTimeout } from "@/lib/request-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (refresh) clearInstitutionalCache();

  try {
    const result = await withTimeout(
      getInstitutionalMarketIdeas({ forceRefresh: refresh }),
      48_000,
    );
    return NextResponse.json({ ...result, status: "success" });
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json({
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
    });
  }
}
