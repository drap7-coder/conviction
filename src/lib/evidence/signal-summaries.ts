export type SignalDirection = "pos" | "neg" | "neutral";

export interface TickerSignalSummary {
  ticker: string;
  text: string;
  cardText: string;
  badge: string;
  direction: SignalDirection;
  supportCount?: number;
  contraCount?: number;
  strength?: number;
}

export const TICKER_SIGNAL_SUMMARIES: TickerSignalSummary[] = [
  {
    ticker: "INTC",
    text: "2 new positions and 1 increase",
    cardText: "2 big funds opened new stakes and 1 added shares.",
    badge: "Funds buying",
    direction: "pos",
    supportCount: 3,
    strength: 0.78,
  },
  {
    ticker: "GOOG",
    text: "2 new fund positions",
    cardText: "2 big funds opened new positions.",
    badge: "New fund stakes",
    direction: "pos",
    supportCount: 2,
    strength: 0.72,
  },
  {
    ticker: "OXY",
    text: "D. E. Shaw increased shares",
    cardText: "D. E. Shaw bought more common shares.",
    badge: "Fund adding",
    direction: "pos",
    supportCount: 1,
    strength: 0.68,
  },
  {
    ticker: "PFE",
    text: "2 managers increased holdings",
    cardText: "2 big funds increased their holdings.",
    badge: "Funds buying",
    direction: "pos",
    supportCount: 2,
    strength: 0.72,
  },
  {
    ticker: "NBIS",
    text: "Bridgewater increased shares",
    cardText: "Bridgewater bought more common shares.",
    badge: "Fund adding",
    direction: "pos",
    supportCount: 1,
    strength: 0.68,
  },
];

export const SYSTEM_SIGNAL_SUMMARIES: TickerSignalSummary[] = [
  {
    ticker: "13F",
    text: "15 institutional managers tracked",
    cardText: "Activity across 15 large institutional managers we track.",
    badge: "Tracked universe",
    direction: "neutral",
  },
  {
    ticker: "SEC",
    text: "Share changes, not market-value moves",
    cardText: "We follow share-count changes, not paper market-value moves.",
    badge: "Share-based",
    direction: "neutral",
  },
  {
    ticker: "QA",
    text: "Options and ambiguous share classes excluded",
    cardText: "Options and ambiguous share classes are left out.",
    badge: "Clean common shares",
    direction: "neutral",
  },
];

export function getTickerSignalSummary(ticker: string): TickerSignalSummary | null {
  const upperTicker = ticker.toUpperCase();
  return TICKER_SIGNAL_SUMMARIES.find((summary) => summary.ticker === upperTicker) ?? null;
}
