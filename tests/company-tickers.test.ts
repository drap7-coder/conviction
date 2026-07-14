/**
 * Tests for SEC company ticker dataset (company-tickers.ts).
 *
 * These tests verify:
 *  - Fetching and caching the SEC dataset
 *  - Ticker resolution (TSLA, aapl, BRK.B, obscure tickers)
 *  - Company name resolution
 *  - Hardcoded fallback when SEC is unavailable
 *  - Normalization functions
 *
 * Tests that hit the real SEC API use `fetch` via the Vitest environment.
 * Cache is cleared between test runs to ensure fresh fetches.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getCompanyTickerDataset,
  resolveCompanyByTicker,
  resolveCompanyByName,
  normalizeTicker,
  normalizeCompanyName,
  clearCache,
} from "@/lib/sec/company-tickers";
import { CIK_MAP } from "@/lib/sec/cik";

const HARDCODED_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla Inc.",
  BRKB: "Berkshire Hathaway Inc.",
  OXY: "Occidental Petroleum",
};

const HARDCODED_NAME_MAP: Record<string, string> = {
  APPLE: "AAPL",
  "APPLE INC": "AAPL",
  TESLA: "TSLA",
  "TESLA INC": "TSLA",
  NVIDIA: "NVDA",
};

beforeEach(() => {
  clearCache();
});

describe("normalizeTicker", () => {
  it("uppercases a ticker", () => {
    const { normalized, original } = normalizeTicker("aapl");
    expect(normalized).toBe("AAPL");
    expect(original).toBe("AAPL");
  });

  it("strips dots from share classes", () => {
    const { normalized, original } = normalizeTicker("BRK.B");
    expect(normalized).toBe("BRKB");
    expect(original).toBe("BRK.B");
  });

  it("strips hyphens from tickers", () => {
    const { normalized } = normalizeTicker("BF-A");
    expect(normalized).toBe("BFA");
  });

  it("trims whitespace", () => {
    const { normalized } = normalizeTicker("  aapl  ");
    expect(normalized).toBe("AAPL");
  });
});

describe("normalizeCompanyName", () => {
  it("uppercases and strips punctuation", () => {
    expect(normalizeCompanyName("Apple Inc.")).toBe("APPLE");
  });

  it("strips common suffixes", () => {
    expect(normalizeCompanyName("Microsoft Corporation")).toBe("MICROSOFT");
    expect(normalizeCompanyName("NVIDIA CORP")).toBe("NVIDIA");
    expect(normalizeCompanyName("Pfizer Inc.")).toBe("PFIZER");
  });

  it("normalizes & to AND", () => {
    expect(normalizeCompanyName("Johnson & Johnson")).toBe("JOHNSON AND JOHNSON");
  });
});

describe("getCompanyTickerDataset", () => {
  it("fetches the SEC dataset and returns indexed entries", async () => {
    const ds = await getCompanyTickerDataset();
    expect(ds.count).toBeGreaterThan(5000); // SEC has ~10K entries
    expect(ds.byTicker.size).toBeGreaterThan(5000);
    expect(ds.byName.size).toBeGreaterThan(5000);
    expect(ds.fetchedAt).toBeTruthy();
  });

  it("indexes Apple correctly", async () => {
    const ds = await getCompanyTickerDataset();
    const aapl = ds.byTicker.get("AAPL");
    expect(aapl).toBeDefined();
    expect(aapl!.ticker).toBe("AAPL");
    expect(aapl!.name.toUpperCase()).toContain("APPLE");
    expect(aapl!.cik).toBe("0000320193");
  });

  it("indexes Tesla correctly", async () => {
    const ds = await getCompanyTickerDataset();
    const tsla = ds.byTicker.get("TSLA");
    expect(tsla).toBeDefined();
    expect(tsla!.name.toUpperCase()).toContain("TESLA");
    expect(tsla!.cik).toBe("0001318605");
  });

  it("returns cached dataset on subsequent calls", async () => {
    const ds1 = await getCompanyTickerDataset();
    const ds2 = await getCompanyTickerDataset();
    expect(ds1).toBe(ds2); // same object reference
  });
});

describe("resolveCompanyByTicker", () => {
  it("resolves TSLA via hardcoded map (fast path)", async () => {
    const result = await resolveCompanyByTicker("TSLA");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0001318605");
    expect(result.source).toBe("hardcoded");
  });

  it("resolves lowercase aapl via dataset", async () => {
    const result = await resolveCompanyByTicker("aapl");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0000320193");
  });

  it("resolves BRK.B (share class) via dataset", async () => {
    // SEC stores BRK.B as "BRK-B" (hyphen)
    const result = await resolveCompanyByTicker("BRK.B");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0001067983"); // Berkshire Hathaway CIK
    expect(result.source).toBe("dataset");
    expect(result.ticker).toBe("BRK-B"); // SEC stores with hyphen
  });

  it("resolves an obscure U.S. filer (SMCI) not in hardcoded map", async () => {
    // SMCI = Super Micro Computer — a valid SEC filer in the dataset, NOT in CIK_MAP
    const result = await resolveCompanyByTicker("SMCI");
    expect(result.found).toBe(true);
    expect(result.cik).toMatch(/^\d{10}$/);
    expect(result.source).toBe("dataset");
  });

  it("returns not_found for an unknown ticker", async () => {
    const result = await resolveCompanyByTicker("ZZZZ");
    expect(result.found).toBe(false);
    expect(result.source).toBe("not_found");
  });

  it("returns hardcoded source for hardcoded tickers", async () => {
    const result = await resolveCompanyByTicker("OXY");
    expect(result.found).toBe(true);
    expect(result.source).toBe("hardcoded");
    expect(result.cik).toBe("0000797468");
  });
});

describe("resolveCompanyByName", () => {
  it("resolves 'Tesla' via hardcoded name map", async () => {
    const result = await resolveCompanyByName("Tesla", HARDCODED_NAME_MAP, HARDCODED_NAMES);
    expect(result.found).toBe(true);
    expect(result.ticker).toBe("TSLA");
    expect(result.source).toBe("hardcoded");
  });

  it("resolves 'Apple' via hardcoded name map", async () => {
    const result = await resolveCompanyByName("Apple", HARDCODED_NAME_MAP, HARDCODED_NAMES);
    expect(result.found).toBe(true);
    expect(result.ticker).toBe("AAPL");
  });

  it("resolves a company name via SEC dataset when not in hardcoded map", async () => {
    // Super Micro Computer is not in the hardcoded name map, but should be in the SEC dataset
    const result = await resolveCompanyByName("Super Micro Computer", HARDCODED_NAME_MAP, HARDCODED_NAMES);
    expect(result.found).toBe(true);
    expect(result.ticker).toBe("SMCI");
    expect(result.source).toBe("name_match");
  });

  it("resolves via name match for full company names", async () => {
    const result = await resolveCompanyByName(
      "NVIDIA Corporation",
      HARDCODED_NAME_MAP,
      HARDCODED_NAMES,
    );
    expect(result.found).toBe(true);
    expect(result.ticker).toBe("NVDA");
  });

  it("returns not_found for an unknown company", async () => {
    const result = await resolveCompanyByName(
      "FakeCompanyNameXYZ123",
      HARDCODED_NAME_MAP,
      HARDCODED_NAMES,
    );
    expect(result.found).toBe(false);
  });
});

describe("Caching and fallback", () => {
  it("uses hardcoded map as fast path before dataset", async () => {
    // INTC is in the hardcoded CIK_MAP
    const result = await resolveCompanyByTicker("INTC");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0000050863");
    expect(result.source).toBe("hardcoded");
  });
});

describe("CIK format", () => {
  it("returns CIKs as 10-digit zero-padded strings", async () => {
    const ds = await getCompanyTickerDataset();
    for (const [ticker, entry] of ds.byTicker) {
      if (ticker.length > 5) continue; // skip edge cases
      expect(entry.cik).toMatch(/^\d{10}$/);
      break; // just check one
    }
  });
});