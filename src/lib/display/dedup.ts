/**
 * ── Ticker Deduplication ──
 *
 * Deterministic utility that ensures one canonical item per normalized ticker.
 *
 * Rules:
 *  - Normalize ticker casing and whitespace.
 *  - Preserve first meaningful user ordering.
 *  - Merge richer data when duplicate records contain complementary fields.
 *  - Do not silently discard portfolio or evidence data.
 */

export interface DeduplicableEntry {
  ticker: string;
  [key: string]: unknown;
}

/**
 * Normalize a ticker string: uppercase, trim whitespace, remove leading dots
 * or carets that some data sources add (e.g. "^VIX" → "VIX").
 */
export function normalizeTicker(raw: string): string {
  return raw.replace(/^[\^.]/, "").trim().toUpperCase();
}

/**
 * Deduplicate an array of entries by normalized ticker.
 *
 * - First occurrence wins for ordering.
 * - Subsequent occurrences have their fields merged into the first, with
 *   non-null/non-undefined values taking priority.
 * - Returns a new array; does not mutate the input.
 */
export function deduplicateByTicker<T extends DeduplicableEntry>(
  entries: T[],
): T[] {
  const seen = new Map<string, T>();

  for (const entry of entries) {
    const key = normalizeTicker(entry.ticker);
    if (!key) continue;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...entry, ticker: key });
      continue;
    }

    // Merge complementary fields: prefer non-null values from the
    // duplicate that are missing on the first occurrence.
    const merged = { ...existing };
    for (const [k, v] of Object.entries(entry)) {
      if (v !== null && v !== undefined && v !== "") {
        const existingVal = (existing as Record<string, unknown>)[k];
        if (
          existingVal === null ||
          existingVal === undefined ||
          existingVal === ""
        ) {
          (merged as Record<string, unknown>)[k] = v;
        }
      }
    }
    // Preserve the original ticker key from the first occurrence
    merged.ticker = key;
    seen.set(key, merged);
  }

  return Array.from(seen.values());
}

/**
 * Count duplicate tickers in an array (for diagnostics).
 */
export function countDuplicates<T extends DeduplicableEntry>(
  entries: T[],
): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const entry of entries) {
    const key = normalizeTicker(entry.ticker);
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }
  return duplicates;
}