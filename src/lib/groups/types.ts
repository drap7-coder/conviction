/** Shared types for multi-group membership and competitions. */

export type GroupType = "school" | "org";

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  /** Hex accent, e.g. `#115740` — optional. */
  primaryColor: string | null;
};

export type UserGroupMembership = {
  id: string;
  userId: string;
  groupId: string;
  isPrimary: boolean;
  group: Group;
};

export type CompetitionMetric = "avg_pct_return";

export type Competition = {
  id: string;
  groupAId: string;
  groupBId: string;
  periodStart: string;
  periodEnd: string;
  metric: CompetitionMetric;
};

export type CompetitionPick = {
  id: string;
  competitionId: string;
  userId: string;
  groupId: string;
  ticker: string;
  submittedAt: string;
  updatedAt: string;
};

export type CompetitionSideStats = {
  groupId: string;
  groupName: string;
  primaryColor: string | null;
  /** Average % return across members who submitted a pick — never padded with 0s. */
  avgPctReturn: number | null;
  pickCount: number;
};

export type CompetitionStanding = {
  competition: Competition;
  groupA: CompetitionSideStats;
  groupB: CompetitionSideStats;
  /** Explicit tie when both sides have picks and averages match within epsilon. */
  isTie: boolean;
  leaderGroupId: string | null;
  msRemaining: number;
  picksLocked: boolean;
};
