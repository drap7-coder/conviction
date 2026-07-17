/**
 * Guest-only thesis persistence layer.
 * Stores thesis data in localStorage for browser-only persistence.
 * Does not interact with database or authenticated storage.
 */

import type { WatchlistEntry, WatchlistThesis } from "./types";

const THESIS_STORAGE_KEY = "conviction-thesis-data";
const THESIS_LENGTH_LIMIT = 1000;

/**
 * Get thesis data for a specific ticker from localStorage.
 * Returns null if not found or on error.
 */
export function getGuestThesis(ticker: string): WatchlistThesis | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(THESIS_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Record<string, WatchlistThesis>;
    return data[ticker.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

/**
 * Save thesis data for a specific ticker to localStorage.
 * Returns true on success, false on error.
 */
export function saveGuestThesis(ticker: string, thesis: WatchlistThesis): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Validate length limits
    if (thesis.thesis.length > THESIS_LENGTH_LIMIT) return false;
    if (thesis.invalidation.length > THESIS_LENGTH_LIMIT) return false;

    // Load existing data
    let data: Record<string, WatchlistThesis> = {};
    try {
      const raw = window.localStorage.getItem(THESIS_STORAGE_KEY);
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch {
      data = {};
    }

    // Save updated data
    data[ticker.toUpperCase()] = {
      thesis: thesis.thesis.slice(0, THESIS_LENGTH_LIMIT),
      invalidation: thesis.invalidation.slice(0, THESIS_LENGTH_LIMIT),
      reviewAt: thesis.reviewAt,
      status: thesis.status,
    };

    window.localStorage.setItem(THESIS_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove thesis data for a ticker (when company is removed from watchlist).
 */
export function removeGuestThesis(ticker: string): void {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(THESIS_STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw) as Record<string, WatchlistThesis>;
    delete data[ticker.toUpperCase()];
    window.localStorage.setItem(THESIS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore errors on remove
  }
}

/**
 * Get all thesis data from localStorage.
 * Used for NeedsYourAttention module.
 */
export function getAllGuestTheses(): Record<string, WatchlistThesis> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(THESIS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WatchlistThesis>;
  } catch {
    return {};
  }
}

/**
 * Normalize a watchlist entry with thesis data.
 * Merges thesis from localStorage with entry data.
 * Provides safe defaults for missing/invalid thesis data.
 */
export function normalizeEntryWithThesis(
  entry: WatchlistEntry,
  guestThesis: WatchlistThesis | null = null,
): WatchlistEntry {
  const thesis = guestThesis ?? entry.thesis ?? getDefaultThesis();
  return {
    ...entry,
    thesis: normalizeThesis(thesis),
  };
}

/**
 * Normalize thesis data with safe defaults.
 * Invalid status falls back to "building".
 * Invalid review date falls back to null.
 */
export function normalizeThesis(thesis: WatchlistThesis | undefined): WatchlistThesis {
  const validStatuses = ["building", "supported", "review", "weakening", "broken"] as const;

  return {
    thesis: thesis?.thesis?.slice(0, THESIS_LENGTH_LIMIT) ?? "",
    invalidation: thesis?.invalidation?.slice(0, THESIS_LENGTH_LIMIT) ?? "",
    reviewAt: isValidISODate(thesis?.reviewAt) ? thesis!.reviewAt : null,
    status: validStatuses.includes(thesis?.status as any) ? thesis!.status : "building",
  };
}

/**
 * Check if a string is a valid ISO date.
 */
function isValidISODate(date: string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Get default thesis object.
 */
export function getDefaultThesis(): WatchlistThesis {
  return {
    thesis: "",
    invalidation: "",
    reviewAt: null,
    status: "building",
  };
}

/**
 * Update thesis for an entry and persist to localStorage.
 * Returns the updated entry with thesis.
 */
export function updateEntryThesis(
  entry: WatchlistEntry,
  thesis: WatchlistThesis,
): WatchlistEntry {
  const normalized = normalizeThesis(thesis);
  const saved = saveGuestThesis(entry.ticker, normalized);

  if (!saved) {
    // Return with normalized thesis even if save failed
    return { ...entry, thesis: normalized };
  }

  return { ...entry, thesis: normalized };
}