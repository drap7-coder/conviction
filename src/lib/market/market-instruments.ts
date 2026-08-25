/**
 * Non-equity market instruments shown on Pulse (crypto, index/sector ETFs, etc.).
 * They get a light detail page (price / chart / news / gauges) but no SEC conviction stack.
 */

export type MarketInstrumentKind = "crypto" | "etf";

export interface MarketInstrument {
  ticker: string;
  name: string;
  kind: MarketInstrumentKind;
  /** Short header tag on the light detail page. */
  tag: string;
  /** Portfolio Mix bucket when a fund has no single company sector. */
  portfolioExposure: string;
}

function crypto(ticker: string, name: string): MarketInstrument {
  return { ticker, name, kind: "crypto", tag: "Crypto", portfolioExposure: "Crypto" };
}

function etf(
  ticker: string,
  name: string,
  tag = "ETF",
  portfolioExposure = "Other ETF",
): MarketInstrument {
  return { ticker, name, kind: "etf", tag, portfolioExposure };
}

/**
 * Pulse heatmap + indicator proxies that are not SEC equity issuers (or
 * should not depend on SEC company_tickers to open a detail page).
 */
const MARKET_INSTRUMENTS: Record<string, MarketInstrument> = {
  // Crypto
  "BTC-USD": crypto("BTC-USD", "Bitcoin"),
  "ETH-USD": crypto("ETH-USD", "Ethereum"),
  "SOL-USD": crypto("SOL-USD", "Solana"),
  "XRP-USD": crypto("XRP-USD", "XRP"),
  "DOGE-USD": crypto("DOGE-USD", "Dogecoin"),
  "ADA-USD": crypto("ADA-USD", "Cardano"),

  // Major index proxies
  DIA: etf("DIA", "Dow Jones Industrial Average", "Index", "U.S. Equity"),
  SPY: etf("SPY", "S&P 500", "Index", "U.S. Equity"),
  QQQ: etf("QQQ", "Nasdaq 100", "Index", "U.S. Equity"),

  // U.S. market / style ETFs
  IWM: etf("IWM", "Russell 2000", "Index", "U.S. Equity"),
  RSP: etf("RSP", "S&P 500 Equal Weight", "Index", "U.S. Equity"),
  MDY: etf("MDY", "S&P MidCap 400", "Index", "U.S. Equity"),
  SCHD: etf("SCHD", "U.S. Dividend 100", "ETF", "U.S. Equity"),
  VNQ: etf("VNQ", "U.S. Real Estate", "ETF", "Real Estate"),
  IYT: etf("IYT", "Transportation", "ETF", "Industrials"),
  UUP: etf("UUP", "U.S. Dollar", "ETF", "Currency"),
  VTI: etf("VTI", "Total Stock Market", "ETF", "U.S. Equity"),
  VXUS: etf("VXUS", "Total International Stock", "International", "International Equity"),
  BND: etf("BND", "Total Bond Market", "Bond", "Fixed Income"),
  SGOV: etf("SGOV", "0–3 Month Treasury", "Cash", "Cash"),

  // Treasuries (All-Weather / rates proxies)
  TLT: etf("TLT", "20+ Year Treasury", "Bond", "Fixed Income"),
  IEF: etf("IEF", "7–10 Year Treasury", "Bond", "Fixed Income"),

  // Commodities
  USO: etf("USO", "Crude Oil", "Commodity", "Commodities"),
  GLD: etf("GLD", "Gold", "Commodity", "Commodities"),
  SLV: etf("SLV", "Silver", "Commodity", "Commodities"),
  UNG: etf("UNG", "Natural Gas", "Commodity", "Commodities"),
  DBC: etf("DBC", "Broad Commodities", "Commodity", "Commodities"),

  // International country ETFs (six-country Pulse set)
  EWJ: etf("EWJ", "Japan", "International", "International Equity"),
  MCHI: etf("MCHI", "China", "International", "International Equity"),
  EWU: etf("EWU", "United Kingdom", "International", "International Equity"),
  INDA: etf("INDA", "India", "International", "International Equity"),
  EWT: etf("EWT", "Taiwan", "International", "International Equity"),
  EWG: etf("EWG", "Germany", "International", "International Equity"),

  // S&P sector SPDRs (Pulse sectors heatmap)
  XLK: etf("XLK", "Technology", "Sector", "Technology"),
  XLF: etf("XLF", "Financials", "Sector", "Financials"),
  XLV: etf("XLV", "Healthcare", "Sector", "Health Care"),
  XLE: etf("XLE", "Energy", "Sector", "Energy"),
  XLI: etf("XLI", "Industrials", "Sector", "Industrials"),
  XLY: etf("XLY", "Consumer Discretionary", "Sector", "Consumer Discretionary"),
  XLP: etf("XLP", "Consumer Staples", "Sector", "Consumer Staples"),
  XLU: etf("XLU", "Utilities", "Sector", "Utilities"),
  XLRE: etf("XLRE", "Real Estate", "Sector", "Real Estate"),
  XLC: etf("XLC", "Communication Services", "Sector", "Communication Services"),
  XLB: etf("XLB", "Materials", "Sector", "Materials"),
};

export function getMarketInstrument(ticker: string): MarketInstrument | null {
  const cleaned = ticker.trim().toUpperCase();
  return MARKET_INSTRUMENTS[cleaned] ?? null;
}

export function listMarketInstruments(): MarketInstrument[] {
  return Object.values(MARKET_INSTRUMENTS);
}

/** Ownership / insider / short-interest conviction stack requires an SEC issuer. */
export function supportsConvictionSignals(ticker: string): boolean {
  return getMarketInstrument(ticker) == null && !ticker.trim().startsWith("^");
}
