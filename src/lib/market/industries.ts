/**
 * S&P 500 sector definitions using SPDR sector ETF proxies.
 * Each sector has an ETF ticker, name, description, and representative companies.
 * This is not a scoring engine — just a discovery UI.
 */
export interface Sector {
  ticker: string;
  name: string;
  description: string;
  representativeTickers: string[];
}

export const SECTORS: Sector[] = [
  {
    ticker: "XLK",
    name: "Technology",
    description: "Software, hardware, semiconductors, and IT services.",
    representativeTickers: ["AAPL", "MSFT", "NVDA", "AVGO", "CRM", "INTC"],
  },
  {
    ticker: "XLF",
    name: "Financials",
    description: "Banks, insurance, asset management, and diversified financials.",
    representativeTickers: ["JPM", "BAC", "GS", "V", "BLK"],
  },
  {
    ticker: "XLV",
    name: "Health Care",
    description: "Pharmaceuticals, biotech, health equipment, and managed care.",
    representativeTickers: ["LLY", "PFE", "UNH", "ABBV", "MRK"],
  },
  {
    ticker: "XLE",
    name: "Energy",
    description: "Oil, gas, and energy equipment & services.",
    representativeTickers: ["XOM", "CVX", "COP", "SLB", "OXY"],
  },
  {
    ticker: "XLI",
    name: "Industrials",
    description: "Aerospace, defense, machinery, transport, and infrastructure.",
    representativeTickers: ["BA", "CAT", "GE", "UPS", "HON"],
  },
  {
    ticker: "XLY",
    name: "Consumer Discretionary",
    description: "Retail, automotive, leisure, media, and consumer durables.",
    representativeTickers: ["TSLA", "AMZN", "HD", "NKE", "MCD"],
  },
  {
    ticker: "XLP",
    name: "Consumer Staples",
    description: "Food, beverage, household goods, and personal care products.",
    representativeTickers: ["PG", "KO", "PEP", "WMT", "COST"],
  },
  {
    ticker: "XLU",
    name: "Utilities",
    description: "Electric, gas, and water utility providers.",
    representativeTickers: ["NEE", "DUK", "SO", "D", "AEP"],
  },
  {
    ticker: "XLRE",
    name: "Real Estate",
    description: "REITs and real estate management & development.",
    representativeTickers: ["PLD", "AMT", "CCI", "EQIX", "SPG"],
  },
  {
    ticker: "XLC",
    name: "Communication Services",
    description: "Telecom, media, entertainment, and interactive media.",
    representativeTickers: ["GOOG", "META", "NFLX", "DIS", "T"],
  },
  {
    ticker: "XLB",
    name: "Materials",
    description: "Chemicals, metals, mining, and construction materials.",
    representativeTickers: ["LIN", "SHW", "APD", "ECL", "NEM"],
  },
];

export function getSectorByTicker(ticker: string): Sector | undefined {
  return SECTORS.find((s) => s.ticker === ticker.toUpperCase());
}

export function getSectorForCompany(ticker: string): Sector | undefined {
  const upperTicker = ticker.toUpperCase();
  return SECTORS.find((sector) =>
    sector.representativeTickers.includes(upperTicker),
  );
}

export function getAllSectorTickers(): string[] {
  return SECTORS.map((s) => s.ticker);
}

export function getAllRepresentativeTickers(): string[] {
  return Array.from(new Set(SECTORS.flatMap((s) => s.representativeTickers)));
}
