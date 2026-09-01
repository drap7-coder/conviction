/**
 * Debounced guest watchlist localStorage writes + serial mutation queue
 * so rapid Manage add/remove does not hammer sync.
 */

import type { WatchlistEntry } from "@/lib/watchlist/types";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEntries: WatchlistEntry[] | null = null;

function browserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserWatchlistNow(entries: WatchlistEntry[]): void {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Browser persistence is best-effort.
  }
}

/** Coalesce rapid guest writes (default 280ms). */
export function scheduleBrowserWatchlistWrite(
  entries: WatchlistEntry[],
  delayMs = 280,
): void {
  pendingEntries = entries;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (pendingEntries) {
      writeBrowserWatchlistNow(pendingEntries);
      pendingEntries = null;
    }
  }, delayMs);
}

/** Flush any pending debounced write (unmount / navigation). */
export function flushBrowserWatchlistWrite(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingEntries) {
    writeBrowserWatchlistNow(pendingEntries);
    pendingEntries = null;
  }
}

/**
 * Serialize async watchlist mutations so overlapping add/remove
 * cannot race the authenticated API.
 */
export function createMutationQueue() {
  let chain: Promise<void> = Promise.resolve();

  return function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
