/**
 * One canonical community group per institution (private compatibility row).
 * Product surface is the institution itself — not Finance Club–style subgroups.
 * Legacy invite codes still resolve here so old links keep working.
 */

import type { Group } from "@/lib/groups/types";

/** One canonical community group per seeded school (matches institution name). */
export const SEED_GROUPS: Group[] = [
  {
    id: "group-wm",
    institutionId: "institution-wm",
    name: "William & Mary",
    inviteCode: "wm",
    primaryColor: "#115740",
    isCanonicalCommunity: true,
  },
  {
    id: "group-rpi",
    institutionId: "institution-rpi",
    name: "Rensselaer Polytechnic Institute",
    inviteCode: "rpi",
    primaryColor: "#D6001C",
    isCanonicalCommunity: true,
  },
];

/**
 * Old club / class invite tokens → canonical W&M community.
 * Kept so production invite links never 404 after the flatten.
 */
export const LEGACY_INVITE_ALIASES: Record<string, string> = {
  wm: "group-wm",
  "wm-campus": "group-wm",
  "wm-2028": "group-wm",
  "wm-finance": "group-wm",
  "wm-charlottes": "group-wm",
  "wm-sept": "group-wm",
  "wm-kkg": "group-wm",
  "group-seed-wm": "group-wm",
  "group-wm-class-2028": "group-wm",
  "group-wm-finance": "group-wm",
  "group-wm-charlottes": "group-wm",
  "group-wm-sept-challenge": "group-wm",
  "group-wm-kkg": "group-wm",
};

/** Map crowd-seed book ids → canonical community group for demo Crowd filters. */
export const SEED_BOOK_GROUP_IDS: Record<string, string[]> = {
  "crowd-seed-01": ["group-wm"],
  "crowd-seed-02": ["group-wm"],
  "crowd-seed-03": ["group-rpi"],
  "crowd-seed-04": ["group-rpi"],
  "crowd-seed-05": ["group-wm"],
  "crowd-seed-06": ["group-rpi"],
  "crowd-seed-07": ["group-wm"],
  "crowd-seed-08": ["group-rpi"],
  "crowd-seed-09": ["group-wm"],
  "crowd-seed-10": ["group-rpi"],
};

export function findSeedGroupById(id: string): Group | null {
  const canonicalId = LEGACY_INVITE_ALIASES[id] ?? id;
  return SEED_GROUPS.find((group) => group.id === canonicalId) ?? null;
}

export function findSeedGroupByInviteCode(code: string): Group | null {
  const normalized = code.trim().toLowerCase();
  const canonicalId = LEGACY_INVITE_ALIASES[normalized];
  if (canonicalId) return findSeedGroupById(canonicalId);
  return SEED_GROUPS.find((group) => group.inviteCode === normalized) ?? null;
}

export function listSeedCanonicalCommunities(): Group[] {
  return SEED_GROUPS.filter((group) => group.isCanonicalCommunity);
}

export function getCanonicalSeedGroupForInstitution(institutionId: string): Group | null {
  return (
    SEED_GROUPS.find(
      (group) => group.institutionId === institutionId && group.isCanonicalCommunity,
    ) ?? null
  );
}
