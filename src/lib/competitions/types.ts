export type CompetitionStatus = "open" | "live" | "final" | "archived";

export type Competition = {
  id: string;
  groupAId: string;
  groupBId: string;
  periodStart: string;
  periodEnd: string;
  status: CompetitionStatus;
  metric: "avg_pct_return";
  lockedAt: string | null;
  winnerGroupId: string | null;
};

export type CompetitionPick = {
  id: string;
  competitionId: string;
  userId: string;
  groupId: string;
  ticker: string;
  startPrice: number | null;
  currentPrice: number | null;
  finalPrice: number | null;
  returnPct: number | null;
  submittedAt: string;
  lockedAt: string | null;
};

export type CompetitionGroupSide = {
  groupId: string;
  name: string;
  primaryColor: string | null;
  domain?: string | null;
  ncaaId?: string | null;
  accentColor?: string | null;
  avgReturnPct: number | null;
  pickCount: number;
};

/** School option for H2H dropdowns (no live scores). */
export type HeadToHeadSchoolOption = {
  groupId: string;
  name: string;
  primaryColor: string | null;
  domain?: string | null;
  ncaaId?: string | null;
  accentColor?: string | null;
};

export type CompetitionViewerState =
  | { kind: "guest" }
  | { kind: "not_member"; message: string }
  | { kind: "can_submit"; groupId: string; existingTicker?: string | null }
  | { kind: "locked_pick"; ticker: string; returnPct: number | null; groupId: string };

export type HeadToHeadPayload = {
  available: boolean;
  competition: Competition | null;
  groupA: CompetitionGroupSide | null;
  groupB: CompetitionGroupSide | null;
  statusLabel: string;
  viewer: CompetitionViewerState;
  /** Communities available in the school dropdowns. */
  schools: HeadToHeadSchoolOption[];
  /** Viewer's primary community group id when signed in + joined. */
  viewerPrimaryGroupId: string | null;
};
