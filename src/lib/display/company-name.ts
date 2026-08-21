/**
 * Compact company-name display.
 *
 * Watchlist quote tiles are narrow, so long legal names ("Occidental
 * Petroleum", "Intel Corporation") used to hard-clip. This abbreviates the
 * common corporate suffix words so the name fits on a line; any remaining
 * overflow is handled by CSS ellipsis at the call site.
 */

const WORD_ABBREVIATIONS: Record<string, string> = {
  corporation: "Corp.",
  incorporated: "Inc.",
  company: "Co.",
  limited: "Ltd.",
  holdings: "Hldgs.",
  petroleum: "Petrol.",
  technologies: "Tech.",
  technology: "Tech.",
  international: "Int'l",
  industries: "Ind.",
  pharmaceuticals: "Pharma",
  pharmaceutical: "Pharma",
  laboratories: "Labs",
  communications: "Comms",
  enterprises: "Ent.",
};

/**
 * Abbreviate common corporate suffix words in a company name.
 * Non-suffix words are preserved as-is. Safe on empty/short names.
 */
export function shortenCompanyName(name: string): string {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map((word) => {
      const key = word.toLowerCase().replace(/[.,]+$/, "");
      return WORD_ABBREVIATIONS[key] ?? word;
    })
    .join(" ")
    .trim();
}
