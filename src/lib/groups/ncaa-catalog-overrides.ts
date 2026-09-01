/**
 * Stable ids + domains for seeded schools that predate the full NCAA directory.
 * NCAA slug `william-mary` maps to legacy institution-wm / group-wm.
 */
export type NcaaCatalogOverride = {
  institutionId: string;
  groupId: string;
  slug: string;
  canonicalDomain?: string | null;
  accentColor?: string | null;
  inviteCode?: string;
  /** Extra tokens for typeahead (e.g. W&M, RPI). */
  searchAliases?: string[];
};

export const NCAA_CATALOG_OVERRIDES: Record<string, NcaaCatalogOverride> = {
  "william-mary": {
    institutionId: "institution-wm",
    groupId: "group-wm",
    slug: "wm",
    canonicalDomain: "wm.edu",
    accentColor: "#115740",
    inviteCode: "wm",
    searchAliases: ["W&M", "WM", "William and Mary", "Tribe"],
  },
  rensselaer: {
    institutionId: "institution-rpi",
    groupId: "group-rpi",
    slug: "rpi",
    canonicalDomain: "rpi.edu",
    accentColor: "#D6001C",
    inviteCode: "rpi",
    searchAliases: ["RPI"],
  },
  njit: {
    institutionId: "institution-njit",
    groupId: "group-njit",
    slug: "njit",
    canonicalDomain: "njit.edu",
    accentColor: "#CC0000",
    inviteCode: "njit",
    searchAliases: ["NJIT", "New Jersey Tech"],
  },
  stevens: {
    institutionId: "institution-stevens",
    groupId: "group-stevens",
    slug: "stevens",
    canonicalDomain: "stevens.edu",
    accentColor: "#A32638",
    inviteCode: "stevens",
    searchAliases: ["Stevens Tech"],
  },
};
