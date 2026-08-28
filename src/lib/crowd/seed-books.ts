import type { PersistedPosition } from "@/lib/portfolio/persist";
import type { CrowdBook } from "@/lib/crowd/types";

/**
 * Stable seed user ids — upserted into Neon when DATABASE_URL is set.
 * Prefixed so live Google accounts never collide.
 */
export const CROWD_SEED_ID_PREFIX = "crowd-seed-";

export function isCrowdSeedUserId(userId: string): boolean {
  return userId.startsWith(CROWD_SEED_ID_PREFIX);
}

export function crowdSeedEmail(id: string): string {
  return `${id}@seed.gotconviction.internal`;
}

type SeedDef = {
  id: string;
  label: string;
  positions: PersistedPosition[];
  watchlist: Array<{ ticker: string; companyName: string }>;
};

/**
 * Ten starter member books for Crowd v1 — classic retail archetypes so
 * “most held” has signal before real signed-in books pile up.
 * Dollar sizes are illustrative; aggregates use presence + weight, not AUM.
 */
const SEED_DEFS: SeedDef[] = [
  {
    id: "crowd-seed-01",
    label: "Mega-cap growth",
    positions: [
      { ticker: "NVDA", shares: 40, averageCost: 120 },
      { ticker: "AAPL", shares: 80, averageCost: 180 },
      { ticker: "MSFT", shares: 45, averageCost: 400 },
      { ticker: "META", shares: 35, averageCost: 480 },
      { ticker: "GOOG", shares: 50, averageCost: 160 },
      { ticker: "AMZN", shares: 40, averageCost: 180 },
    ],
    watchlist: [
      { ticker: "AVGO", companyName: "Broadcom" },
      { ticker: "TSM", companyName: "Taiwan Semiconductor" },
      { ticker: "CRM", companyName: "Salesforce" },
    ],
  },
  {
    id: "crowd-seed-02",
    label: "AI semis",
    positions: [
      { ticker: "NVDA", shares: 55, averageCost: 110 },
      { ticker: "AVGO", shares: 30, averageCost: 140 },
      { ticker: "AMD", shares: 90, averageCost: 120 },
      { ticker: "TSM", shares: 70, averageCost: 140 },
      { ticker: "ASML", shares: 12, averageCost: 800 },
      { ticker: "MU", shares: 100, averageCost: 90 },
    ],
    watchlist: [
      { ticker: "SMCI", companyName: "Super Micro Computer" },
      { ticker: "ARM", companyName: "Arm Holdings" },
      { ticker: "PLTR", companyName: "Palantir" },
    ],
  },
  {
    id: "crowd-seed-03",
    label: "Dividend income",
    positions: [
      { ticker: "SCHD", shares: 200, averageCost: 78 },
      { ticker: "JNJ", shares: 60, averageCost: 155 },
      { ticker: "PG", shares: 50, averageCost: 160 },
      { ticker: "KO", shares: 120, averageCost: 60 },
      { ticker: "PEP", shares: 45, averageCost: 170 },
      { ticker: "VZ", shares: 150, averageCost: 40 },
    ],
    watchlist: [
      { ticker: "MO", companyName: "Altria" },
      { ticker: "O", companyName: "Realty Income" },
      { ticker: "ABBV", companyName: "AbbVie" },
    ],
  },
  {
    id: "crowd-seed-04",
    label: "Three-fund core",
    positions: [
      { ticker: "VTI", shares: 120, averageCost: 250 },
      { ticker: "VXUS", shares: 180, averageCost: 60 },
      { ticker: "BND", shares: 200, averageCost: 72 },
    ],
    watchlist: [
      { ticker: "VOO", companyName: "Vanguard S&P 500 ETF" },
      { ticker: "QQQ", companyName: "Invesco QQQ" },
      { ticker: "GLD", companyName: "SPDR Gold Shares" },
    ],
  },
  {
    id: "crowd-seed-05",
    label: "Energy sleeve",
    positions: [
      { ticker: "XOM", shares: 80, averageCost: 105 },
      { ticker: "CVX", shares: 55, averageCost: 150 },
      { ticker: "COP", shares: 70, averageCost: 110 },
      { ticker: "XLE", shares: 100, averageCost: 88 },
      { ticker: "OXY", shares: 90, averageCost: 58 },
    ],
    watchlist: [
      { ticker: "SLB", companyName: "Schlumberger" },
      { ticker: "EOG", companyName: "EOG Resources" },
      { ticker: "USO", companyName: "United States Oil Fund" },
    ],
  },
  {
    id: "crowd-seed-06",
    label: "Healthcare leaders",
    positions: [
      { ticker: "LLY", shares: 18, averageCost: 780 },
      { ticker: "UNH", shares: 25, averageCost: 520 },
      { ticker: "ABBV", shares: 55, averageCost: 170 },
      { ticker: "MRK", shares: 70, averageCost: 110 },
      { ticker: "JNJ", shares: 40, averageCost: 155 },
      { ticker: "ISRG", shares: 20, averageCost: 400 },
    ],
    watchlist: [
      { ticker: "VRTX", companyName: "Vertex Pharmaceuticals" },
      { ticker: "PFE", companyName: "Pfizer" },
      { ticker: "NVO", companyName: "Novo Nordisk" },
    ],
  },
  {
    id: "crowd-seed-07",
    label: "Mag7 + cash",
    positions: [
      { ticker: "AAPL", shares: 60, averageCost: 175 },
      { ticker: "MSFT", shares: 35, averageCost: 390 },
      { ticker: "GOOG", shares: 55, averageCost: 155 },
      { ticker: "NVDA", shares: 25, averageCost: 125 },
      { ticker: "SGOV", shares: 200, averageCost: 100 },
    ],
    watchlist: [
      { ticker: "AMZN", companyName: "Amazon" },
      { ticker: "META", companyName: "Meta Platforms" },
      { ticker: "TSLA", companyName: "Tesla" },
    ],
  },
  {
    id: "crowd-seed-08",
    label: "Consumer staples & retail",
    positions: [
      { ticker: "COST", shares: 20, averageCost: 850 },
      { ticker: "WMT", shares: 80, averageCost: 70 },
      { ticker: "HD", shares: 30, averageCost: 360 },
      { ticker: "AMZN", shares: 45, averageCost: 175 },
      { ticker: "NKE", shares: 70, averageCost: 95 },
      { ticker: "MCD", shares: 40, averageCost: 280 },
    ],
    watchlist: [
      { ticker: "SBUX", companyName: "Starbucks" },
      { ticker: "TGT", companyName: "Target" },
      { ticker: "LOW", companyName: "Lowe's" },
    ],
  },
  {
    id: "crowd-seed-09",
    label: "Financials",
    positions: [
      { ticker: "JPM", shares: 50, averageCost: 190 },
      { ticker: "BAC", shares: 200, averageCost: 35 },
      { ticker: "V", shares: 40, averageCost: 270 },
      { ticker: "MA", shares: 25, averageCost: 450 },
      { ticker: "BRK.B", shares: 30, averageCost: 400 },
      { ticker: "GS", shares: 15, averageCost: 480 },
    ],
    watchlist: [
      { ticker: "MS", companyName: "Morgan Stanley" },
      { ticker: "SCHW", companyName: "Charles Schwab" },
      { ticker: "AXP", companyName: "American Express" },
    ],
  },
  {
    id: "crowd-seed-10",
    label: "High-beta speculative",
    positions: [
      { ticker: "TSLA", shares: 40, averageCost: 220 },
      { ticker: "PLTR", shares: 200, averageCost: 25 },
      { ticker: "COIN", shares: 30, averageCost: 180 },
      { ticker: "MSTR", shares: 12, averageCost: 350 },
      { ticker: "SMCI", shares: 40, averageCost: 45 },
      { ticker: "NVDA", shares: 20, averageCost: 115 },
    ],
    watchlist: [
      { ticker: "HOOD", companyName: "Robinhood" },
      { ticker: "SOFI", companyName: "SoFi Technologies" },
      { ticker: "MARA", companyName: "Marathon Digital" },
    ],
  },
];

export const CROWD_SEED_BOOKS: CrowdBook[] = SEED_DEFS.map((def) => ({
  id: def.id,
  label: def.label,
  source: "seed" as const,
  positions: def.positions.map((p) => ({ ...p, ticker: p.ticker.toUpperCase() })),
  watchlist: def.watchlist.map((w) => w.ticker.toUpperCase()),
}));

export const CROWD_SEED_WATCHLIST_META: Record<
  string,
  Array<{ ticker: string; companyName: string }>
> = Object.fromEntries(SEED_DEFS.map((def) => [def.id, def.watchlist]));

export function listCrowdSeedBooks(): CrowdBook[] {
  return CROWD_SEED_BOOKS.map((book) => ({
    ...book,
    positions: book.positions.map((p) => ({ ...p })),
    watchlist: [...book.watchlist],
  }));
}
