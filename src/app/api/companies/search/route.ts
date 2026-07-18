import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/sec/company-tickers";

/**
 * GET /api/companies/search?q=<query>&limit=<n>
 *
 * Type-ahead suggestions for the add-company input. Searches the cached
 * SEC company_tickers dataset by ticker and company name.
 *
 * Returns: { suggestions: Array<{ ticker, name, cik }> }
 * Gracefully returns an empty list when the dataset is unavailable.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;

  if (q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchCompanies(q, limit);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[companies/search] failed", {
      q,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ suggestions: [] });
  }
}
