import { NextRequest, NextResponse } from "next/server";
import { getNewsEvidenceSummary } from "@/lib/evidence/news-evidence";
import { validateTicker } from "@/lib/watchlist/validate";
import type { NewsDriver } from "@/lib/evidence/news-driver";

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
    driver: NewsDriver | null;
    headlines: Array<{
      headline: string;
      url: string | null;
      date: string;
    }>;
  }> = {};

  await Promise.all(tickers.map(async (ticker) => {
    try {
      const resolved = await validateTicker(ticker);
      if (!resolved.valid) {
        results[ticker] = { headline: null, url: null, date: null, driver: null, headlines: [] };
        return;
      }
      const summary = await getNewsEvidenceSummary(resolved.ticker, resolved.companyName ?? resolved.ticker);
      const event = summary.events[0];
      const headlines = summary.events.slice(0, 3).map((newsEvent) => ({
        headline: newsEvent.title.slice(0, 200),
        url: newsEvent.sourceUrl ?? null,
        date: newsEvent.date,
      }));
      if (event) {
        results[ticker] = {
          headline: event.title.slice(0, 200),
          url: event.sourceUrl ?? null,
          date: event.date,
          driver: summary.driver,
          headlines,
        };
      } else {
        results[ticker] = { headline: null, url: null, date: null, driver: null, headlines: [] };
      }
    } catch (error) {
      console.error("[news-batch] provider request failed", {
        ticker,
        error: error instanceof Error ? error.message : String(error),
      });
      results[ticker] = { headline: null, url: null, date: null, driver: null, headlines: [] };
    }
  }));

  return NextResponse.json({ news: results });
}
