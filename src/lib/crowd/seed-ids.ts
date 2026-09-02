/** Prefix for synthetic Crowd seed user ids (not real accounts). */
export const CROWD_SEED_ID_PREFIX = "crowd-seed-";

export function isCrowdSeedUserId(userId: string): boolean {
  return userId.startsWith(CROWD_SEED_ID_PREFIX);
}
