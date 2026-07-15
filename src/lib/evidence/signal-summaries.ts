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
    text: "2 new positions and 1 increase detected",
    cardText: "2 new tracked-manager positions and 1 increase detected.",
    badge: "13F: accumulating",
    direction: "pos",
    supportCount: 3,
    strength: 0.78,
  },
  {
    ticker: "GOOG",
    text: "2 new positions among tracked managers",
    cardText: "2 tracked managers opened positions.",
    badge: "13F: new positions",
    direction: "pos",
    supportCount: 2,
    strength: 0.72,
  },
  {
    ticker: "OXY",
    text: "D. E. Shaw increased common shares",
    cardText: "D. E. Shaw increased common shares.",
    badge: "13F: accumulating",
    direction: "pos",
    supportCount: 1,
    strength: 0.68,
  },
  {
    ticker: "PFE",
    text: "2 managers increased holdings",
    cardText: "2 tracked managers increased holdings.",
    badge: "13F: accumulating",
    direction: "pos",
    supportCount: 2,
    strength: 0.72,
  },
  {
    ticker: "NBIS",
    text: "Bridgewater increased common shares",
    cardText: "Bridgewater increased common shares.",
    badge: "13F: accumulating",
    direction: "pos",
    supportCount: 1,
    strength: 0.68,
  },
];

export const SYSTEM_SIGNAL_SUMMARIES: TickerSignalSummary[] = [
  {
    ticker: "13F",
    text: "15 tracked institutional managers",
    cardText: "Activity among 15 tracked institutional managers.",
    badge: "Tracked universe",
    direction: "neutral",
  },
  {
    ticker: "SEC",
    text: "Share changes, not market-value moves",
    cardText: "Conviction uses share changes, not market-value moves.",
    badge: "Share-based",
    direction: "neutral",
  },
  {
    ticker: "QA",
    text: "Options and ambiguous share classes excluded",
    cardText: "Options and ambiguous share classes are excluded.",
    badge: "Clean common shares",
    direction: "neutral",
  },
];

export function getTickerSignalSummary(ticker: string): TickerSignalSummary | null {
  const upperTicker = ticker.toUpperCase();
  return TICKER_SIGNAL_SUMMARIES.find((summary) => summary.ticker === upperTicker) ?? null;
}
