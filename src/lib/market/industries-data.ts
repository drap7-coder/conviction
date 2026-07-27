import { fetchStockQuotes, fetchStockHistory } from "@/lib/market/quotes";
import { SECTORS, type Sector } from "@/lib/market/industries";

export interface SectorWithData extends Sector {
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
    marketState: string | null;
    preMarketPrice: number | null;
    preMarketChange: number | null;
    preMarketChangePercent: number | null;
    postMarketPrice: number | null;
    postMarketChange: number | null;
    postMarketChangePercent: number | null;
  } | null;
  sparkline: { date: string; close: number }[];
  representativeQuotes: Array<{
    ticker: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
  }>;
}

export interface IndustriesSnapshot {
  sectors: SectorWithData[];
  fetchedAt: string;
}

function sectorsWithoutQuotes(): SectorWithData[] {
  return SECTORS.map((sector) => ({
    ...sector,
    quote: null,
    sparkline: [],
    representativeQuotes: sector.representativeTickers.map((ticker) => ({
      ticker,
      price: null,
      change: null,
      changePercent: null,
    })),
  }));
}

/**
 * Fetch sector ETF quotes + intraday sparklines for the Industries surface.
 * Falls back to static sector definitions when market data is unavailable
 * so crawlers and SSR still receive real sector names and links.
 */
export async function getIndustriesSnapshot(): Promise<IndustriesSnapshot> {
  const fetchedAt = new Date().toISOString();

  try {
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
              marketState: sectorQuote.marketState ?? null,
              preMarketPrice: sectorQuote.preMarketPrice ?? null,
              preMarketChange: sectorQuote.preMarketChange ?? null,
              preMarketChangePercent: sectorQuote.preMarketChangePercent ?? null,
              postMarketPrice: sectorQuote.postMarketPrice ?? null,
              postMarketChange: sectorQuote.postMarketChange ?? null,
              postMarketChangePercent: sectorQuote.postMarketChangePercent ?? null,
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

    return { sectors, fetchedAt };
  } catch {
    return { sectors: sectorsWithoutQuotes(), fetchedAt };
  }
}
