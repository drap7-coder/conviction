/**
 * Shared types for communities (one layer).
 *
 * Product: Platform → Community (school/company) → Members → Portfolios
 * DB retains Institution + Group tables; each community has one canonical
 * group row for membership/Crowd scoping. Subgroup/competition tables stay
 * dormant for future compatibility — not exposed in the product.
 */

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
  ncaaId: string | null;
  conference: string | null;
  /** Active community — false means directory-only until first join. */
  communityEnabled: boolean;
};

/** Private compatibility row — one per institution in the one-community product. */
export type Group = {
  id: string;
  institutionId: string;
  name: string;
  inviteCode: string | null;
  primaryColor: string | null;
  /** True for the single public community record under an institution. */
  isCanonicalCommunity?: boolean;
};

/** Public community = institution + its canonical group handle. */
export type Community = {
  institution: Institution;
  /** Canonical group id used for Crowd membership scoping. */
  groupId: string;
  inviteCode: string | null;
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

export type UserCommunityMembership = {
  institutionId: string;
  groupId: string;
  institution: Institution;
  primaryColor: string | null;
  isPrimary: boolean;
};
