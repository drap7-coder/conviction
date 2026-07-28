import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, type CompanySuggestion } from "@/lib/sec/company-tickers";
import { searchYahooSymbols } from "@/lib/market/yahoo-search";

/**
 * GET /api/companies/search?q=<query>&limit=<n>
 *
 * Type-ahead suggestions for add-company / quote lookup inputs.
 * Prefers the SEC company_tickers dataset, then supplements with Yahoo
 * Finance search so ETFs and other listed symbols (e.g. SCHD) appear.
 *
 * Returns: { suggestions: Array<{ ticker, name, cik }> }
 * Gracefully returns an empty list when providers are unavailable.
 */
export const dynamic = "force-dynamic";

function mergeSuggestions(
  primary: CompanySuggestion[],
  secondary: CompanySuggestion[],
  limit: number,
): CompanySuggestion[] {
  const seen = new Set(primary.map((s) => s.ticker.toUpperCase()));
  const merged = [...primary];
  for (const item of secondary) {
    const ticker = item.ticker.toUpperCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;

  if (q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const [sec, yahoo] = await Promise.all([
      searchCompanies(q, limit).catch(() => [] as CompanySuggestion[]),
      searchYahooSymbols(q, limit).catch(() => [] as CompanySuggestion[]),
    ]);
    const suggestions = mergeSuggestions(sec, yahoo, limit);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[companies/search] failed", {
      q,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ suggestions: [] });
  }
}
