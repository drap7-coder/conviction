/**
 * CIK (Central Index Key) mapping for SEC EDGAR.
 * SEC identifies companies by CIK, not ticker.
 * These are the primary watchlist companies plus emerging candidates.
 */
export const CIK_MAP: Record<string, string> = {
  OXY: "0000797468",
  INTC: "0000050863",
  GOOG: "0001652044",
  NVO: "0001113254",
  PFE: "0000078003",
  NBIS: "0001712184",
  CRWD: "0001535527",
  ONON: "0001888965",
  PLTR: "0001321655",
  RXRX: "0001639155",
  AVAV: "0000008705",
};