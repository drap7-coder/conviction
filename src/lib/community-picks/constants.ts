/** Minimum scored members before a campus appears in ranked standings. */
export const MIN_RANKED_MEMBERS = 5;

/** Shared UI copy for the same eligibility rule used by standings scoring. */
export function communityRankingRequirementLabel(): string {
  return `needs ${MIN_RANKED_MEMBERS} members`;
}

/** Ops status pill for campus node readiness (H2H + standings). */
export function campusNodeStatusPill(
  pickCount: number,
  minMembers: number = MIN_RANKED_MEMBERS,
): { label: string; tone: "active" | "syncing" | "idle" } {
  const nodes = Math.max(0, Math.floor(pickCount));
  if (nodes >= minMembers) {
    return { label: "ACTIVE SYNDICATE", tone: "active" };
  }
  if (nodes <= 0) {
    return { label: `SYNCING: 0/${minMembers} NODES`, tone: "idle" };
  }
  return { label: `SYNCING: ${nodes}/${minMembers} NODES`, tone: "syncing" };
}
