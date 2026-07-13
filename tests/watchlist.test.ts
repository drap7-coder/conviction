import { describe, it, expect } from "vitest";
import { validateTicker } from "@/lib/watchlist/validate";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";

describe("validateTicker", () => {
  it("accepts a valid ticker (OXY)", () => {
    const result = validateTicker("OXY");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("OXY");
    expect(result.companyName).toBe("Occidental Petroleum");
    expect(result.cik).toBe("0000797468");
  });

  it("normalizes ticker to uppercase", () => {
    const result = validateTicker("intc");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("INTC");
  });

  it("resolves a company name to ticker", () => {
    const result = validateTicker("Intel Corporation");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("INTC");
  });

  it("resolves common company aliases", () => {
    expect(validateTicker("Google").ticker).toBe("GOOG");
    expect(validateTicker("Alphabet").ticker).toBe("GOOG");
    expect(validateTicker("Occidental").ticker).toBe("OXY");
  });

  it("rejects an empty string", () => {
    const result = validateTicker("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Enter a ticker");
  });

  it("rejects a ticker with invalid format", () => {
    const result = validateTicker("TOOLONG");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a valid ticker format");
  });

  it("rejects special characters", () => {
    const result = validateTicker("OXY!");
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown ticker not in CIK_MAP", () => {
    const result = validateTicker("ZZZZ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a supported ticker");
  });

  it("marks NVO as a foreign issuer", () => {
    const result = validateTicker("NVO");
    expect(result.valid).toBe(true);
    expect(result.isForeignIssuer).toBe(true);
  });

  it("does not mark OXY as foreign issuer", () => {
    const result = validateTicker("OXY");
    expect(result.valid).toBe(true);
    expect(result.isForeignIssuer).toBeFalsy();
  });
});

describe("SEED_WATCHLIST", () => {
  it("contains all expected initial companies", () => {
    const tickers = SEED_WATCHLIST.map((e) => e.ticker);
    expect(tickers).toContain("OXY");
    expect(tickers).toContain("INTC");
    expect(tickers).toContain("GOOG");
    expect(tickers).toContain("NVO");
    expect(tickers).toContain("PFE");
    expect(tickers).toContain("NBIS");
    expect(SEED_WATCHLIST.length).toBe(6);
  });

  it("marks NVO as unsupported with a clear message", () => {
    const nvo = SEED_WATCHLIST.find((e) => e.ticker === "NVO");
    expect(nvo?.status).toBe("unsupported");
    expect(nvo?.statusMessage).toContain("Foreign issuer");
  });

  it("marks US companies as active", () => {
    for (const ticker of ["OXY", "INTC", "GOOG", "PFE", "NBIS"]) {
      const entry = SEED_WATCHLIST.find((e) => e.ticker === ticker);
      expect(entry?.status).toBe("active");
    }
  });

  it("has unique tickers", () => {
    const tickers = SEED_WATCHLIST.map((e) => e.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it("has no duplicate entries", () => {
    const tickers = SEED_WATCHLIST.map((e) => e.ticker);
    expect(tickers.length).toBe(new Set(tickers).size);
  });
});

describe("Watchlist entry format", () => {
  it("has the correct shape", () => {
    const entry = SEED_WATCHLIST[0];
    expect(entry).toHaveProperty("ticker");
    expect(entry).toHaveProperty("companyName");
    expect(entry).toHaveProperty("addedAt");
    expect(entry).toHaveProperty("status");
    expect(["active", "unsupported", "error"]).toContain(entry.status);
  });
});