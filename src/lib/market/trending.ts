import { fetchStockQuotes, type StockHistoryPoint, type StockQuote } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";

const TRENDING_UNIVERSE = [
  "NVDA",
  "TSLA",
  "AAPL",
  "AMD",
  "PLTR",
  "INTC",
  "AMZN",
  "MSFT",
  "META",
  "GOOG",
  "NFLX",
  "AVGO",
  "ORCL",
  "IBM",
  "CRM",
  "WMT",
  "DIS",
  "BA",
  "JPM",
  "BAC",
  "XOM",
  "OXY",
  "PFE",
  "LLY",
  "WEN",
  "APLD",
  "NBIS",
  "GME",
  "HOOD",
  "COIN",
];

export interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  sparkline: StockHistoryPoint[];
  activityRank: number;
  activityScore: number;
  activityLabel: string;
}

function activityScore(quote: StockQuote) {
  const dollarVolumeScore = Math.log10(Math.max(1, quote.dollarVolume ?? 0));
  const moveScore = Math.min(12, Math.abs(quote.changePercent ?? 0)) * 0.7;
  return dollarVolumeScore + moveScore;
}

function formatDollarVolume(value: number | null) {
  if (value === null) return "Market activity";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B traded`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M traded`;
  return "Market activity";
}

/**
 * Rank a fixed equity universe by live activity.
 * Uses quote payloads only (incl. 1d sparkline) — no per-ticker history fan-out.
 */
export async function fetchTrendingCompanies(limit = 8): Promise<TrendingCompany[]> {
  const quotes = await fetchStockQuotes(TRENDING_UNIVERSE);

  // Score using whichever price is live (pre-market → regular → after-hours)
  // so ranking catches extended-hours moves too.
  const ranked = quotes
    .filter((quote) => {
      const live = getLivePrice(quote);
      return live.price !== null;
    })
    .map((quote) => {
      const live = getLivePrice(quote);
      const scoreQuote: StockQuote = {
        ...quote,
        price: live.price ?? quote.price,
        change: live.change ?? quote.change,
        changePercent: live.changePercent ?? quote.changePercent,
      };
      return { quote, score: activityScore(scoreQuote) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, TRENDING_UNIVERSE.length)));

  return ranked.map(({ quote, score }, index) => ({
    ticker: quote.ticker,
    companyName: quote.name?.trim() || quote.ticker,
    quote,
    sparkline: quote.sparkline ?? [],
    activityScore: score,
    activityLabel: formatDollarVolume(quote.dollarVolume),
    activityRank: index + 1,
  }));
}
