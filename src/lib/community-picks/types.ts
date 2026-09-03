import type { H2HPerfRange } from "@/lib/competitions/perf-range";
import type { CallSlot } from "@/lib/community-picks/call-slots";

export type CommunityPickHistoryEntry = {
  callSlot: CallSlot;
  /** User-facing identity (ticker or BITCOIN/GOLD/INDIA/…). */
  assetId: string;
  /** Pricing symbol used for the closed leg. */
  pricingSymbol: string;
  startSpot: number;
  exitSpot: number;
  pickReturnPct: number;
  startedAt: string;
  closedAt: string;
};

export type CommunityPick = {
  callSlot: CallSlot;
  /** User-facing identity (NVDA, BITCOIN, INDIA, …). */
  assetId: string;
  /** Yahoo pricing symbol (may differ for macro slots). */
  pricingSymbol: string;
  /** Display label (Bitcoin, India, or ticker). */
  label: string;
  /** Active-leg entry spot (server-derived at pick start). */
  entryPrice: number;
  currentPrice: number | null;
  /** Return on the current ticker leg only. */
  activeReturnPct: number | null;
  /** Banked + active compounded lifetime return. */
  lifetimeReturnPct: number | null;
  bankedGrowthFactor: number;
  pickedAt: string;
};

export type CommunityPickGroup = {
  groupId: string;
  name: string;
  primaryColor: string | null;
  domain?: string | null;
  ncaaId?: string | null;
  accentColor?: string | null;
};

export type CommunityStanding = CommunityPickGroup & {
  /** Leaderboard-eligible (completed) members contributing to the average. */
  pickCount: number;
  /** Equal-weight average IQBulls period return over the selected window. */
  avgReturnPct: number | null;
  /** False when pickCount is below MIN_RANKED_MEMBERS. */
  ranked: boolean;
};

export type CommunityPicksPayload = {
  authenticated: boolean;
  viewerGroup: CommunityPickGroup | null;
  /** @deprecated Prefer viewerPicks — STOCK_1 or first filled for older clients. */
  viewerPick: CommunityPick | null;
  viewerPicks: Partial<Record<CallSlot, CommunityPick>>;
  /** Filled call count (0–5). */
  filledCount: number;
  /** True when all five calls are established. */
  boardComplete: boolean;
  /** Average lifetime return across filled calls (null if none). */
  iqbullsReturnPct: number | null;
  /** Official individual leaderboard eligibility (requires complete board). */
  leaderboardEligible: boolean;
  pickHistory: CommunityPickHistoryEntry[];
  standings: CommunityStanding[];
  /** Performance window used for standings avgReturnPct (default 1w). */
  range: H2HPerfRange;
};

export type SwapPickResult = {
  pick: CommunityPick;
  viewerPicks: Partial<Record<CallSlot, CommunityPick>>;
  filledCount: number;
  boardComplete: boolean;
  iqbullsReturnPct: number | null;
  leaderboardEligible: boolean;
  pickHistory: CommunityPickHistoryEntry[];
};
