/**
 * Relevance / search aliases for ETFs, indexes, and crypto that rarely
 * appear as bare tickers in headlines (e.g. BTC-USD → Bitcoin).
 */

export interface MarketInstrumentAlias {
  /** Extra phrases that count as company-relevant in headlines */
  patterns: RegExp;
  /** Google News / search query when Yahoo RSS is off-topic */
  searchQuery: string;
}

const ALIASES: Record<string, MarketInstrumentAlias> = {
  SPY: {
    patterns: /\b(?:spy|s&p\s*500|s&amp;p\s*500|standard\s*&\s*poor)/i,
    searchQuery: 'SPY OR "S&P 500"',
  },
  QQQ: {
    patterns: /\b(?:qqq|nasdaq(?:-|\s*)100|nasdaq)\b/i,
    searchQuery: 'QQQ OR "Nasdaq 100"',
  },
  DIA: {
    patterns: /\b(?:dia|dow\s*jones|dow\s*30|djia)\b/i,
    searchQuery: 'DIA OR "Dow Jones" OR DJIA',
  },
  IWM: {
    patterns: /\b(?:iwm|russell\s*2000|small\s*cap)\b/i,
    searchQuery: 'IWM OR "Russell 2000"',
  },
  RSP: {
    patterns: /\b(?:rsp|equal[- ]weight)\b/i,
    searchQuery: 'RSP OR "equal weight S&P"',
  },
  USO: {
    patterns: /\b(?:uso|crude|wti|brent|oil\s*price|oil\s*prices)\b/i,
    searchQuery: 'USO OR crude oil OR WTI',
  },
  GLD: {
    patterns: /\b(?:gld|gold\s*price|gold\s*prices|bullion)\b/i,
    searchQuery: 'GLD OR "gold price" OR bullion',
  },
  SLV: {
    patterns: /\b(?:slv|silver\s*price|silver\s*prices)\b/i,
    searchQuery: 'SLV OR "silver price"',
  },
  UUP: {
    patterns: /\b(?:uup|u\.?s\.?\s*dollar|dollar\s*index|dxy)\b/i,
    searchQuery: 'UUP OR "US dollar" OR DXY',
  },
  "BTC-USD": {
    patterns: /\b(?:btc(?:-usd)?|bitcoin)\b/i,
    searchQuery: "Bitcoin OR BTC",
  },
  "ETH-USD": {
    patterns: /\b(?:eth(?:-usd)?|ethereum)\b/i,
    searchQuery: "Ethereum OR ETH",
  },
  "SOL-USD": {
    patterns: /\b(?:sol(?:-usd)?|solana)\b/i,
    searchQuery: "Solana OR SOL crypto",
  },
  // Sector ETFs commonly used on Pulse Industries
  XLK: { patterns: /\b(?:xlk|technology\s*sector|tech\s*sector)\b/i, searchQuery: "XLK OR technology sector ETF" },
  XLF: { patterns: /\b(?:xlf|financials?\s*sector|bank\s*stocks)\b/i, searchQuery: "XLF OR financials sector" },
  XLE: { patterns: /\b(?:xle|energy\s*sector)\b/i, searchQuery: "XLE OR energy sector ETF" },
  XLY: { patterns: /\b(?:xly|consumer\s*discretionary)\b/i, searchQuery: 'XLY OR "consumer discretionary"' },
  XLP: { patterns: /\b(?:xlp|consumer\s*staples)\b/i, searchQuery: 'XLP OR "consumer staples"' },
  XLV: { patterns: /\b(?:xlv|health\s*care\s*sector|healthcare\s*sector)\b/i, searchQuery: "XLV OR healthcare sector ETF" },
  XLI: { patterns: /\b(?:xli|industrials?\s*sector)\b/i, searchQuery: "XLI OR industrials sector" },
  XLC: { patterns: /\b(?:xlc|communication\s*services)\b/i, searchQuery: 'XLC OR "communication services"' },
  XLU: { patterns: /\b(?:xlu|utilities\s*sector)\b/i, searchQuery: "XLU OR utilities sector ETF" },
  XLRE: { patterns: /\b(?:xlre|real\s*estate\s*sector)\b/i, searchQuery: 'XLRE OR "real estate" sector ETF' },
  XLB: { patterns: /\b(?:xlb|materials\s*sector)\b/i, searchQuery: "XLB OR materials sector ETF" },
  MCHI: { patterns: /\b(?:mchi|china\s*etf|chinese\s*stocks)\b/i, searchQuery: "MCHI OR China ETF" },
  EWJ: { patterns: /\b(?:ewj|japan\s*etf|nikkei)\b/i, searchQuery: "EWJ OR Japan ETF OR Nikkei" },
  EWT: { patterns: /\b(?:ewt|taiwan\s*etf)\b/i, searchQuery: "EWT OR Taiwan ETF" },
};

export function getMarketInstrumentAlias(ticker: string): MarketInstrumentAlias | null {
  return ALIASES[ticker.trim().toUpperCase()] ?? null;
}

export function matchesMarketInstrumentAlias(text: string, ticker: string): boolean {
  const alias = getMarketInstrumentAlias(ticker);
  if (!alias) return false;
  return alias.patterns.test(text);
}
