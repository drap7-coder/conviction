/**
 * ── Shared Display Types ──
 *
 * Normalized model consumed by Watchlist, Trending, and Market Pulse.
 * No surface-specific computation happens outside this module.
 *
 * Every view constructs a SecurityCardModel from canonical data sources
 * (ConvictionSnapshot, StockQuote, WatchlistEntry, portfolio state, etc.)
 * and passes it to shared presentation primitives.
 */

// ── Quote freshness ──

export type Freshness =
  | "live"       // updated within the last 60s
  | "recent"     // updated within the last 5m
  | "delayed"    // provider explicitly delayed
  | "stale"      // data older than threshold
  | "unavailable";

// ── Market session ──

export type DisplaySession =
  | "regular"
  | "pre-market"
  | "after-hours"
  | "closed"
  | "unknown";

// ── Quote display model ──

export interface QuoteDisplay {
  currentPrice: number | null;
  previousClose: number | null;
  dayChangeAmount: number | null;
  dayChangePercent: number | null;
  extendedHoursPrice: number | null;
  extendedHoursChangePercent: number | null;
  session: DisplaySession;
  sessionLabel: string | null; // "Pre-Market" | "After Hours" | null
  updatedAt: string | null;
  freshness: Freshness;
}

// ── Conviction display model ──

export type ConvictionState =
  | "strong"
  | "mixed"
  | "weak"
  | "awaiting"
  | "unsupported"
  | "error";

export interface ConvictionDisplay {
  state: ConvictionState;
  label: string;        // e.g. "Strong" | "Mixed" | "Weak" | "Awaiting Evidence"
  tone: "positive" | "negative" | "contested" | "quiet";
}

// ── Chart display model ──

export interface ChartPoint {
  timestamp: string;
  value: number;
}

export interface ChartEvent {
  id: string;
  timestamp: string;
  type: "earnings" | "news" | "institutional" | "other";
  label: string;
}

export interface ChartDisplay {
  points: ChartPoint[];
  range: "1D" | "5D" | "1M" | null;
  direction: "positive" | "negative" | "neutral";
  events: ChartEvent[];
}

// ── Evidence summary ──

export type SummaryCategory =
  | "portfolio"
  | "institutional"
  | "earnings"
  | "news"
  | "political"
  | "insider"
  | "technical"
  | "none";

export interface SecurityCardSummary {
  headline: string;
  category: SummaryCategory;
  significance: "high" | "medium" | "low";
  updatedAt: string | null;
  sourceCount?: number;
}

// ── Supporting fact ──

export type FactCategory =
  | "portfolio"
  | "institutional"
  | "earnings"
  | "news"
  | "political"
  | "insider"
  | "technical";

export interface SecurityCardFact {
  id: string;
  label: string;
  category: FactCategory;
  significance: "high" | "medium" | "low";
  href?: string;
}

// ── Portfolio context ──

export interface PortfolioContext {
  isHeld: boolean;
  weightPercent: number | null;
  dayContributionAmount: number | null;
  relevanceLabel: string | null;
}

// ── Top-level canonical card model ──

export interface SecurityCardModel {
  ticker: string;
  companyName: string | null;
  quote: QuoteDisplay;
  conviction: ConvictionDisplay;
  chart: ChartDisplay;
  summary: SecurityCardSummary;
  supportingFacts: SecurityCardFact[];
  portfolioContext: PortfolioContext | null;
  destinationHref: string;
}
