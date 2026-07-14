const PEER_TICKERS: Record<string, string[]> = {
  APLD: ["CRWV", "CORZ", "IREN"],
  IBM: ["ORCL", "MSFT", "ACN"],
  INTC: ["AMD", "NVDA", "QCOM"],
  GOOG: ["META", "MSFT", "AMZN"],
  OXY: ["XOM", "CVX", "COP"],
  PFE: ["MRK", "LLY", "JNJ"],
  NBIS: ["NVDA", "ORCL", "MSFT"],
};

export function getPeerTickers(ticker: string): string[] {
  return PEER_TICKERS[ticker.toUpperCase()] ?? [];
}
