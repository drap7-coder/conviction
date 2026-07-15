export type PoliticalTradeDirection = "purchase" | "sale" | "exchange" | "other";

export interface PoliticalTrade {
  id: string;
  ticker: string;
  assetName: string;
  filerName: string;
  office: string;
  chamber: string;
  party: string | null;
  state: string | null;
  transactionType: string;
  direction: PoliticalTradeDirection;
  amountRange: string;
  amountLow: number | null;
  amountHigh: number | null;
  estimatedAmount: number | null;
  transactionDate: string;
  filingDate: string;
  daysToFile: number | null;
  isLate: boolean;
  sourceUrl: string;
}

export interface PoliticalTradeSummary {
  ticker: string;
  trades: PoliticalTrade[];
  purchases: PoliticalTrade[];
  sales: PoliticalTrade[];
  totalEstimatedPurchases: number;
  totalEstimatedSales: number;
  latestFilingDate: string | null;
  source: "kadoa-open-data";
  sourceUrl: string;
  fetchedAt: string;
}

interface RawPoliticalTrade {
  id?: string;
  ticker?: string | null;
  asset_name?: string | null;
  transaction_type?: string | null;
  amount_range_low?: number | null;
  amount_range_high?: number | null;
  amount_range_label?: string | null;
  transaction_date?: string | null;
  filing_date?: string | null;
  days_to_file?: number | null;
  is_late?: number | boolean | null;
  filer_name?: string | null;
  office?: string | null;
  chamber?: string | null;
  party?: string | null;
  state?: string | null;
  doc_url?: string | null;
}

const KADOA_TRADES_URL =
  "https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/trades.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cache: { trades: PoliticalTrade[]; fetchedAt: number } | null = null;

export function normalizePoliticalDirection(transactionType: string): PoliticalTradeDirection {
  const lower = transactionType.toLowerCase();
  if (lower.includes("purchase")) return "purchase";
  if (lower.includes("sale")) return "sale";
  if (lower.includes("exchange")) return "exchange";
  return "other";
}

function normalizeTrade(row: RawPoliticalTrade): PoliticalTrade | null {
  const ticker = row.ticker?.trim().toUpperCase();
  if (!ticker || ticker === "--") return null;

  const transactionType = row.transaction_type?.trim() || "Unknown";
  const amountLow = typeof row.amount_range_low === "number" ? row.amount_range_low : null;
  const amountHigh = typeof row.amount_range_high === "number" ? row.amount_range_high : null;
  const estimatedAmount =
    amountLow !== null && amountHigh !== null
      ? Math.round((amountLow + amountHigh) / 2)
      : null;

  return {
    id: row.id ?? `${ticker}-${row.filer_name ?? "unknown"}-${row.transaction_date ?? "unknown"}`,
    ticker,
    assetName: row.asset_name?.trim() || ticker,
    filerName: row.filer_name?.trim() || "Unknown filer",
    office: row.office?.trim() || row.chamber?.trim() || "Public filer",
    chamber: row.chamber?.trim() || "unknown",
    party: row.party?.trim() || null,
    state: row.state?.trim() || null,
    transactionType,
    direction: normalizePoliticalDirection(transactionType),
    amountRange: row.amount_range_label?.trim() || "Amount not reported",
    amountLow,
    amountHigh,
    estimatedAmount,
    transactionDate: row.transaction_date ?? "",
    filingDate: row.filing_date ?? "",
    daysToFile: typeof row.days_to_file === "number" ? row.days_to_file : null,
    isLate: row.is_late === true || row.is_late === 1,
    sourceUrl: row.doc_url ?? KADOA_TRADES_URL,
  };
}

async function fetchPoliticalTrades(): Promise<PoliticalTrade[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.trades;
  }

  const response = await fetch(KADOA_TRADES_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Political trade source returned ${response.status}`);

  const rows = (await response.json()) as RawPoliticalTrade[];
  const trades = rows
    .map(normalizeTrade)
    .filter((trade): trade is PoliticalTrade => trade !== null)
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  cache = { trades, fetchedAt: Date.now() };
  return trades;
}

export async function getPoliticalTradesForTicker(
  ticker: string,
  limit = 12,
): Promise<PoliticalTradeSummary> {
  const upperTicker = ticker.toUpperCase();
  const trades = (await fetchPoliticalTrades())
    .filter((trade) => trade.ticker === upperTicker)
    .slice(0, limit);

  const purchases = trades.filter((trade) => trade.direction === "purchase");
  const sales = trades.filter((trade) => trade.direction === "sale");
  const totalEstimatedPurchases = purchases.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
  const totalEstimatedSales = sales.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
  const latestFilingDate = trades.reduce<string | null>(
    (latest, trade) => (!latest || trade.filingDate > latest ? trade.filingDate : latest),
    null,
  );

  return {
    ticker: upperTicker,
    trades,
    purchases,
    sales,
    totalEstimatedPurchases,
    totalEstimatedSales,
    latestFilingDate,
    source: "kadoa-open-data",
    sourceUrl: KADOA_TRADES_URL,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getPoliticalTradeSummaries(tickers: string[]) {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))];
  return Promise.all(uniqueTickers.map((ticker) => getPoliticalTradesForTicker(ticker, 6)));
}
