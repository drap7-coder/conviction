import { NextRequest, NextResponse } from "next/server";
import { getNewsEvidenceSummary } from "@/lib/evidence/news-evidence";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

/**
 * GET /api/evidence/news-batch?tickers=AAPL,GOOG,INTC
 *
 * Consolidated news fetch for the homepage card footers.
 * Fetches news for up to 10 tickers in parallel.
 * Silently degrades on error per ticker — never returns an error status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("tickers")?.toUpperCase() ?? "";
  const tickers = raw.split(",").filter(Boolean).slice(0, 10);

  if (tickers.length === 0) {
    return NextResponse.json({ news: {} });
  }

  const results: Record<string, {
    headline: string | null;
    url: string | null;
    date: string | null;
  }> = {};

  await Promise.all(tickers.map(async (ticker) => {
    try {
      const resolved = await validateTicker(ticker);
      if (!resolved.valid) {
        results[ticker] = { headline: null, url: null, date: null };
        return;
      }
      const summary = await getNewsEvidenceSummary(resolved.ticker, resolved.companyName ?? resolved.ticker);
      const event = summary.events[0];
      if (event) {
        results[ticker] = {
          headline: event.title.slice(0, 200),
          url: event.sourceUrl ?? null,
          date: event.date,
        };
      } else {
        results[ticker] = { headline: null, url: null, date: null };
      }
    } catch {
      // Silent degradation: no news = fall through to evidence signal
      results[ticker] = { headline: null, url: null, date: null };
    }
  }));

  return NextResponse.json({ news: results });
}