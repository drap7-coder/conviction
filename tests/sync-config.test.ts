import { describe, it, expect } from "vitest";
import { SYNC_CONFIG, checkSyncBounds, getSourceFrequency } from "@/lib/sync/sync-config";

describe("SYNC_CONFIG", () => {
  it("has conservative limits", () => {
    expect(SYNC_CONFIG.MAX_COMPANIES_PER_SYNC).toBeLessThanOrEqual(10);
    expect(SYNC_CONFIG.MAX_FILINGS_PER_COMPANY).toBeLessThanOrEqual(30);
    expect(SYNC_CONFIG.MAX_RECORDS_PER_SYNC).toBeLessThanOrEqual(100);
    expect(SYNC_CONFIG.MAX_TRANSACTIONS_PER_TICKER).toBeLessThanOrEqual(100);
    expect(SYNC_CONFIG.MAX_DEDUP_KEYS).toBeLessThanOrEqual(5000);
    expect(SYNC_CONFIG.MAX_SYNC_DURATION_SECONDS).toBeLessThanOrEqual(55);
    expect(SYNC_CONFIG.MAX_RETRIES_PER_FETCH).toBeLessThanOrEqual(2);
    expect(SYNC_CONFIG.MAX_SYNC_LOG_ENTRIES).toBeLessThanOrEqual(100);
  });

  it("defaults to daily frequency", () => {
    expect(SYNC_CONFIG.MAX_CRON_FREQUENCY).toBe("daily");
    expect(SYNC_CONFIG.VERCEL_PLAN).toBe("hobby");
  });

  it("has daily frequencies for all sources", () => {
    for (const freq of Object.values(SYNC_CONFIG.FREQUENCY)) {
      expect(freq).toBe("daily");
    }
  });
});

describe("checkSyncBounds", () => {
  it("passes when within limits", () => {
    const result = checkSyncBounds({ companyCount: 7, filingCount: 30, recordCount: 50 });
    expect(result.ok).toBe(true);
  });

  it("rejects too many companies", () => {
    const result = checkSyncBounds({ companyCount: 20, filingCount: 5, recordCount: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("exceeds limit");
  });

  it("rejects too many filings per company", () => {
    const result = checkSyncBounds({ companyCount: 5, filingCount: 50, recordCount: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("exceeds limit");
  });

  it("rejects too many total records", () => {
    const result = checkSyncBounds({ companyCount: 5, filingCount: 5, recordCount: 200 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("exceeds limit");
  });
});

describe("getSourceFrequency", () => {
  it("returns daily for known sources", () => {
    expect(getSourceFrequency("SEC_EDGAR")).toBe("daily");
    expect(getSourceFrequency("MARKET_PRICE")).toBe("daily");
    expect(getSourceFrequency("USASPENDING")).toBe("daily");
  });

  it("returns daily for unknown sources", () => {
    expect(getSourceFrequency("unknown-source")).toBe("daily");
  });
});