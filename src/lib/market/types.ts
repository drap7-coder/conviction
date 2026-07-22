export interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dollarVolume: number | null;
  currency: string | null;
  marketState: string | null;
  marketCap: number | null;
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  sparkline: Array<{ date: string; close: number }>;
}
