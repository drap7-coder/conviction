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
}

function crypto(ticker: string, name: string): MarketInstrument {
  return { ticker, name, kind: "crypto", tag: "Crypto" };
}

function etf(ticker: string, name: string, tag = "ETF"): MarketInstrument {
  return { ticker, name, kind: "etf", tag };
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

  // Major index proxies
  DIA: etf("DIA", "Dow 30", "Index"),
  SPY: etf("SPY", "S&P 500", "Index"),
  QQQ: etf("QQQ", "Nasdaq 100", "Index"),

  // U.S. market / style ETFs
  IWM: etf("IWM", "Russell 2000", "Index"),
  RSP: etf("RSP", "S&P 500 Equal Weight", "Index"),
  MDY: etf("MDY", "S&P MidCap 400", "Index"),
  SCHD: etf("SCHD", "U.S. Dividend 100", "ETF"),
  VNQ: etf("VNQ", "U.S. Real Estate", "ETF"),
  IYT: etf("IYT", "Transportation", "ETF"),
  UUP: etf("UUP", "U.S. Dollar", "ETF"),

  // Commodities
  USO: etf("USO", "Oil", "Commodity"),
  GLD: etf("GLD", "Gold", "Commodity"),
  SLV: etf("SLV", "Silver", "Commodity"),

  // International country ETFs
  EWJ: etf("EWJ", "Japan", "International"),
  MCHI: etf("MCHI", "China", "International"),
  EWU: etf("EWU", "United Kingdom", "International"),
  EWC: etf("EWC", "Canada", "International"),
  EWG: etf("EWG", "Germany", "International"),
  EWQ: etf("EWQ", "France", "International"),
  INDA: etf("INDA", "India", "International"),
  EWT: etf("EWT", "Taiwan", "International"),
  EWA: etf("EWA", "Australia", "International"),
  EWY: etf("EWY", "South Korea", "International"),
  EWH: etf("EWH", "Hong Kong", "International"),
  EWZ: etf("EWZ", "Brazil", "International"),
  EWW: etf("EWW", "Mexico", "International"),

  // S&P sector SPDRs (Pulse sectors heatmap)
  XLK: etf("XLK", "Technology", "Sector"),
  XLF: etf("XLF", "Financials", "Sector"),
  XLV: etf("XLV", "Healthcare", "Sector"),
  XLE: etf("XLE", "Energy", "Sector"),
  XLI: etf("XLI", "Industrials", "Sector"),
  XLY: etf("XLY", "Consumer Discretionary", "Sector"),
  XLP: etf("XLP", "Consumer Staples", "Sector"),
  XLU: etf("XLU", "Utilities", "Sector"),
  XLRE: etf("XLRE", "Real Estate", "Sector"),
  XLC: etf("XLC", "Communication Services", "Sector"),
  XLB: etf("XLB", "Materials", "Sector"),
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
