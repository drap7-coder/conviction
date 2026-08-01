/**
 * Slow-moving company fundamentals from Nasdaq annual statements.
 * Used by the quality half of the Conviction Score (not evidence/timing).
 */

import { fetchWithTimeout } from "@/lib/request-timeout";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; Conviction/1.0)",
};

const REVALIDATE = { next: { revalidate: 86_400 } } as const;

export interface CompanyFundamentals {
  ticker: string;
  asOf: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  cashAndEquivalents: number | null;
  shortTermInvestments: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  operatingCashFlow: number | null;
  capitalExpenditures: number | null;
  /** Operating CF − |capex|. */
  freeCashFlow: number | null;
  /** Negative = net repurchase / buyback. */
  saleAndPurchaseOfStock: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  profitMargin: number | null;
  afterTaxRoe: number | null;
  currentRatio: number | null;
  source: "nasdaq-financials";
  status: "success" | "partial" | "unavailable";
  fetchedAt: string;
  message?: string;
}

interface NasdaqFinancialsResponse {
  data?: {
    incomeStatementTable?: NasdaqTable;
    balanceSheetTable?: NasdaqTable;
    cashFlowTable?: NasdaqTable;
    financialRatiosTable?: NasdaqTable;
  };
}

interface NasdaqTable {
  headers?: Record<string, string>;
  rows?: Array<Record<string, string>>;
}

function parseMoney(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "--" || trimmed === "—") return null;
  const negative = trimmed.includes("(") || trimmed.startsWith("-");
  const digits = trimmed.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function parsePercent(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "--" || trimmed === "—") return null;
  const parsed = Number(trimmed.replace(/%/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function rowMap(table: NasdaqTable | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of table?.rows ?? []) {
    const label = String(row.value1 ?? "").trim().toLowerCase();
    const latest = String(row.value2 ?? "").trim();
    if (label) map.set(label, latest);
  }
  return map;
}

function money(map: Map<string, string>, ...labels: string[]): number | null {
  for (const label of labels) {
    const value = parseMoney(map.get(label.toLowerCase()));
    if (value !== null) return value;
  }
  return null;
}

function percent(map: Map<string, string>, ...labels: string[]): number | null {
  for (const label of labels) {
    const value = parsePercent(map.get(label.toLowerCase()));
    if (value !== null) return value;
  }
  return null;
}

function asOfFromHeaders(table: NasdaqTable | undefined): string | null {
  const raw = table?.headers?.value2?.replace(/^Period Ending:\s*/i, "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : raw;
}

export function fundamentalsFromNasdaqPayload(
  ticker: string,
  payload: NasdaqFinancialsResponse,
  fetchedAt = new Date().toISOString(),
): CompanyFundamentals {
  const income = rowMap(payload.data?.incomeStatementTable);
  const balance = rowMap(payload.data?.balanceSheetTable);
  const cash = rowMap(payload.data?.cashFlowTable);
  const ratios = rowMap(payload.data?.financialRatiosTable);

  const revenue = money(income, "total revenue");
  const grossProfit = money(income, "gross profit");
  const operatingIncome = money(income, "operating income");
  const netIncome = money(income, "net income");
  const totalAssets = money(balance, "total assets");
  const totalLiabilities = money(balance, "total liabilities");
  const totalEquity = money(balance, "total equity");
  const cashAndEquivalents = money(balance, "cash and cash equivalents");
  const shortTermInvestments = money(balance, "short-term investments");
  const shortTermDebt = money(
    balance,
    "short-term debt / current portion of long-term debt",
    "short-term debt",
  );
  const longTermDebt = money(balance, "long-term debt");
  const operatingCashFlow = money(cash, "net cash flow-operating", "net cash flow - operating");
  const capitalExpenditures = money(cash, "capital expenditures");
  const saleAndPurchaseOfStock = money(cash, "sale and purchase of stock");

  const freeCashFlow =
    operatingCashFlow !== null && capitalExpenditures !== null
      ? operatingCashFlow - Math.abs(capitalExpenditures)
      : operatingCashFlow;

  const grossMargin = percent(ratios, "gross margin");
  const operatingMargin = percent(ratios, "operating margin");
  const profitMargin = percent(ratios, "profit margin");
  const afterTaxRoe = percent(ratios, "after tax roe");
  const currentRatio = percent(ratios, "current ratio");

  const hasCore =
    revenue !== null
    || grossMargin !== null
    || operatingCashFlow !== null
    || totalEquity !== null;

  return {
    ticker: ticker.toUpperCase(),
    asOf:
      asOfFromHeaders(payload.data?.incomeStatementTable)
      ?? asOfFromHeaders(payload.data?.balanceSheetTable)
      ?? null,
    revenue,
    grossProfit,
    operatingIncome,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    cashAndEquivalents,
    shortTermInvestments,
    shortTermDebt,
    longTermDebt,
    operatingCashFlow,
    capitalExpenditures,
    freeCashFlow,
    saleAndPurchaseOfStock,
    grossMargin,
    operatingMargin,
    profitMargin,
    afterTaxRoe,
    currentRatio,
    source: "nasdaq-financials",
    status: hasCore ? "success" : "unavailable",
    fetchedAt,
    message: hasCore ? undefined : "Annual fundamentals were unavailable.",
  };
}

export async function fetchCompanyFundamentals(ticker: string): Promise<CompanyFundamentals> {
  const upper = ticker.trim().toUpperCase();
  const fetchedAt = new Date().toISOString();
  const empty = (): CompanyFundamentals => ({
    ticker: upper,
    asOf: null,
    revenue: null,
    grossProfit: null,
    operatingIncome: null,
    netIncome: null,
    totalAssets: null,
    totalLiabilities: null,
    totalEquity: null,
    cashAndEquivalents: null,
    shortTermInvestments: null,
    shortTermDebt: null,
    longTermDebt: null,
    operatingCashFlow: null,
    capitalExpenditures: null,
    freeCashFlow: null,
    saleAndPurchaseOfStock: null,
    grossMargin: null,
    operatingMargin: null,
    profitMargin: null,
    afterTaxRoe: null,
    currentRatio: null,
    source: "nasdaq-financials",
    status: "unavailable",
    fetchedAt,
    message: "Annual fundamentals were unavailable.",
  });

  try {
    const url = `https://api.nasdaq.com/api/company/${encodeURIComponent(upper)}/financials?frequency=1`;
    const response = await fetchWithTimeout(url, { headers: HEADERS, ...REVALIDATE }, 10_000);
    if (!response.ok) return empty();
    const payload = (await response.json()) as NasdaqFinancialsResponse;
    return fundamentalsFromNasdaqPayload(upper, payload, fetchedAt);
  } catch {
    return empty();
  }
}
