/**
 * Sync configuration for CONVICTION data ingestion.
 *
 * All limits are intentionally conservative for Vercel Hobby + Neon Free tier.
 * Keep source-specific frequencies configurable so we don't hardcode
 * assumptions that change when new providers are added.
 */

export const SYNC_CONFIG = {
  /** Maximum companies processed in a single sync cycle */
  MAX_COMPANIES_PER_SYNC: 10,

  /** Maximum SEC Form 4 filings to fetch per company per sync */
  MAX_FILINGS_PER_COMPANY: 30,

  /** Maximum articles or external records evaluated per sync */
  MAX_RECORDS_PER_SYNC: 100,

  /** Maximum runtime for a single sync cycle (seconds) */
  MAX_SYNC_DURATION_SECONDS: 55,

  /** Maximum retry count for a single fetch operation */
  MAX_RETRIES_PER_FETCH: 2,

  /** Maximum stored transactions per ticker (newest only) */
  MAX_TRANSACTIONS_PER_TICKER: 100,

  /** Maximum dedup keys retained (oldest evicted) */
  MAX_DEDUP_KEYS: 5000,

  /** Maximum sync log entries retained */
  MAX_SYNC_LOG_ENTRIES: 100,

  /** Default sync frequency per provider source */
  FREQUENCY: {
    SEC_EDGAR: "daily",       // Form 4 filings — daily is sufficient for MVP
    MARKET_PRICE: "daily",    // Price data — daily close
    USASPENDING: "daily",     // Federal awards — daily
  } as Record<string, string>,

  /**
   * Vercel Hobby limitation: native cron only supports once per day.
   * To run more frequently, upgrade to Pro or use an external scheduler
   * (e.g., cron-job.org, GitHub Actions) calling secured API routes.
   * See: https://vercel.com/docs/cron-jobs
   */
  VERCEL_PLAN: "hobby" as const,
  MAX_CRON_FREQUENCY: "daily" as const,
} as const;

/**
 * Check whether a sync operation is within configured bounds.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function checkSyncBounds(params: {
  companyCount: number;
  filingCount: number;
  recordCount: number;
}): { ok: true } | { ok: false; reason: string } {
  if (params.companyCount > SYNC_CONFIG.MAX_COMPANIES_PER_SYNC) {
    return {
      ok: false,
      reason: `Company count ${params.companyCount} exceeds limit of ${SYNC_CONFIG.MAX_COMPANIES_PER_SYNC}`,
    };
  }
  if (params.filingCount > SYNC_CONFIG.MAX_FILINGS_PER_COMPANY) {
    return {
      ok: false,
      reason: `Filing count ${params.filingCount} exceeds limit of ${SYNC_CONFIG.MAX_FILINGS_PER_COMPANY}`,
    };
  }
  if (params.recordCount > SYNC_CONFIG.MAX_RECORDS_PER_SYNC) {
    return {
      ok: false,
      reason: `Record count ${params.recordCount} exceeds limit of ${SYNC_CONFIG.MAX_RECORDS_PER_SYNC}`,
    };
  }
  return { ok: true };
}

/**
 * Source-specific refresh frequencies for the MVP.
 * All default to daily on Vercel Hobby.
 */
export function getSourceFrequency(source: string): string {
  return SYNC_CONFIG.FREQUENCY[source] ?? "daily";
}