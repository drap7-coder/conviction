/**
 * @deprecated Import from `@/lib/evidence/sync-universe` instead.
 * Thin compatibility shim — do not add new call sites here.
 */
export {
  getSyncUniverse as getWatchlist,
  saveSyncUniverse as saveWatchlist,
  addToSyncUniverse as addToWatchlist,
  removeFromSyncUniverse as removeFromWatchlist,
  updateSyncUniverseStatus as updateWatchlistSync,
  getSyncUniverseSortedByPriority as getWatchlistSortedBySyncPriority,
  getActiveSyncTickers as getActiveTickers,
  isSyncUniverseKvEnabled as isKvEnabled,
  buildDailySyncQueue,
  getSyncUniverse,
  saveSyncUniverse,
  addToSyncUniverse,
  removeFromSyncUniverse,
  updateSyncUniverseStatus,
  getSyncUniverseSortedByPriority,
  getActiveSyncTickers,
  isSyncUniverseKvEnabled,
} from "@/lib/evidence/sync-universe";
