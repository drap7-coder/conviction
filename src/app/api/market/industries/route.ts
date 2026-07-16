import { NextRequest, NextResponse } from "next/server";
import { fetchStockQuotes, fetchStockHistory } from "@/lib/market/quotes";
import { SECTORS, type Sector } from "@/lib/market/industries";

export const dynamic = "force-dynamic";

export interface SectorWithData extends Sector {
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
  } | null;
  sparkline: { date: string; close: number }[];
  representativeQuotes: Array<{
    ticker: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
  }>;
}

export async function GET() {
  const sectorTickers = SECTORS.map((s) => s.ticker);
  const repTickers = Array.from(new Set(SECTORS.flatMap((s) => s.representativeTickers)));

  const [quotes, historyResults] = await Promise.all([
    fetchStockQuotes([...sectorTickers, ...repTickers]),
    Promise.all(
      SECTORS.map(async (sector) => {
        try {
          const history = await fetchStockHistory(sector.ticker, "1d");
          return { ticker: sector.ticker, points: history.points.slice(-42) };
        } catch {
          return { ticker: sector.ticker, points: [] };
        }
      }),
    ),
  ]);

  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));
  const sparklineMap = new Map(historyResults.map((h) => [h.ticker, h.points]));

  const sectors: SectorWithData[] = SECTORS.map((sector) => {
    const sectorQuote = quoteMap.get(sector.ticker);
    return {
      ...sector,
      quote: sectorQuote
        ? {
            price: sectorQuote.price,
            change: sectorQuote.change,
            changePercent: sectorQuote.changePercent,
          }
        : null,
      sparkline: sparklineMap.get(sector.ticker) ?? [],
      representativeQuotes: sector.representativeTickers.map((t) => {
        const q = quoteMap.get(t);
        return {
          ticker: t,
          price: q?.price ?? null,
          change: q?.change ?? null,
          changePercent: q?.changePercent ?? null,
        };
      }),
    };
  });

  return NextResponse.json({ sectors, fetchedAt: new Date().toISOString() });
}