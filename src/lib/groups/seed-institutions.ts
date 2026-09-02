/**
 * Canonical institutions — seeded/admin only. Users cannot create institutions.
 * In the one-community product, each institution IS the joinable community.
 * Domains are the long-term identifier (e.g. later .edu email verification).
 * Never ship official university logos or protected wordmarks.
 */

import type { Institution } from "@/lib/groups/types";

/** Fifteen starter campuses for Crowd standings (5 seed students each). */
export const SEED_INSTITUTIONS: Institution[] = [
  {
    id: "institution-wm",
    name: "William & Mary",
    slug: "wm",
    type: "university",
    canonicalDomain: "wm.edu",
    affiliationStatus: "unofficial",
    accentColor: "#115740",
    ncaaId: "william-mary",
    conference: "CAA",
    communityEnabled: true,
  },
  {
    id: "institution-rpi",
    name: "Rensselaer Polytechnic Institute",
    slug: "rpi",
    type: "university",
    canonicalDomain: "rpi.edu",
    affiliationStatus: "unofficial",
    accentColor: "#D6001C",
    ncaaId: "rensselaer",
    conference: "Liberty League",
    communityEnabled: true,
  },
  {
    id: "institution-duke",
    name: "Duke University",
    slug: "duke",
    type: "university",
    canonicalDomain: "duke.edu",
    affiliationStatus: "unofficial",
    accentColor: "#003087",
    ncaaId: "duke",
    conference: "ACC",
    communityEnabled: true,
  },
  {
    id: "institution-virginia",
    name: "University of Virginia",
    slug: "virginia",
    type: "university",
    canonicalDomain: "virginia.edu",
    affiliationStatus: "unofficial",
    accentColor: "#232D4B",
    ncaaId: "virginia",
    conference: "ACC",
    communityEnabled: true,
  },
  {
    id: "institution-north-carolina",
    name: "University of North Carolina",
    slug: "unc",
    type: "university",
    canonicalDomain: "unc.edu",
    affiliationStatus: "unofficial",
    accentColor: "#7BAFD4",
    ncaaId: "north-carolina",
    conference: "ACC",
    communityEnabled: true,
  },
  {
    id: "institution-princeton",
    name: "Princeton University",
    slug: "princeton",
    type: "university",
    canonicalDomain: "princeton.edu",
    affiliationStatus: "unofficial",
    accentColor: "#E77500",
    ncaaId: "princeton",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-harvard",
    name: "Harvard University",
    slug: "harvard",
    type: "university",
    canonicalDomain: "harvard.edu",
    affiliationStatus: "unofficial",
    accentColor: "#A51C30",
    ncaaId: "harvard",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-yale",
    name: "Yale University",
    slug: "yale",
    type: "university",
    canonicalDomain: "yale.edu",
    affiliationStatus: "unofficial",
    accentColor: "#00356B",
    ncaaId: "yale",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-cornell",
    name: "Cornell University",
    slug: "cornell",
    type: "university",
    canonicalDomain: "cornell.edu",
    affiliationStatus: "unofficial",
    accentColor: "#B31B1B",
    ncaaId: "cornell",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-columbia",
    name: "Columbia University",
    slug: "columbia",
    type: "university",
    canonicalDomain: "columbia.edu",
    affiliationStatus: "unofficial",
    accentColor: "#B9D9EB",
    ncaaId: "columbia",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-penn",
    name: "University of Pennsylvania",
    slug: "penn",
    type: "university",
    canonicalDomain: "upenn.edu",
    affiliationStatus: "unofficial",
    accentColor: "#011F5B",
    ncaaId: "penn",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-brown",
    name: "Brown University",
    slug: "brown",
    type: "university",
    canonicalDomain: "brown.edu",
    affiliationStatus: "unofficial",
    accentColor: "#4E3629",
    ncaaId: "brown",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-dartmouth",
    name: "Dartmouth College",
    slug: "dartmouth",
    type: "university",
    canonicalDomain: "dartmouth.edu",
    affiliationStatus: "unofficial",
    accentColor: "#00693E",
    ncaaId: "dartmouth",
    conference: "Ivy League",
    communityEnabled: true,
  },
  {
    id: "institution-rutgers",
    name: "Rutgers University",
    slug: "rutgers",
    type: "university",
    canonicalDomain: "rutgers.edu",
    affiliationStatus: "unofficial",
    accentColor: "#CC0033",
    ncaaId: "rutgers",
    conference: "Big Ten",
    communityEnabled: true,
  },
  {
    id: "institution-villanova",
    name: "Villanova University",
    slug: "villanova",
    type: "university",
    canonicalDomain: "villanova.edu",
    affiliationStatus: "unofficial",
    accentColor: "#13B5EA",
    ncaaId: "villanova",
    conference: "Big East",
    communityEnabled: true,
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
