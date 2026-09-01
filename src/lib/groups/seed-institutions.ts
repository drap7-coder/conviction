/**
 * Canonical institutions — seeded/admin only. Users cannot create institutions.
 * In the one-community product, each institution IS the joinable community.
 * Domains are the long-term identifier (e.g. later .edu email verification).
 * Never ship official university logos or protected wordmarks.
 */

import type { Institution } from "@/lib/groups/types";

export const SEED_INSTITUTIONS: Institution[] = [
  {
    id: "institution-wm",
    name: "William & Mary",
    slug: "wm",
    type: "university",
    canonicalDomain: "wm.edu",
    affiliationStatus: "unofficial",
    /** Neutral UI accent — not official branding. */
    accentColor: "#115740",
  },
  {
    id: "institution-rpi",
    name: "Rensselaer Polytechnic Institute",
    slug: "rpi",
    type: "university",
    canonicalDomain: "rpi.edu",
    affiliationStatus: "unofficial",
    accentColor: "#D6001C",
  },
  {
    id: "institution-njit",
    name: "New Jersey Institute of Technology",
    slug: "njit",
    type: "university",
    canonicalDomain: "njit.edu",
    affiliationStatus: "unofficial",
    accentColor: "#CC0000",
  },
  {
    id: "institution-stevens",
    name: "Stevens Institute of Technology",
    slug: "stevens",
    type: "university",
    canonicalDomain: "stevens.edu",
    affiliationStatus: "unofficial",
    accentColor: "#A32638",
  },
];

export function findSeedInstitutionBySlug(slug: string): Institution | null {
  const normalized = slug.trim().toLowerCase();
  return SEED_INSTITUTIONS.find((row) => row.slug === normalized) ?? null;
}

export function findSeedInstitutionByDomain(domain: string): Institution | null {
  const normalized = domain.trim().toLowerCase().replace(/^@/, "");
  return (
    SEED_INSTITUTIONS.find((row) => row.canonicalDomain === normalized) ?? null
  );
}

export function findSeedInstitutionById(id: string): Institution | null {
  return SEED_INSTITUTIONS.find((row) => row.id === id) ?? null;
}
