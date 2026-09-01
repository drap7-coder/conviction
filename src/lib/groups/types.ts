/** Shared types for Institution → Group → Members → Competitions. */

export type InstitutionType =
  | "university"
  | "company"
  | "high_school"
  | "organization";

export type AffiliationStatus = "unofficial" | "official";

export type Institution = {
  id: string;
  name: string;
  slug: string;
  type: InstitutionType;
  /** Canonical domain, e.g. `wm.edu` — long-term identity / email association. */
  canonicalDomain: string | null;
  affiliationStatus: AffiliationStatus;
  /** Optional UI accent only — never official logos. */
  accentColor: string | null;
};

export type Group = {
  id: string;
  institutionId: string;
  name: string;
  /** Shareable invite token (unique). */
  inviteCode: string | null;
  /** Hex accent, e.g. `#115740` — optional theme preference. */
  primaryColor: string | null;
};

export type UserInstitutionMembership = {
  id: string;
  userId: string;
  institutionId: string;
  institution: Institution;
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
