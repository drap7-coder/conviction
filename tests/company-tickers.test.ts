/**
 * Tests for SEC company ticker dataset (company-tickers.ts).
 *
 * Offline by default. Live SEC dataset coverage runs only when
 * `SEC_LIVE_TESTS=1` (egress to data.sec.gov is often blocked/403).
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

const SEC_LIVE = process.env.SEC_LIVE_TESTS === "1";

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

describe("resolveCompanyByTicker (hardcoded path)", () => {
  it("resolves TSLA via hardcoded map (fast path)", async () => {
    const result = await resolveCompanyByTicker("TSLA");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0001318605");
    expect(result.source).toBe("hardcoded");
  });

  it("returns hardcoded source for hardcoded tickers", async () => {
    const result = await resolveCompanyByTicker("OXY");
    expect(result.found).toBe(true);
    expect(result.source).toBe("hardcoded");
    expect(result.cik).toBe("0000797468");
  });

  it("uses hardcoded map as fast path before dataset", async () => {
    const result = await resolveCompanyByTicker("INTC");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0000050863");
    expect(result.source).toBe("hardcoded");
  });
});

describe("resolveCompanyByName (hardcoded path)", () => {
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

  it("returns not_found for an unknown company", async () => {
    const result = await resolveCompanyByName(
      "FakeCompanyNameXYZ123",
      HARDCODED_NAME_MAP,
      HARDCODED_NAMES,
    );
    expect(result.found).toBe(false);
  });
});

describe.skipIf(!SEC_LIVE)("live SEC dataset (SEC_LIVE_TESTS=1)", () => {
  it("fetches the SEC dataset and returns indexed entries", async () => {
    const ds = await getCompanyTickerDataset();
    expect(ds.count).toBeGreaterThan(5000);
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
    expect(ds1).toBe(ds2);
  });

  it("resolves lowercase aapl via dataset", async () => {
    const result = await resolveCompanyByTicker("aapl");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0000320193");
  });

  it("resolves BRK.B (share class) via dataset", async () => {
    const result = await resolveCompanyByTicker("BRK.B");
    expect(result.found).toBe(true);
    expect(result.cik).toBe("0001067983");
    expect(result.source).toBe("dataset");
    expect(result.ticker).toBe("BRK-B");
  });

  it("resolves an obscure U.S. filer (SMCI) not in hardcoded map", async () => {
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

  it("resolves a company name via SEC dataset when not in hardcoded map", async () => {
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

  it("returns CIKs as 10-digit zero-padded strings", async () => {
    const ds = await getCompanyTickerDataset();
    for (const [ticker, entry] of ds.byTicker) {
      if (ticker.length > 5) continue;
      expect(entry.cik).toMatch(/^\d{10}$/);
      break;
    }
  });
});
