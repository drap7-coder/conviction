/**
 * Ticker validation for CONVICTION watchlist.
 *
 * Resolves tickers and company names using:
 *  1. Hardcoded CIK_MAP (fast path for well-known tickers)
 *  2. SEC company_tickers.json dataset (dynamic, ~10K entries)
 *  3. Minimal alias/fallback maps for edge cases
 *
 * The SEC dataset is the primary source for display names and name resolution.
 * The hardcoded fallback maps exist only for:
 *  - Offline/test environments where the SEC dataset is unreachable
 *  - True aliases (product names, foreign issuers) that the SEC dataset cannot match
 */

import { CIK_MAP } from "@/lib/sec/cik";
import { resolveCompanyByTicker, resolveCompanyByName, getCompanyTickerDataset } from "@/lib/sec/company-tickers";

// ---------------------------------------------------------------------------
// Alias map — only for common names that the SEC dataset cannot resolve.
// Most company names (APPLE, MICROSOFT, etc.) are handled by the SEC
// dataset's prefix/word-overlap matching. Only add entries here when the
// name is a true alias (product name, legacy name, foreign issuer, etc.).
// ---------------------------------------------------------------------------
const ALIAS_MAP: Record<string, string> = {
  // Seed watchlist — foreign issuer
  "NOVO NORDISK": "NVO",

  // Product names / legacy brands
  "GOOGLE": "GOOG",
  "ALPHABET": "GOOG",
  "FACEBOOK": "META",
  "SQUARE": "SQ",

  // Non-standard names not in SEC dataset
  "NEBiUS": "NBIS",
  "NEBiUS GROUP": "NBIS",
  "APPLIED DIGITAL": "APLD",
  "APPLIED DIGITAL CORPORATION": "APLD",

  // Punctuation variants that confuse the SEC name matcher
  "AT&T": "T",
  "MCDONALD'S": "MCD",
  "COCA COLA": "KO",
  "3M": "MMM",
  "DOW JONES": "DD",
  "JOHNSON & JOHNSON": "JNJ",
};

// ---------------------------------------------------------------------------
// Fallback name resolution — used when the SEC dataset is unreachable
// (e.g., tests, offline, cold start). Maps common names to tickers.
// The SEC dataset is the primary source when available.
// ---------------------------------------------------------------------------
const FALLBACK_NAME_MAP: Record<string, string> = {
  // Seed watchlist
  "OCCIDENTAL PETROLEUM": "OXY",
  "OCCIDENTAL": "OXY",
  "INTEL": "INTC",
  "INTEL CORPORATION": "INTC",
  "ALPHABET": "GOOG",
  "ALPHABET INC": "GOOG",
  "PFIZER": "PFE",
  "PFIZER INC": "PFE",

  // Common company names
  "APPLE": "AAPL",
  "APPLE INC": "AAPL",
  "MICROSOFT": "MSFT",
  "MICROSOFT CORPORATION": "MSFT",
  "AMAZON": "AMZN",
  "AMAZON.COM": "AMZN",
  "META": "META",
  "META PLATFORMS": "META",
  "NVIDIA": "NVDA",
  "NVIDIA CORPORATION": "NVDA",
  "TESLA": "TSLA",
  "TESLA INC": "TSLA",
  "NETFLIX": "NFLX",
  "ADVANCED MICRO DEVICES": "AMD",
  "SALESFORCE": "CRM",
  "ADOBE": "ADBE",
  "ORACLE": "ORCL",
  "CISCO": "CSCO",
  "QUALCOMM": "QCOM",
  "MICRON": "MU",
  "SERVICENOW": "NOW",

  // Consumer / retail
  "WALMART": "WMT",
  "COSTCO": "COST",
  "HOME DEPOT": "HD",
  "NIKE": "NKE",
  "COCA-COLA": "KO",
  "PEPSICO": "PEP",
  "PEPSI": "PEP",
  "MCDONALDS": "MCD",
  "STARBUCKS": "SBUX",
  "DISNEY": "DIS",
  "WALT DISNEY": "DIS",
  "GAMESTOP": "GME",
  "BOEING": "BA",
  "CATERPILLAR": "CAT",
  "UNITEDHEALTH": "UNH",

  // Pharma
  "ABBVIE": "ABBV",
  "MERCK": "MRK",
  "THERMO FISHER": "TMO",
  "ELI LILLY": "LLY",
  "LILLY": "LLY",
  "BIOGEN": "BIIB",
  "GILEAD": "GILD",
  "REGENERON": "REGN",
  "MODERNA": "MRNA",
  "VERTEX": "VRTX",
  "VERTEX PHARMACEUTICALS": "VRTX",

  // Banks / finance
  "JPMORGAN": "JPM",
  "JPMORGAN CHASE": "JPM",
  "BANK OF AMERICA": "BAC",
  "GOLDMAN SACHS": "GS",
  "MORGAN STANLEY": "MS",
  "CHARLES SCHWAB": "SCHW",
  "BLACKROCK": "BLK",
  "VISA": "V",
  "MASTERCARD": "MA",
  "PAYPAL": "PYPL",
  "ROBINHOOD": "HOOD",
  "COINBASE": "COIN",

  // Energy
  "EXXON": "XOM",
  "EXXON MOBIL": "XOM",
  "CHEVRON": "CVX",
  "CONOCOPHILLIPS": "COP",
  "SCHLUMBERGER": "SLB",

  // Defense
  "LOCKHEED MARTIN": "LMT",
  "NORTHROP GRUMMAN": "NOC",
  "RAYTHEON": "RTX",
  "GENERAL DYNAMICS": "GD",
  "HONEYWELL": "HON",
  "GENERAL ELECTRIC": "GE",

  // Telecom
  "VERIZON": "VZ",
  "T-MOBILE": "TMUS",
  "COMCAST": "CMCSA",

  // AI / cloud
  "CROWDSTRIKE": "CRWD",
  "CROWDSTRIKE HOLDINGS": "CRWD",
  "ON HOLDING": "ONON",
  "ON RUNNING": "ONON",
  "PALANTIR": "PLTR",
  "PALANTIR TECHNOLOGIES": "PLTR",
  "RECURSION PHARMACEUTICALS": "RXRX",
  "RECURSION": "RXRX",
  "AEROVIRONMENT": "AVAV",
  "SNOWFLAKE": "SNOW",
  "DATADOG": "DDOG",
  "MONGODB": "MDB",
  "CLOUDFLARE": "NET",
  "PALO ALTO": "PANW",
  "PALO ALTO NETWORKS": "PANW",
  "OKTA": "OKTA",
  "DOCUSIGN": "DOCU",
  "TWILIO": "TWLO",
  "HUBSPOT": "HUBS",
  "SHOPIFY": "SHOP",
  "UBER": "UBER",
  "LYFT": "LYFT",
  "SNAP INC": "SNAP",
  "PINTEREST": "PINS",
  "ROKU": "ROKU",
};

// ---------------------------------------------------------------------------
// Fallback display names — used when the SEC dataset is unreachable.
// The SEC dataset is the primary source for display names.
// ---------------------------------------------------------------------------
const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  OXY: "Occidental Petroleum",
  INTC: "Intel Corporation",
  GOOG: "Alphabet Inc.",
  NVO: "Novo Nordisk",
  PFE: "Pfizer Inc.",
  NBIS: "Nebius Group",
  APLD: "Applied Digital Corporation",
  CRWD: "CrowdStrike Holdings",
  ONON: "On Holding AG",
  PLTR: "Palantir Technologies",
  RXRX: "Recursion Pharmaceuticals",
  AVAV: "AeroVironment",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  AMZN: "Amazon.com Inc.",
  META: "Meta Platforms Inc.",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla Inc.",
  NFLX: "Netflix Inc.",
  AMD: "Advanced Micro Devices Inc.",
  CRM: "Salesforce Inc.",
  ADBE: "Adobe Inc.",
  ORCL: "Oracle Corporation",
  IBM: "International Business Machines",
  CSCO: "Cisco Systems Inc.",
  QCOM: "Qualcomm Inc.",
  MU: "Micron Technology Inc.",
  NOW: "ServiceNow Inc.",
  WMT: "Walmart Inc.",
  HD: "The Home Depot Inc.",
  NKE: "Nike Inc.",
  KO: "The Coca-Cola Company",
  PEP: "PepsiCo Inc.",
  MCD: "McDonald's Corporation",
  SBUX: "Starbucks Corporation",
  DIS: "The Walt Disney Company",
  BA: "The Boeing Company",
  CAT: "Caterpillar Inc.",
  UNH: "UnitedHealth Group Inc.",
  JPM: "JPMorgan Chase & Co.",
  BAC: "Bank of America Corporation",
  GME: "GameStop Corp.",
  JNJ: "Johnson & Johnson",
  ABBV: "AbbVie Inc.",
  MRK: "Merck & Co. Inc.",
  TMO: "Thermo Fisher Scientific Inc.",
  LLY: "Eli Lilly and Company",
  BIIB: "Biogen Inc.",
  GILD: "Gilead Sciences Inc.",
  REGN: "Regeneron Pharmaceuticals Inc.",
  MRNA: "Moderna Inc.",
  VRTX: "Vertex Pharmaceuticals Inc.",
  GS: "Goldman Sachs Group Inc.",
  MS: "Morgan Stanley",
  SCHW: "The Charles Schwab Corporation",
  BLK: "BlackRock Inc.",
  V: "Visa Inc.",
  MA: "Mastercard Inc.",
  PYPL: "PayPal Holdings Inc.",
  SQ: "Block Inc.",
  HOOD: "Robinhood Markets Inc.",
  COIN: "Coinbase Global Inc.",
  XOM: "Exxon Mobil Corporation",
  CVX: "Chevron Corporation",
  COP: "ConocoPhillips",
  SLB: "Schlumberger N.V.",
  LMT: "Lockheed Martin Corporation",
  NOC: "Northrop Grumman Corporation",
  RTX: "RTX Corporation",
  GD: "General Dynamics Corporation",
  HON: "Honeywell International Inc.",
  GE: "General Electric Company",
  MMM: "3M Company",
  T: "AT&T Inc.",
  VZ: "Verizon Communications Inc.",
  TMUS: "T-Mobile US Inc.",
  CMCSA: "Comcast Corporation",
  SNOW: "Snowflake Inc.",
  DDOG: "Datadog Inc.",
  MDB: "MongoDB Inc.",
  NET: "Cloudflare Inc.",
  PANW: "Palo Alto Networks Inc.",
  OKTA: "Okta Inc.",
  DOCU: "DocuSign Inc.",
  TWLO: "Twilio Inc.",
  HUBS: "HubSpot Inc.",
  SHOP: "Shopify Inc.",
  UBER: "Uber Technologies Inc.",
  LYFT: "Lyft Inc.",
  SNAP: "Snap Inc.",
  PINS: "Pinterest Inc.",
  ROKU: "Roku Inc.",
  TSM: "Taiwan Semiconductor Manufacturing Co.",
  ASML: "ASML Holding N.V.",
  AMGN: "Amgen Inc.",
  COST: "Costco Wholesale Corporation",
  UPS: "United Parcel Service Inc.",
  FDX: "FedEx Corporation",
  DAL: "Delta Air Lines Inc.",
  AAL: "American Airlines Group Inc.",
  BRKB: "Berkshire Hathaway Inc.",
};

const TICKER_REGEX = /^[A-Z]{1,5}$/;
const SHARE_CLASS_REGEX = /^[A-Z]{1,4}[.\-][A-Z]{1,2}$/; // BRK.B, BF.A

export interface TickerValidationResult {
  valid: boolean;
  ticker: string;
  companyName?: string;
  cik?: string;
  isForeignIssuer?: boolean;
  error?: string;
  source?: "hardcoded" | "dataset" | "name_match" | "alias" | "fallback" | "not_found";
}

/**
 * Validate and resolve a ticker or company name.
 *
 * Accepts: "OXY", "intc", "Intel", "BRK.B", "novo nordisk", etc.
 *
 * Resolution order:
 *  1. Alias map (fast path for common names that SEC can't resolve)
 *  2. Hardcoded CIK map (fast path)
 *  3. Fallback name map (for offline/test environments)
 *  4. SEC company tickers dataset (ticker match)
 *  5. SEC company tickers dataset (name match)
 */
export async function validateTicker(input: string): Promise<TickerValidationResult> {
  const cleaned = input.trim();

  if (!cleaned) {
    return { valid: false, ticker: cleaned, error: "Enter a ticker or company name" };
  }

  const upperName = cleaned.toUpperCase();

  // 1. Try alias map first (fast path for common aliases)
  const aliasMatch = ALIAS_MAP[upperName];
  if (aliasMatch) {
    return resolveTickerFromCikMap(aliasMatch);
  }

  const upperTicker = cleaned.toUpperCase();

  // 2. Validate ticker format (allow share classes like BRK.B)
  if (!TICKER_REGEX.test(upperTicker) && !SHARE_CLASS_REGEX.test(upperTicker)) {
    // Not a ticker format — try name resolution
    const nameResult = await resolveByName(upperName);
    if (nameResult) return nameResult;

    return {
      valid: false,
      ticker: upperTicker,
      error: `"${cleaned}" is not a valid ticker format. Enter 1–5 uppercase letters or a company name.`,
    };
  }

  // 3. Try hardcoded CIK map first (fast path)
  const syncResult = await resolveTickerFromCikMap(upperTicker);
  if (syncResult.valid) return syncResult;

  // 4. Try fallback name map (offline/test fallback)
  const fallbackName = FALLBACK_NAME_MAP[upperName];
  if (fallbackName && CIK_MAP[fallbackName]) {
    return resolveTickerFromCikMap(fallbackName);
  }

  // 5. Try SEC dataset (dynamic)
  return resolveTickerFromDataset(upperName);
}

/**
 * Resolve a ticker from the hardcoded CIK_MAP, deriving display name
 * from the SEC dataset when possible.
 */
async function resolveTickerFromCikMap(ticker: string): Promise<TickerValidationResult> {
  const normalized = ticker.replace(/[.\-]/g, "");
  const cik = CIK_MAP[ticker] || CIK_MAP[normalized];

  if (!cik) {
    return { valid: false, ticker, error: `"${ticker}" is not a supported ticker.` };
  }

  const isForeignIssuer = ticker === "NVO" || normalized === "NVO";
  const name = await resolveDisplayName(ticker, normalized);

  return {
    valid: true,
    ticker,
    cik,
    companyName: name,
    isForeignIssuer,
    source: "hardcoded",
  };
}

/**
 * Resolve a display name for a ticker from the curated fallback map
 * (preferred for well-known companies), falling back to the SEC dataset.
 *
 * The fallback map has proper-case names (e.g., "NVIDIA Corporation")
 * while the SEC dataset returns all-caps shortened names (e.g., "NVIDIA CORP").
 * For tickers in the curated CIK_MAP, the fallback name is authoritative.
 */
async function resolveDisplayName(ticker: string, normalized?: string): Promise<string> {
  // 1. Curated fallback display names (proper-case, authoritative for CIK_MAP tickers)
  const fallback = FALLBACK_DISPLAY_NAMES[ticker]
    || (normalized ? FALLBACK_DISPLAY_NAMES[normalized] : undefined);
  if (fallback) return fallback;

  // 2. Try SEC dataset (for tickers outside the curated CIK_MAP)
  try {
    const ds = await getCompanyTickerDataset();
    const entry = ds.byTicker.get(ticker) || (normalized ? ds.byTicker.get(normalized) : undefined);
    if (entry) return entry.name;
  } catch {
    // Fall through
  }

  return ticker;
}

/**
 * Resolve a ticker or name against the SEC dataset.
 */
async function resolveTickerFromDataset(input: string): Promise<TickerValidationResult> {
  try {
    // Try as ticker first
    const tickerResult = await resolveCompanyByTicker(input);
    if (tickerResult.found && tickerResult.ticker) {
      return {
        valid: true,
        ticker: tickerResult.ticker,
        cik: tickerResult.cik,
        companyName: tickerResult.name || tickerResult.ticker,
        source: tickerResult.source as "dataset" | "hardcoded",
      };
    }

    // Try as company name
    const nameResult = await resolveByName(input);
    if (nameResult) return nameResult;

    return {
      valid: false,
      ticker: input.toUpperCase(),
      error: `"${input}" is not a supported ticker. Only SEC-reporting companies with ticker mappings are supported.`,
    };
  } catch {
    return {
      valid: false,
      ticker: input.toUpperCase(),
      error: `"${input}" is not a supported ticker. Only SEC-reporting companies with ticker mappings are supported.`,
    };
  }
}

/**
 * Resolve by company name using the SEC dataset, with fallback
 * to the hardcoded fallback name map for offline/test environments.
 */
async function resolveByName(input: string): Promise<TickerValidationResult | null> {
  // Try SEC dataset first
  try {
    const result = await resolveCompanyByName(input, {}, {});
    if (result.found && result.ticker && result.cik) {
      return {
        valid: true,
        ticker: result.ticker,
        cik: result.cik,
        companyName: result.name || result.ticker,
        source: result.source as "dataset" | "hardcoded" | "name_match",
      };
    }
  } catch {
    // Fall through to fallback map
  }

  // Fallback to hardcoded name map (for offline/test environments)
  const upper = input.toUpperCase();
  const mapped = FALLBACK_NAME_MAP[upper];
  if (mapped && CIK_MAP[mapped]) {
    const cik = CIK_MAP[mapped];
    const name = FALLBACK_DISPLAY_NAMES[mapped] || mapped;
    return {
      valid: true,
      ticker: mapped,
      cik,
      companyName: name,
      isForeignIssuer: mapped === "NVO",
      source: "fallback",
    };
  }

  return null;
}