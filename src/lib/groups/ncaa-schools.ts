/**
 * NCAA-member school catalog for community search (display + discovery).
 * Only rows with `institutionId` are joinable on IQBulls; others show as coming soon.
 * Names align with NCAA / common athletics branding — not official logos.
 */

export type NcaaSchoolRecord = {
  ncaaId: string;
  name: string;
  aliases: string[];
  /** Live platform institution id when seeded (e.g. institution-wm). */
  institutionId?: string;
  slug?: string;
};

/** Curated NCAA schools — expand via seeds/migrations as communities go live. */
export const NCAA_SCHOOLS: NcaaSchoolRecord[] = [
  {
    ncaaId: "william-mary",
    name: "William & Mary",
    aliases: ["W&M", "WM", "William and Mary", "Tribe"],
    institutionId: "institution-wm",
    slug: "wm",
  },
  {
    ncaaId: "rpi",
    name: "Rensselaer Polytechnic Institute",
    aliases: ["RPI", "Rensselaer"],
    institutionId: "institution-rpi",
    slug: "rpi",
  },
  {
    ncaaId: "virginia",
    name: "University of Virginia",
    aliases: ["UVA", "Virginia Cavaliers"],
  },
  {
    ncaaId: "virginia-tech",
    name: "Virginia Tech",
    aliases: ["VT", "Hokies"],
  },
  {
    ncaaId: "duke",
    name: "Duke University",
    aliases: ["Duke Blue Devils"],
  },
  {
    ncaaId: "north-carolina",
    name: "University of North Carolina",
    aliases: ["UNC", "North Carolina Tar Heels", "Chapel Hill"],
  },
  {
    ncaaId: "michigan",
    name: "University of Michigan",
    aliases: ["Michigan Wolverines", "UM"],
  },
  {
    ncaaId: "ohio-state",
    name: "Ohio State University",
    aliases: ["OSU", "Buckeyes"],
  },
  {
    ncaaId: "penn-state",
    name: "Penn State University",
    aliases: ["Penn State Nittany Lions", "PSU"],
  },
  {
    ncaaId: "notre-dame",
    name: "University of Notre Dame",
    aliases: ["Notre Dame Fighting Irish"],
  },
  {
    ncaaId: "stanford",
    name: "Stanford University",
    aliases: ["Stanford Cardinal"],
  },
  {
    ncaaId: "ucla",
    name: "UCLA",
    aliases: ["University of California Los Angeles", "Bruins"],
  },
  {
    ncaaId: "usc",
    name: "University of Southern California",
    aliases: ["USC Trojans"],
  },
  {
    ncaaId: "texas",
    name: "University of Texas",
    aliases: ["UT Austin", "Texas Longhorns"],
  },
  {
    ncaaId: "georgia",
    name: "University of Georgia",
    aliases: ["UGA", "Georgia Bulldogs"],
  },
  {
    ncaaId: "florida",
    name: "University of Florida",
    aliases: ["UF", "Florida Gators"],
  },
  {
    ncaaId: "alabama",
    name: "University of Alabama",
    aliases: ["Alabama Crimson Tide", "Bama"],
  },
  {
    ncaaId: "auburn",
    name: "Auburn University",
    aliases: ["Auburn Tigers"],
  },
  {
    ncaaId: "clemson",
    name: "Clemson University",
    aliases: ["Clemson Tigers"],
  },
  {
    ncaaId: "louisville",
    name: "University of Louisville",
    aliases: ["Louisville Cardinals"],
  },
  {
    ncaaId: "vanderbilt",
    name: "Vanderbilt University",
    aliases: ["Vandy", "Commodores"],
  },
  {
    ncaaId: "georgetown",
    name: "Georgetown University",
    aliases: ["Georgetown Hoyas"],
  },
  {
    ncaaId: "boston-college",
    name: "Boston College",
    aliases: ["BC Eagles"],
  },
  {
    ncaaId: "harvard",
    name: "Harvard University",
    aliases: ["Harvard Crimson"],
  },
  {
    ncaaId: "yale",
    name: "Yale University",
    aliases: ["Yale Bulldogs"],
  },
  {
    ncaaId: "princeton",
    name: "Princeton University",
    aliases: ["Princeton Tigers"],
  },
  {
    ncaaId: "columbia",
    name: "Columbia University",
    aliases: ["Columbia Lions"],
  },
  {
    ncaaId: "cornell",
    name: "Cornell University",
    aliases: ["Cornell Big Red"],
  },
  {
    ncaaId: "dartmouth",
    name: "Dartmouth College",
    aliases: ["Dartmouth Big Green"],
  },
  {
    ncaaId: "brown",
    name: "Brown University",
    aliases: ["Brown Bears"],
  },
  {
    ncaaId: "mit",
    name: "MIT",
    aliases: ["Massachusetts Institute of Technology"],
  },
  {
    ncaaId: "nyu",
    name: "New York University",
    aliases: ["NYU Violets"],
  },
  {
    ncaaId: "syracuse",
    name: "Syracuse University",
    aliases: ["Syracuse Orange", "Cuse"],
  },
  {
    ncaaId: "pitt",
    name: "University of Pittsburgh",
    aliases: ["Pitt Panthers"],
  },
  {
    ncaaId: "wisconsin",
    name: "University of Wisconsin",
    aliases: ["Wisconsin Badgers"],
  },
  {
    ncaaId: "iowa",
    name: "University of Iowa",
    aliases: ["Iowa Hawkeyes"],
  },
  {
    ncaaId: "illinois",
    name: "University of Illinois",
    aliases: ["Illinois Fighting Illini", "UIUC"],
  },
  {
    ncaaId: "indiana",
    name: "Indiana University",
    aliases: ["Indiana Hoosiers"],
  },
  {
    ncaaId: "purdue",
    name: "Purdue University",
    aliases: ["Purdue Boilermakers"],
  },
  {
    ncaaId: "maryland",
    name: "University of Maryland",
    aliases: ["Maryland Terrapins", "UMD"],
  },
  {
    ncaaId: "james-madison",
    name: "James Madison University",
    aliases: ["JMU", "Dukes"],
  },
  {
    ncaaId: "richmond",
    name: "University of Richmond",
    aliases: ["Richmond Spiders"],
  },
  {
    ncaaId: "vcu",
    name: "Virginia Commonwealth University",
    aliases: ["VCU Rams"],
  },
  {
    ncaaId: "old-dominion",
    name: "Old Dominion University",
    aliases: ["ODU Monarchs"],
  },
  {
    ncaaId: "navy",
    name: "United States Naval Academy",
    aliases: ["Navy Midshipmen", "Annapolis"],
  },
  {
    ncaaId: "army",
    name: "United States Military Academy",
    aliases: ["Army Black Knights", "West Point"],
  },
  {
    ncaaId: "air-force",
    name: "United States Air Force Academy",
    aliases: ["Air Force Falcons"],
  },
];

export type SchoolSuggestion = {
  ncaaId: string;
  name: string;
  live: boolean;
  institutionId: string | null;
  slug: string | null;
};

function haystack(record: NcaaSchoolRecord): string {
  return [record.name, ...record.aliases, record.slug ?? "", record.ncaaId]
    .join(" ")
    .toLowerCase();
}

export function searchNcaaSchools(query: string, limit = 8): SchoolSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = NCAA_SCHOOLS.map((record) => {
    const hay = haystack(record);
    let score = 0;
    if (record.name.toLowerCase().startsWith(q)) score += 100;
    if (record.aliases.some((alias) => alias.toLowerCase().startsWith(q))) score += 80;
    if (hay.includes(q)) score += 40;
    if (record.institutionId) score += 5;
    return { record, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
    .slice(0, limit);

  return scored.map(({ record }) => ({
    ncaaId: record.ncaaId,
    name: record.name,
    live: Boolean(record.institutionId),
    institutionId: record.institutionId ?? null,
    slug: record.slug ?? null,
  }));
}

export function findNcaaSchoolByInstitutionId(institutionId: string): NcaaSchoolRecord | null {
  return NCAA_SCHOOLS.find((row) => row.institutionId === institutionId) ?? null;
}
