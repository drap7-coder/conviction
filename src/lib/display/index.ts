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

export type {
  EvidenceStrength,
  EvidenceStrengthTone,
  ThesisStatusVocab,
  UserPriority,
  SourceBadge,
} from "./vocabulary";

export {
  EVIDENCE_STRENGTH_LABEL,
  EVIDENCE_STRENGTH_TONE,
  THESIS_STATUS_LABEL,
  USER_PRIORITY_LABEL,
  SOURCE_BADGE_LABEL,
  sourceBadgeLabel,
  evidenceStrengthFromCounts,
} from "./vocabulary";

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
