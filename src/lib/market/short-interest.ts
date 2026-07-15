import { fetchWithTimeout } from "@/lib/request-timeout";

export type ShortInterestStatus = "success" | "empty" | "unsupported";

export interface ShortInterestRecord {
  ticker: string;
  issueName: string;
  settlementDate: string;
  currentShortShares: number;
  previousShortShares: number;
  changeShares: number;
  changePercent: number;
  averageDailyVolume: number;
  daysToCover: number;
  marketClass: string | null;
  source: "finra-consolidated-short-interest";
}

export interface ShortInterestSummary {
  ticker: string;
  status: ShortInterestStatus;
  latest: ShortInterestRecord | null;
  previous: ShortInterestRecord | null;
  fetchedAt: string;
  source: "finra-consolidated-short-interest";
}

interface FinraPartitionResponse {
  availablePartitions?: Array<{ partitions?: string[] }>;
}

interface FinraShortInterestRow {
  symbolCode?: string;
  issueName?: string;
  settlementDate?: string;
  currentShortPositionQuantity?: number;
  previousShortPositionQuantity?: number;
  changePreviousNumber?: number;
  changePercent?: number;
  averageDailyVolumeQuantity?: number;
  daysToCoverQuantity?: number;
  marketClassCode?: string;
}

const FINRA_GROUP = "otcMarket";
const FINRA_DATASET = "consolidatedShortInterest";
const FINRA_DATA_URL = `https://api.finra.org/data/group/${FINRA_GROUP}/name/${FINRA_DATASET}`;
const FINRA_PARTITIONS_URL = `https://api.finra.org/partitions/group/${FINRA_GROUP}/name/${FINRA_DATASET}`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const summaryCache = new Map<string, { summary: ShortInterestSummary; cachedAt: number }>();
let partitionsCache: { dates: string[]; cachedAt: number } | null = null;

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toRecord(ticker: string, row: FinraShortInterestRow): ShortInterestRecord | null {
  if (!row.settlementDate) return null;
  return {
    ticker,
    issueName: row.issueName ?? ticker,
    settlementDate: row.settlementDate,
    currentShortShares: finiteNumber(row.currentShortPositionQuantity),
    previousShortShares: finiteNumber(row.previousShortPositionQuantity),
    changeShares: finiteNumber(row.changePreviousNumber),
    changePercent: finiteNumber(row.changePercent),
    averageDailyVolume: finiteNumber(row.averageDailyVolumeQuantity),
    daysToCover: finiteNumber(row.daysToCoverQuantity),
    marketClass: row.marketClassCode ?? null,
    source: "finra-consolidated-short-interest",
  };
}

async function fetchSettlementDates() {
  if (partitionsCache && Date.now() - partitionsCache.cachedAt < CACHE_TTL_MS) {
    return partitionsCache.dates;
  }

  const response = await fetchWithTimeout(
    FINRA_PARTITIONS_URL,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Conviction/1.0",
      },
      next: { revalidate: 6 * 60 * 60 },
    },
    8_000,
  );
  if (!response.ok) return [];

  const payload = (await response.json()) as FinraPartitionResponse;
  const dates = (payload.availablePartitions ?? [])
    .map((entry) => entry.partitions?.[0])
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => b.localeCompare(a));

  partitionsCache = { dates, cachedAt: Date.now() };
  return dates;
}

async function fetchRecordForDate(ticker: string, settlementDate: string) {
  const response = await fetchWithTimeout(
    FINRA_DATA_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Conviction/1.0",
      },
      body: JSON.stringify({
        compareFilters: [
          { compareType: "EQUAL", fieldName: "settlementDate", fieldValue: settlementDate },
          { compareType: "EQUAL", fieldName: "symbolCode", fieldValue: ticker },
        ],
        limit: 1,
      }),
      next: { revalidate: 6 * 60 * 60 },
    },
    8_000,
  );
  if (!response.ok || response.status === 204) return null;

  const rows = (await response.json()) as FinraShortInterestRow[];
  return rows[0] ? toRecord(ticker, rows[0]) : null;
}

export function clearShortInterestCache() {
  summaryCache.clear();
  partitionsCache = null;
}

export async function fetchShortInterestSummary(ticker: string): Promise<ShortInterestSummary> {
  const upperTicker = normalizeTicker(ticker);
  if (!upperTicker) {
    return {
      ticker: upperTicker,
      status: "unsupported",
      latest: null,
      previous: null,
      fetchedAt: new Date().toISOString(),
      source: "finra-consolidated-short-interest",
    };
  }

  const cached = summaryCache.get(upperTicker);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.summary;

  const settlementDates = await fetchSettlementDates();
  const records: ShortInterestRecord[] = [];

  for (const date of settlementDates.slice(0, 8)) {
    const record = await fetchRecordForDate(upperTicker, date);
    if (record) records.push(record);
    if (records.length >= 2) break;
  }

  const summary: ShortInterestSummary = {
    ticker: upperTicker,
    status: records.length > 0 ? "success" : "empty",
    latest: records[0] ?? null,
    previous: records[1] ?? null,
    fetchedAt: new Date().toISOString(),
    source: "finra-consolidated-short-interest",
  };

  summaryCache.set(upperTicker, { summary, cachedAt: Date.now() });
  return summary;
}
