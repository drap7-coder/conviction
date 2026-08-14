import type { PersistedPosition } from "@/lib/portfolio/persist";

export type SampleBook = {
  id: string;
  label: string;
  description: string;
  /** Theme tickers — sized to a shared target value when loaded. */
  tickers: string[];
  /**
   * Optional target weights in percent of book value (should sum to ~100).
   * When omitted, the book is equal-weighted across tickers.
   */
  weights?: Record<string, number>;
};

/** Every sample book targets the same round book size. */
export const SAMPLE_BOOK_TARGET_VALUE = 100_000;

const ACTIVE_BOOK_KEY = "conviction-portfolio-active-book";
const SAMPLE_POSITIONS_KEY = "conviction-portfolio-sample-positions";

interface StoredSamplePositions {
  bookId: string;
  positions: PersistedPosition[];
}

/**
 * Sample books: strategy allocations (weighted) plus theme baskets (equal-weight stocks).
 */
export const SAMPLE_PORTFOLIO_BOOKS: SampleBook[] = [
  {
    id: "all-weather",
    label: "All-Weather",
    description: "Ray Dalio risk-balanced mix across growth and inflation regimes",
    tickers: ["VTI", "TLT", "IEF", "GLD", "DBC"],
    weights: {
      VTI: 30,
      TLT: 40,
      IEF: 15,
      GLD: 7.5,
      DBC: 7.5,
    },
  },
  {
    id: "sixty-forty",
    label: "60/40",
    description: "Classic balanced mix — stocks for growth, bonds for ballast",
    tickers: ["VTI", "BND"],
    weights: {
      VTI: 60,
      BND: 40,
    },
  },
  {
    id: "three-fund",
    label: "Three-Fund",
    description: "Bogleheads global core — US stocks, international stocks, and bonds",
    tickers: ["VTI", "VXUS", "BND"],
    weights: {
      VTI: 50,
      VXUS: 30,
      BND: 20,
    },
  },
  {
    id: "permanent",
    label: "Permanent",
    description: "Harry Browne equal sleeves — stocks, long bonds, gold, and cash",
    tickers: ["VTI", "TLT", "GLD", "SGOV"],
    weights: {
      VTI: 25,
      TLT: 25,
      GLD: 25,
      SGOV: 25,
    },
  },
  {
    id: "ai-compute",
    label: "AI + Compute",
    description: "AI platforms, semis, and data-center names",
    tickers: [
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
    ],
  },
  {
    id: "rates-fed",
    label: "Dividend Income",
    description: "Cash-returning blue chips and staples",
    tickers: [
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
    ],
  },
  {
    id: "energy-oil",
    label: "Energy + Metals",
    description: "Oil producers, services, and miners",
    tickers: [
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
    ],
  },
  {
    id: "crypto-liquidity",
    label: "Crypto",
    description: "Exchanges, miners, and crypto-linked equities",
    tickers: [
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
    ],
  },
  {
    id: "trade-supply",
    label: "Global",
    description: "US-listed global leaders and ADRs",
    tickers: [
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
    ],
  },
  {
    id: "consumer-demand",
    label: "Sector Leadership",
    description: "Tech, discretionary, and financial leaders",
    tickers: [
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
    ],
  },
];

export function getSampleBook(id: string | null | undefined): SampleBook | null {
  if (!id) return null;
  return SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === id) ?? null;
}

/** Equal-weight a book to `targetTotal` using live prices (fractional shares OK). */
export function equalWeightPositions(
  tickers: string[],
  prices: Record<string, number | null | undefined>,
  targetTotal = SAMPLE_BOOK_TARGET_VALUE,
): PersistedPosition[] {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  const priced = unique
    .map((ticker) => {
      const price = prices[ticker];
      return typeof price === "number" && Number.isFinite(price) && price > 0
        ? { ticker, price }
        : null;
    })
    .filter((row): row is { ticker: string; price: number } => row !== null);

  // Quotes missing: keep the book shape with a neutral placeholder until prices land.
  if (priced.length === 0) {
    return unique.map((ticker) => ({ ticker, shares: 10 }));
  }

  const perName = targetTotal / priced.length;
  const sized = priced.map(({ ticker, price }) => ({
    ticker,
    shares: Number((perName / price).toFixed(4)),
    averageCost: Number(price.toFixed(2)),
  }));

  // Preserve any tickers that still lack a price so the book stays complete.
  const missing = unique.filter((ticker) => !priced.some((row) => row.ticker === ticker));
  return [
    ...sized,
    ...missing.map((ticker) => ({ ticker, shares: 10 })),
  ];
}

/** Size a book to target percent weights using live prices (fractional shares OK). */
export function weightedPositions(
  tickers: string[],
  weights: Record<string, number>,
  prices: Record<string, number | null | undefined>,
  targetTotal = SAMPLE_BOOK_TARGET_VALUE,
): PersistedPosition[] {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  const rows = unique.map((ticker) => {
    const weight = weights[ticker] ?? weights[ticker.toLowerCase()];
    const price = prices[ticker];
    return {
      ticker,
      weight: typeof weight === "number" && Number.isFinite(weight) && weight > 0 ? weight : 0,
      price: typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null,
    };
  });

  const priced = rows.filter((row) => row.weight > 0 && row.price !== null);
  if (priced.length === 0) {
    return unique.map((ticker) => ({ ticker, shares: 10 }));
  }

  const sized = priced.map((row) => {
    const dollars = targetTotal * (row.weight / 100);
    const price = row.price!;
    return {
      ticker: row.ticker,
      shares: Number((dollars / price).toFixed(4)),
      averageCost: Number(price.toFixed(2)),
    };
  });

  const missing = rows
    .filter((row) => !priced.some((pricedRow) => pricedRow.ticker === row.ticker))
    .map((row) => ({ ticker: row.ticker, shares: 10 }));

  return [...sized, ...missing];
}

/** Size any sample book — weighted when targets exist, otherwise equal-weight. */
export function sizeSampleBookPositions(
  book: SampleBook,
  prices: Record<string, number | null | undefined>,
  targetTotal = SAMPLE_BOOK_TARGET_VALUE,
): PersistedPosition[] {
  if (book.weights) {
    return weightedPositions(book.tickers, book.weights, prices, targetTotal);
  }
  return equalWeightPositions(book.tickers, prices, targetTotal);
}

export function loadActiveSampleBookId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_BOOK_KEY);
    return raw && getSampleBook(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveActiveSampleBookId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!id) localStorage.removeItem(ACTIVE_BOOK_KEY);
    else localStorage.setItem(ACTIVE_BOOK_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function isPersistedPosition(value: unknown): value is PersistedPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Partial<PersistedPosition>;
  return typeof position.ticker === "string" && typeof position.shares === "number" && Number.isFinite(position.shares);
}

export function loadSampleBookPositions(bookId: string | null | undefined): PersistedPosition[] {
  if (typeof window === "undefined" || !bookId) return [];
  try {
    const raw = localStorage.getItem(SAMPLE_POSITIONS_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Partial<StoredSamplePositions>;
    if (stored.bookId !== bookId || !Array.isArray(stored.positions)) return [];
    return stored.positions.filter(isPersistedPosition);
  } catch {
    return [];
  }
}

export function saveSampleBookPositions(bookId: string, positions: PersistedPosition[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(SAMPLE_POSITIONS_KEY, JSON.stringify({ bookId, positions }));
    return true;
  } catch {
    return false;
  }
}

/** Resolve the visible book without ever replacing the user's saved positions. */
export function resolveActivePortfolioPositions(
  personalPositions: PersistedPosition[],
  activeBookId: string | null,
  samplePositions: PersistedPosition[],
): PersistedPosition[] {
  if (activeBookId && samplePositions.length > 0) return samplePositions;
  return personalPositions;
}

/** Detect positions written by the legacy sample flow so they can be migrated safely. */
export function positionsMatchSampleBook(positions: PersistedPosition[], book: SampleBook): boolean {
  const positionTickers = [...new Set(positions.map((position) => position.ticker.trim().toUpperCase()))].sort();
  const bookTickers = [...new Set(book.tickers.map((ticker) => ticker.trim().toUpperCase()))].sort();
  return positionTickers.length === bookTickers.length && positionTickers.every((ticker, index) => ticker === bookTickers[index]);
}
