/**
 * Guest portfolio persistence — localStorage only.
 * No database, no watchlist dependency, no authentication.
 */

const STORAGE_KEY = "conviction-portfolio-positions";
const MAX_POSITIONS = 50;

export interface PersistedPosition {
  ticker: string;
  shares: number;
  averageCost?: number;
  note?: string;
}

/** Load all user positions from localStorage. Returns empty array on error or SSR. */
export function loadPositions(): PersistedPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedPosition[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save an array of positions, replacing all existing data. */
export function savePositions(positions: PersistedPosition[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const trimmed = positions.slice(0, MAX_POSITIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

/** Add a single position. If ticker already exists, replace it. */
export function upsertPosition(position: PersistedPosition): PersistedPosition[] {
  const current = loadPositions();
  const idx = current.findIndex((p) => p.ticker.toUpperCase() === position.ticker.toUpperCase());
  if (idx >= 0) {
    current[idx] = position;
  } else {
    current.push(position);
  }
  savePositions(current);
  return current;
}

/** Remove a position by ticker. */
export function removePosition(ticker: string): PersistedPosition[] {
  const current = loadPositions();
  const filtered = current.filter((p) => p.ticker.toUpperCase() !== ticker.toUpperCase());
  savePositions(filtered);
  return filtered;
}

/** Clear all user positions. */
export function clearPositions(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}