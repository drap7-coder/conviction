/** Minimum scored members before a campus appears in ranked standings. */
export const MIN_RANKED_MEMBERS = 5;

/** Shared UI copy for the same eligibility rule used by standings scoring. */
export function communityRankingRequirementLabel(): string {
  return `needs ${MIN_RANKED_MEMBERS} members`;
}
