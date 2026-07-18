export interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dollarVolume: number | null;
  currency: string | null;
  marketState: string | null;
  sparkline: Array<{ date: string; close: number }>;
}
