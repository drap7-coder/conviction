import type { H2HPerfRange } from "@/lib/competitions/perf-range";

export type CommunityPickHistoryEntry = {
  ticker: string;
  startSpot: number;
  exitSpot: number;
  pickReturnPct: number;
  startedAt: string;
  closedAt: string;
};

export type CommunityPick = {
  ticker: string;
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
  /** Members with a valid submitted pick contributing to the average. */
  pickCount: number;
  /** Equal-weight average My Pick return over the selected performance window. */
  avgReturnPct: number | null;
  /** False when pickCount is below MIN_RANKED_MEMBERS. */
  ranked: boolean;
};

export type CommunityPicksPayload = {
  authenticated: boolean;
  viewerGroup: CommunityPickGroup | null;
  viewerPick: CommunityPick | null;
  pickHistory: CommunityPickHistoryEntry[];
  standings: CommunityStanding[];
  /** Performance window used for standings avgReturnPct (default ytd). */
  range: H2HPerfRange;
};

export type SwapPickResult = {
  pick: CommunityPick;
  pickHistory: CommunityPickHistoryEntry[];
};
