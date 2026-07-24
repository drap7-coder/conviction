/**
 * ── Shared Display Index ──
 *
 * Barrel export for all display-layer types, utilities, and components.
 */

// Types
export type {
  Freshness,
  DisplaySession,
  QuoteDisplay,
  ConvictionState,
  ConvictionDisplay,
  ThesisDisplay,
  ChartPoint,
  ChartEvent,
  ChartDisplay,
  SummaryCategory,
  SecurityCardSummary,
  FactCategory,
  SecurityCardFact,
  PortfolioContext,
  SecurityCardModel,
} from "./types";

// Formatting
export {
  isFiniteNumber,
  safeFinite,
  fmtCurrency,
  fmtCompactCurrency,
  fmtPercent,
  fmtPct1,
  fmtPrice,
  fmtDollarPrice,
  fmtSignedDollar,
  fmtMarketCap,
  fmtWeight,
  fmtInteger,
  fmtDate,
  fmtShortDate,
  classifyFreshness,
  fmtFreshness,
} from "./format";

// Summary engine
export { selectSummary, selectSupportingFacts } from "./summary";

// Deduplication
export { normalizeTicker, deduplicateByTicker, countDuplicates } from "./dedup";
