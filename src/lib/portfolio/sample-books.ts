import type { PersistedPosition } from "@/lib/portfolio/persist";

export type SampleBook = {
  id: string;
  label: string;
  description: string;
  positions: PersistedPosition[];
};

function book(tickers: string[], shares = 10): PersistedPosition[] {
  return tickers.map((ticker) => ({ ticker, shares }));
}

/**
 * Theme sample books aligned with Pulse narrative themes.
 * Each book is 10 single-name stocks (no ETFs) for an empty Portfolio.
 */
export const SAMPLE_PORTFOLIO_BOOKS: SampleBook[] = [
  {
    id: "ai-compute",
    label: "AI + Compute",
    description: "AI platforms, semis, and data-center names",
    positions: book([
      "NVDA",
      "AMD",
      "AVGO",
      "MSFT",
      "GOOG",
      "META",
      "AMZN",
      "TSM",
      "ORCL",
      "PLTR",
    ]),
  },
  {
    id: "rates-fed",
    label: "Dividend Income",
    description: "Cash-returning blue chips and staples",
    positions: book([
      "JNJ",
      "PG",
      "KO",
      "PEP",
      "ABBV",
      "MRK",
      "HD",
      "MMM",
      "IBM",
      "VZ",
    ]),
  },
  {
    id: "energy-oil",
    label: "Energy + Metals",
    description: "Oil producers, services, and miners",
    positions: book([
      "XOM",
      "CVX",
      "COP",
      "SLB",
      "OXY",
      "EOG",
      "FCX",
      "NEM",
      "AA",
      "NUE",
    ]),
  },
  {
    id: "crypto-liquidity",
    label: "Crypto",
    description: "Exchanges, miners, and crypto-linked equities",
    positions: book([
      "COIN",
      "MSTR",
      "HOOD",
      "MARA",
      "RIOT",
      "CLSK",
      "IREN",
      "WULF",
      "PYPL",
      "SQ",
    ]),
  },
  {
    id: "trade-supply",
    label: "Global",
    description: "US-listed global leaders and ADRs",
    positions: book([
      "TSM",
      "ASML",
      "NVO",
      "SAP",
      "TM",
      "SONY",
      "BABA",
      "PDD",
      "MELI",
      "UL",
    ]),
  },
  {
    id: "consumer-demand",
    label: "Sector Leadership",
    description: "Tech, discretionary, and financial leaders",
    positions: book([
      "AAPL",
      "MSFT",
      "AMZN",
      "TSLA",
      "NFLX",
      "JPM",
      "V",
      "MA",
      "COST",
      "WMT",
    ]),
  },
];
