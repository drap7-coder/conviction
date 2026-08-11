import type { PersistedPosition } from "@/lib/portfolio/persist";

export type SampleBook = {
  id: string;
  label: string;
  description: string;
  /** Theme tickers — sized to a shared target value when loaded. */
  tickers: string[];
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
 * Theme sample books aligned with Pulse narrative themes.
 * Ten single-name stocks each (no ETFs). Dollar size is applied at load time.
 */
export const SAMPLE_PORTFOLIO_BOOKS: SampleBook[] = [
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
