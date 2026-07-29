import { fetchStockQuotes } from "@/lib/market/quotes";
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
  }));
}

/**
 * Fetch sector ETF quotes (+ embedded sparklines) for the Industries surface.
 * Only the 11 sector ETFs — representative company names stay static for SEO copy.
 */
export async function getIndustriesSnapshot(): Promise<IndustriesSnapshot> {
  const fetchedAt = new Date().toISOString();

  try {
    const sectorTickers = SECTORS.map((s) => s.ticker);
    const quotes = await fetchStockQuotes(sectorTickers);
    const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));

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
        sparkline: sectorQuote?.sparkline ?? [],
      };
    });

    return { sectors, fetchedAt };
  } catch {
    return { sectors: sectorsWithoutQuotes(), fetchedAt };
  }
}
