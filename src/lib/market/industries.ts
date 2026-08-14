/**
 * S&P 500 sector definitions using SPDR sector ETF proxies.
 * Each sector has an ETF ticker, name, description, and representative companies.
 * This is not a scoring engine — just a discovery UI + portfolio mix fallback.
 */
export interface Sector {
  ticker: string;
  name: string;
  description: string;
  representativeTickers: string[];
}

/**
 * Canonical display names used in portfolio mix / colors.
 * Yahoo and other feeds often use aliases — normalize before grouping.
 */
export const CANONICAL_SECTOR_NAMES = [
  "Technology",
  "Financials",
  "Health Care",
  "Energy",
  "Industrials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Utilities",
  "Real Estate",
  "Communication Services",
  "Materials",
] as const;

const SECTOR_ALIASES: Record<string, string> = {
  healthcare: "Health Care",
  "health care": "Health Care",
  "information technology": "Technology",
  technology: "Technology",
  "consumer cyclical": "Consumer Discretionary",
  "consumer discretionary": "Consumer Discretionary",
  "consumer defensive": "Consumer Staples",
  "consumer staples": "Consumer Staples",
  "basic materials": "Materials",
  materials: "Materials",
  "financial services": "Financials",
  financials: "Financials",
  "communication services": "Communication Services",
  "communications": "Communication Services",
  industrials: "Industrials",
  energy: "Energy",
  utilities: "Utilities",
  "real estate": "Real Estate",
};

/** Map Yahoo / feed sector labels onto our canonical GICS-style names. */
export function normalizeSectorName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const mapped = SECTOR_ALIASES[trimmed.toLowerCase()];
  if (mapped) return mapped;
  // Already canonical?
  if ((CANONICAL_SECTOR_NAMES as readonly string[]).includes(trimmed)) return trimmed;
  return trimmed;
}

export const SECTORS: Sector[] = [
  {
    ticker: "XLK",
    name: "Technology",
    description: "Software, hardware, semiconductors, and IT services.",
    representativeTickers: [
      "AAPL", "MSFT", "NVDA", "AVGO", "CRM", "INTC", "IBM", "AMD", "ORCL", "PLTR",
      "CSCO", "TSM", "ASML", "SAP", "SONY", "APLD", "VOOG",
    ],
  },
  {
    ticker: "XLF",
    name: "Financials",
    description: "Banks, insurance, asset management, and diversified financials.",
    representativeTickers: [
      "JPM", "BAC", "GS", "V", "MA", "BLK", "COIN", "HOOD", "PYPL", "SQ", "MSTR",
    ],
  },
  {
    ticker: "XLV",
    name: "Health Care",
    description: "Pharmaceuticals, biotech, health equipment, and managed care.",
    representativeTickers: [
      "LLY", "PFE", "UNH", "ABBV", "MRK", "JNJ", "NVO", "AMGN",
    ],
  },
  {
    ticker: "XLE",
    name: "Energy",
    description: "Oil, gas, and energy equipment & services.",
    representativeTickers: [
      "XOM", "CVX", "COP", "SLB", "OXY", "EOG", "CCJ", "GEV",
    ],
  },
  {
    ticker: "XLI",
    name: "Industrials",
    description: "Aerospace, defense, machinery, transport, and infrastructure.",
    representativeTickers: [
      "BA", "CAT", "GE", "UPS", "HON", "MMM",
    ],
  },
  {
    ticker: "XLY",
    name: "Consumer Discretionary",
    description: "Retail, automotive, leisure, media, and consumer durables.",
    representativeTickers: [
      "TSLA", "AMZN", "HD", "NKE", "MCD", "TM", "BABA", "PDD", "MELI",
    ],
  },
  {
    ticker: "XLP",
    name: "Consumer Staples",
    description: "Food, beverage, household goods, and personal care products.",
    representativeTickers: [
      "PG", "KO", "PEP", "WMT", "COST", "UL", "WBA",
    ],
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
    representativeTickers: [
      "GOOG", "META", "NFLX", "DIS", "T", "VZ",
    ],
  },
  {
    ticker: "XLB",
    name: "Materials",
    description: "Chemicals, metals, mining, and construction materials.",
    representativeTickers: [
      "LIN", "SHW", "APD", "ECL", "NEM", "FCX", "AA", "NUE", "DOW",
    ],
  },
];

/** Crypto miners / infrastructure — Technology when Yahoo leaves them blank. */
const CRYPTO_EQUITY_TICKERS = new Set([
  "MARA", "RIOT", "CLSK", "IREN", "WULF",
]);

export function getSectorByTicker(ticker: string): Sector | undefined {
  return SECTORS.find((s) => s.ticker === ticker.toUpperCase());
}

export function getSectorForCompany(ticker: string): Sector | undefined {
  const upperTicker = ticker.toUpperCase();
  const direct = SECTORS.find((sector) =>
    sector.representativeTickers.includes(upperTicker),
  );
  if (direct) return direct;
  if (CRYPTO_EQUITY_TICKERS.has(upperTicker)) {
    return SECTORS.find((sector) => sector.name === "Technology");
  }
  return undefined;
}

export function getAllSectorTickers(): string[] {
  return SECTORS.map((s) => s.ticker);
}

export function getAllRepresentativeTickers(): string[] {
  return Array.from(new Set(SECTORS.flatMap((s) => s.representativeTickers)));
}
