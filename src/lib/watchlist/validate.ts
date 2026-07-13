/**
 * Ticker validation for CONVICTION watchlist.
 * Validates ticker format and resolves to a known CIK/company.
 */

import { CIK_MAP } from "@/lib/sec/cik";

// Known company names mapped to tickers
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

  // Try exact company name match first (case-insensitive)
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
  const isForeignIssuer = ticker === "NVO";

  const companyName = KNOWN_NAMES[ticker] ?? ticker;

  return {
    valid: true,
    ticker,
    companyName,
    cik,
    isForeignIssuer,
  };
}