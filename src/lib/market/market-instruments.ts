/**
 * Non-equity market instruments shown on Pulse (crypto, etc.).
 * They get a light detail page (price / chart / news) but no SEC conviction signals.
 */

export type MarketInstrumentKind = "crypto";

export interface MarketInstrument {
  ticker: string;
  name: string;
  kind: MarketInstrumentKind;
}

const MARKET_INSTRUMENTS: Record<string, MarketInstrument> = {
  "BTC-USD": { ticker: "BTC-USD", name: "Bitcoin", kind: "crypto" },
  "ETH-USD": { ticker: "ETH-USD", name: "Ethereum", kind: "crypto" },
  "SOL-USD": { ticker: "SOL-USD", name: "Solana", kind: "crypto" },
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
