/**
 * User-created-style groups under canonical institutions.
 * Guest mode + first Neon bootstrap. Names are free-form under an institution.
 */

import type { Group } from "@/lib/groups/types";

/** Groups nested under William & Mary (institution-wm). */
export const SEED_GROUPS: Group[] = [
  {
    id: "group-wm-class-2028",
    institutionId: "institution-wm",
    name: "Class of 2028",
    inviteCode: "wm-2028",
    primaryColor: "#115740",
  },
  {
    id: "group-wm-finance",
    institutionId: "institution-wm",
    name: "Finance Club",
    inviteCode: "wm-finance",
    primaryColor: "#0D7377",
  },
  {
    id: "group-wm-charlottes",
    institutionId: "institution-wm",
    name: "Charlotte's Friends",
    inviteCode: "wm-charlottes",
    primaryColor: "#2E5A88",
  },
  {
    id: "group-wm-sept-challenge",
    institutionId: "institution-wm",
    name: "September Stock Challenge",
    inviteCode: "wm-sept",
    primaryColor: "#C45C26",
  },
  {
    id: "group-wm-kkg",
    institutionId: "institution-wm",
    name: "KKG Investment Competition",
    inviteCode: "wm-kkg",
    primaryColor: "#5B2C6F",
  },
];

/** Map crowd-seed book ids → group memberships for demo Crowd filters. */
export const SEED_BOOK_GROUP_IDS: Record<string, string[]> = {
  "crowd-seed-01": ["group-wm-class-2028", "group-wm-kkg"],
  "crowd-seed-02": ["group-wm-finance"],
  "crowd-seed-03": ["group-wm-charlottes"],
  "crowd-seed-04": ["group-wm-sept-challenge", "group-wm-finance"],
  "crowd-seed-05": ["group-wm-class-2028"],
  "crowd-seed-06": ["group-wm-kkg"],
  "crowd-seed-07": ["group-wm-sept-challenge"],
  "crowd-seed-08": ["group-wm-charlottes", "group-wm-kkg"],
  "crowd-seed-09": ["group-wm-finance", "group-wm-sept-challenge"],
  "crowd-seed-10": ["group-wm-class-2028", "group-wm-finance"],
};

export function findSeedGroupByName(
  name: string,
  institutionId?: string,
): Group | null {
  return (
    SEED_GROUPS.find(
      (group) =>
        group.name === name &&
        (!institutionId || group.institutionId === institutionId),
    ) ?? null
  );
}

export function findSeedGroupByInviteCode(code: string): Group | null {
  const normalized = code.trim().toLowerCase();
  return SEED_GROUPS.find((group) => group.inviteCode === normalized) ?? null;
}

export function findSeedGroupById(id: string): Group | null {
  return SEED_GROUPS.find((group) => group.id === id) ?? null;
}

export function listSeedGroupsForInstitution(institutionId: string): Group[] {
  return SEED_GROUPS.filter((group) => group.institutionId === institutionId);
}
