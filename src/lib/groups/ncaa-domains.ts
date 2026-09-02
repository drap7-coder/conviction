/**
 * Known .edu (and campus) domains for NCAA catalog slugs.
 * Used for favicon fallback when ESPN logos are unavailable.
 */
export const NCAA_DOMAINS: Record<string, string> = {
  "brown": "brown.edu",
  "columbia": "columbia.edu",
  "cornell": "cornell.edu",
  "dartmouth": "dartmouth.edu",
  "drew": "drew.edu",
  "duke": "duke.edu",
  "fairleigh-dickinson": "fdu.edu",
  "harvard": "harvard.edu",
  "kean": "kean.edu",
  "monmouth": "monmouth.edu",
  "montclair-st": "montclair.edu",
  "njcu": "njcu.edu",
  "njit": "njit.edu",
  "north-carolina": "unc.edu",
  "penn": "upenn.edu",
  "princeton": "princeton.edu",
  "ramapo": "ramapo.edu",
  "rensselaer": "rpi.edu",
  "rider": "rider.edu",
  "rowan": "rowan.edu",
  "rutgers": "rutgers.edu",
  "rutgers-camden": "camden.rutgers.edu",
  "rutgers-newark": "newark.rutgers.edu",
  "seton-hall": "shu.edu",
  "stevens": "stevens.edu",
  "stockton": "stockton.edu",
  "tcnj": "tcnj.edu",
  "villanova": "villanova.edu",
  "virginia": "virginia.edu",
  "william-mary": "wm.edu",
  "william-paterson": "wpunj.edu",
  "yale": "yale.edu",
};

export function resolveNcaaDomain(ncaaId: string | null | undefined): string | null {
  if (!ncaaId?.trim()) return null;
  return NCAA_DOMAINS[ncaaId.trim().toLowerCase()] ?? null;
}
