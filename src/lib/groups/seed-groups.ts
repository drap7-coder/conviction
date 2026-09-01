/**
 * Seed schools / orgs for guest mode and first Neon bootstrap.
 * Case-sensitive names — free-text onboarding matches exactly.
 */

import type { Group } from "@/lib/groups/types";

export const SEED_GROUPS: Group[] = [
  {
    id: "group-seed-wm",
    name: "William & Mary",
    type: "school",
    primaryColor: "#115740",
  },
  {
    id: "group-seed-uva",
    name: "University of Virginia",
    type: "school",
    primaryColor: "#E57200",
  },
  {
    id: "group-seed-kkg",
    name: "Kappa Kappa Gamma",
    type: "org",
    primaryColor: "#5B2C6F",
  },
  {
    id: "group-seed-sae",
    name: "Sigma Alpha Epsilon",
    type: "org",
    primaryColor: "#8B1E1E",
  },
];

/** Map crowd-seed book ids → group memberships for demo Crowd filters. */
export const SEED_BOOK_GROUP_IDS: Record<string, string[]> = {
  "crowd-seed-01": ["group-seed-wm", "group-seed-kkg"],
  "crowd-seed-02": ["group-seed-wm"],
  "crowd-seed-03": ["group-seed-uva"],
  "crowd-seed-04": ["group-seed-uva", "group-seed-sae"],
  "crowd-seed-05": ["group-seed-wm"],
  "crowd-seed-06": ["group-seed-kkg"],
  "crowd-seed-07": ["group-seed-uva"],
  "crowd-seed-08": ["group-seed-sae"],
  "crowd-seed-09": ["group-seed-wm", "group-seed-sae"],
  "crowd-seed-10": ["group-seed-uva", "group-seed-kkg"],
};

export function findSeedGroupByName(name: string): Group | null {
  return SEED_GROUPS.find((group) => group.name === name) ?? null;
}
