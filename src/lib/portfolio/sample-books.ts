import type { PersistedPosition } from "@/lib/portfolio/persist";

export type SampleBook = {
  id: string;
  label: string;
  description: string;
  positions: PersistedPosition[];
};

/**
 * Theme sample books aligned with Pulse narrative themes.
 * Clickable starters for an empty Portfolio (localStorage only).
 */
export const SAMPLE_PORTFOLIO_BOOKS: SampleBook[] = [
  {
    id: "ai-compute",
    label: "AI + Compute",
    description: "Mega-cap AI and semiconductor names",
    positions: [
      { ticker: "NVDA", shares: 10 },
      { ticker: "AMD", shares: 20 },
      { ticker: "AVGO", shares: 5 },
      { ticker: "MSFT", shares: 8 },
      { ticker: "GOOG", shares: 10 },
    ],
  },
  {
    id: "rates-fed",
    label: "Dividend Income",
    description: "Dividends, real estate, and transports",
    positions: [
      { ticker: "SCHD", shares: 40 },
      { ticker: "VNQ", shares: 25 },
      { ticker: "IYT", shares: 15 },
    ],
  },
  {
    id: "energy-oil",
    label: "Energy + Metals",
    description: "Oil, producers, and precious metals",
    positions: [
      { ticker: "XLE", shares: 20 },
      { ticker: "XOM", shares: 15 },
      { ticker: "CVX", shares: 12 },
      { ticker: "GLD", shares: 8 },
    ],
  },
  {
    id: "crypto-liquidity",
    label: "Crypto",
    description: "Bitcoin, Ethereum, and Solana",
    positions: [
      { ticker: "BTC-USD", shares: 0.25 },
      { ticker: "ETH-USD", shares: 2 },
      { ticker: "SOL-USD", shares: 20 },
    ],
  },
  {
    id: "trade-supply",
    label: "Global",
    description: "China, Japan, and Taiwan exposure",
    positions: [
      { ticker: "MCHI", shares: 30 },
      { ticker: "EWJ", shares: 25 },
      { ticker: "EWT", shares: 25 },
    ],
  },
  {
    id: "consumer-demand",
    label: "Sector Leadership",
    description: "Tech, discretionary, and financials",
    positions: [
      { ticker: "XLK", shares: 20 },
      { ticker: "XLY", shares: 20 },
      { ticker: "XLF", shares: 25 },
    ],
  },
];
