/**
 * Ticker validation for CONVICTION watchlist.
 *
 * Resolves tickers and company names using:
 *  1. SEC company_tickers.json dataset (dynamic, ~10K entries)
 *  2. Hardcoded CIK_MAP / COMPANY_NAME_MAP (fallback)
 *
 * The SEC dataset is the primary source — the hardcoded map is kept
 * as a fast path for well-known tickers and as a fallback when
 * the SEC API is unreachable.
 *
 * DOES NOT classify ETFs, foreign issuers, or securities beyond
 * what the hardcoded map explicitly marks (NVO is the only
 * foreign-issuer flag today).
 */

import { CIK_MAP } from "@/lib/sec/cik";
import { resolveCompanyByTicker, resolveCompanyByName } from "@/lib/sec/company-tickers";

// Known company names mapped to tickers (fast path)
const COMPANY_NAME_MAP: Record<string, string> = {
  // Seed watchlist
  "OCCIDENTAL PETROLEUM": "OXY",
  "OCCIDENTAL": "OXY",
  "INTEL": "INTC",
  "INTEL CORPORATION": "INTC",
  "ALPHABET": "GOOG",
  "ALPHABET INC": "GOOG",
  "GOOGLE": "GOOG",
  "NOVO NORDISK": "NVO",
  "PFIZER": "PFE",
  "PFIZER INC": "PFE",
  "NEBiUS": "NBIS",
  "NEBiUS GROUP": "NBIS",

  // Extended emerging
  "CROWDSTRIKE": "CRWD",
  "CROWDSTRIKE HOLDINGS": "CRWD",
  "ON HOLDING": "ONON",
  "ON RUNNING": "ONON",
  "PALANTIR": "PLTR",
  "PALANTIR TECHNOLOGIES": "PLTR",
  "RECURSION PHARMACEUTICALS": "RXRX",
  "RECURSION": "RXRX",
  "AEROVIRONMENT": "AVAV",

  // Major tech
  "APPLE": "AAPL",
  "APPLE INC": "AAPL",
  "MICROSOFT": "MSFT",
  "MICROSOFT CORPORATION": "MSFT",
  "AMAZON": "AMZN",
  "AMAZON.COM": "AMZN",
  "META": "META",
  "META PLATFORMS": "META",
  "FACEBOOK": "META",
  "NVIDIA": "NVDA",
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
  "COCA COLA": "KO",
  "PEPSICO": "PEP",
  "PEPSI": "PEP",
  "MCDONALDS": "MCD",
  "MCDONALD'S": "MCD",
  "STARBUCKS": "SBUX",
  "DISNEY": "DIS",
  "WALT DISNEY": "DIS",
  "GAMESTOP": "GME",
  "BOEING": "BA",
  "CATERPILLAR": "CAT",
  "UNITEDHEALTH": "UNH",

  // Pharma
  "JOHNSON & JOHNSON": "JNJ",
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
  "SQUARE": "SQ",
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
  "3M": "MMM",

  // Telecom
  "AT&T": "T",
  "VERIZON": "VZ",
  "T-MOBILE": "TMUS",
  "COMCAST": "CMCSA",

  // AI / cloud
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
  "DOW JONES": "DD",
  "SNAP INC": "SNAP",
  "PINTEREST": "PINS",
  "ROKU": "ROKU",
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
  source?: "hardcoded" | "dataset" | "name_match" | "not_found";
}

/**
 * Validate and resolve a ticker or company name.
 *
 * Accepts: "OXY", "intc", "Intel", "BRK.B", "novo nordisk", etc.
 * Now async — fetches SEC company_tickers.json for dynamic resolution.
 *
 * Resolution order:
 *  1. Hardcoded company name map (fast path)
 *  2. Hardcoded CIK map (fast path)
 *  3. SEC company tickers dataset (ticker match)
 *  4. SEC company tickers dataset (name match)
 */
export async function validateTicker(input: string): Promise<TickerValidationResult> {
  const cleaned = input.trim();

  if (!cleaned) {
    return { valid: false, ticker: cleaned, error: "Enter a ticker or company name" };
  }

  // 1. Try hardcoded company name match first (fast path)
  const upperName = cleaned.toUpperCase();
  const nameMatch = COMPANY_NAME_MAP[upperName];
  if (nameMatch) {
    return resolveTickerSync(nameMatch);
  }

  // 2. Try as a ticker
  const upperTicker = cleaned.toUpperCase();

  // Validate ticker format (allow share classes like BRK.B)
  if (!TICKER_REGEX.test(upperTicker) && !SHARE_CLASS_REGEX.test(upperTicker)) {
    // Before rejecting, try the SEC dataset — it might be a name
    const nameResult = await resolveByName(upperName);
    if (nameResult) return nameResult;

    return {
      valid: false,
      ticker: upperTicker,
      error: `"${cleaned}" is not a valid ticker format. Enter 1–5 uppercase letters or a company name.`,
    };
  }

  // 3. Try hardcoded ticker map first
  const syncResult = resolveTickerSync(upperTicker);
  if (syncResult.valid) return syncResult;

  // 4. Try SEC dataset (dynamic)
  return resolveTickerFromDataset(upperName);
}

/**
 * Fast synchronous resolution against hardcoded maps only.
 */
function resolveTickerSync(ticker: string): TickerValidationResult {
  // Handle share classes: BRK.B → BRKB for hardcoded lookup
  const normalized = ticker.replace(/[.\-]/g, "");
  const cik = CIK_MAP[ticker] || CIK_MAP[normalized];

  if (!cik) {
    return { valid: false, ticker, error: `"${ticker}" is not a supported ticker.` };
  }

  const isForeignIssuer = ticker === "NVO" || normalized === "NVO";
  const name = KNOWN_NAMES[ticker] || KNOWN_NAMES[normalized] || ticker;

  return { valid: true, ticker, cik, companyName: name, isForeignIssuer, source: "hardcoded" };
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
 * Resolve by company name using the SEC dataset.
 */
async function resolveByName(input: string): Promise<TickerValidationResult | null> {
  const result = await resolveCompanyByName(input, COMPANY_NAME_MAP, KNOWN_NAMES);
  if (result.found && result.ticker && result.cik) {
    return {
      valid: true,
      ticker: result.ticker,
      cik: result.cik,
      companyName: result.name || result.ticker,
      source: result.source as "dataset" | "hardcoded" | "name_match",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Display names for hardcoded tickers
// ---------------------------------------------------------------------------

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
};