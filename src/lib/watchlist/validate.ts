/**
 * Ticker validation for CONVICTION watchlist.
 * Validates ticker format and resolves to a known CIK/company.
 */

import { CIK_MAP } from "@/lib/sec/cik";

// Known company names mapped to tickers
const COMPANY_NAME_MAP: Record<string, string> = {
  "OCCIDENTAL PETROLEUM": "OXY",
  "OCCIDENTAL": "OXY",
  "INTEL": "INTC",
  "INTEL CORPORATION": "INTC",
  "ALPHABET": "GOOG",
  "GOOGLE": "GOOG",
  "NOVO NORDISK": "NVO",
  "PFIZER": "PFE",
  "PFIZER INC": "PFE",
  "NEBiUS": "NBIS",
  "NEBiUS GROUP": "NBIS",
  "CROWDSTRIKE": "CRWD",
  "CROWDSTRIKE HOLDINGS": "CRWD",
  "ON HOLDING": "ONON",
  "ON RUNNING": "ONON",
  "PALANTIR": "PLTR",
  "PALANTIR TECHNOLOGIES": "PLTR",
  "RECURSION PHARMACEUTICALS": "RXRX",
  "RECURSION": "RXRX",
  "AEROVIRONMENT": "AVAV",
};

const TICKER_REGEX = /^[A-Z]{1,5}$/;

export interface TickerValidationResult {
  valid: boolean;
  ticker: string;
  companyName?: string;
  cik?: string;
  isForeignIssuer?: boolean;
  error?: string;
}

/**
 * Validate and resolve a ticker or company name.
 * Accepts: "OXY", "intc", "Intel", "novo nordisk", etc.
 */
export function validateTicker(input: string): TickerValidationResult {
  const cleaned = input.trim();

  if (!cleaned) {
    return { valid: false, ticker: cleaned, error: "Enter a ticker or company name" };
  }

  // Try exact company name match first
  const upperName = cleaned.toUpperCase();
  const nameMatch = COMPANY_NAME_MAP[upperName];
  if (nameMatch) {
    return resolveTicker(nameMatch);
  }

  // Try as ticker
  const upperTicker = cleaned.toUpperCase();
  if (!TICKER_REGEX.test(upperTicker)) {
    return {
      valid: false,
      ticker: upperTicker,
      error: `"${cleaned}" is not a valid ticker format. Enter 1–5 uppercase letters or a company name.`,
    };
  }

  return resolveTicker(upperTicker);
}

/**
 * Resolve a validated ticker to CIK and company name.
 */
function resolveTicker(ticker: string): TickerValidationResult {
  const cik = CIK_MAP[ticker];

  if (!cik) {
    return {
      valid: false,
      ticker,
      error: `"${ticker}" is not a supported ticker. Only SEC-reporting companies with CIK mappings are supported.`,
    };
  }

  // NVO is a foreign issuer — doesn't file Form 4
  const isForeignIssuer = ticker === "NVO" || ticker === "NVO";

  const companyName = KNOWN_NAMES[ticker] ?? ticker;

  return {
    valid: true,
    ticker,
    companyName,
    cik,
    isForeignIssuer,
  };
}

const KNOWN_NAMES: Record<string, string> = {
  OXY: "Occidental Petroleum",
  INTC: "Intel Corporation",
  GOOG: "Alphabet Inc.",
  NVO: "Novo Nordisk",
  PFE: "Pfizer Inc.",
  NBIS: "Nebius Group",
  CRWD: "CrowdStrike Holdings",
  ONON: "On Holding AG",
  PLTR: "Palantir Technologies",
  RXRX: "Recursion Pharmaceuticals",
  AVAV: "AeroVironment",
};