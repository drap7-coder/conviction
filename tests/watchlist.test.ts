import { describe, it, expect } from "vitest";
import { validateTicker } from "@/lib/watchlist/validate";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";

describe("validateTicker", () => {
  it("accepts a valid ticker (OXY)", async () => {
    const result = await validateTicker("OXY");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("OXY");
    expect(result.companyName).toBe("Occidental Petroleum");
    expect(result.cik).toBe("0000797468");
  });

  it("normalizes ticker to uppercase", async () => {
    const result = await validateTicker("intc");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("INTC");
  });

  it("resolves a company name to ticker", async () => {
    const result = await validateTicker("Intel Corporation");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("INTC");
  });

  it("resolves common company aliases", async () => {
    expect((await validateTicker("Google")).ticker).toBe("GOOG");
    expect((await validateTicker("Alphabet")).ticker).toBe("GOOG");
    expect((await validateTicker("Occidental")).ticker).toBe("OXY");
  });

  it("rejects an empty string", async () => {
    const result = await validateTicker("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Enter a ticker");
  });

  it("rejects a ticker with invalid format", async () => {
    const result = await validateTicker("TOOLONG");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a valid ticker format");
  });

  it("rejects special characters", async () => {
    const result = await validateTicker("OXY!");
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown ticker not in CIK_MAP or SEC dataset", async () => {
    const result = await validateTicker("ZZZZ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a supported ticker");
  });

  it("marks NVO as a foreign issuer", async () => {
    const result = await validateTicker("NVO");
    expect(result.valid).toBe(true);
    expect(result.isForeignIssuer).toBe(true);
  });

  it("does not mark OXY as foreign issuer", async () => {
    const result = await validateTicker("OXY");
    expect(result.valid).toBe(true);
    expect(result.isForeignIssuer).toBeFalsy();
  });

  it("accepts TSLA (Tesla)", async () => {
    const result = await validateTicker("TSLA");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("TSLA");
    expect(result.companyName).toBe("Tesla Inc.");
    expect(result.cik).toBe("0001318605");
  });

  it("accepts tsla as lowercase", async () => {
    const result = await validateTicker("tsla");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("TSLA");
  });

  it("accepts 'Tesla' as company name", async () => {
    const result = await validateTicker("Tesla");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("TSLA");
  });

  it("accepts 'Apple' as company name", async () => {
    const result = await validateTicker("Apple");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("AAPL");
  });

  it("accepts 'NVIDIA' as ticker", async () => {
    const result = await validateTicker("NVDA");
    expect(result.valid).toBe(true);
    expect(result.companyName).toBe("NVIDIA Corporation");
  });

  it("accepts APLD as a supported company ticker", async () => {
    const result = await validateTicker("APLD");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("APLD");
    expect(result.companyName).toBe("Applied Digital Corporation");
    expect(result.cik).toBe("0001144879");
  });

  it("resolves Applied Digital by company name", async () => {
    const result = await validateTicker("Applied Digital");
    expect(result.valid).toBe(true);
    expect(result.ticker).toBe("APLD");
  });

  it("accepts 'AMZN' as ticker", async () => {
    const result = await validateTicker("AMZN");
    expect(result.valid).toBe(true);
    expect(result.companyName).toBe("Amazon.com Inc.");
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
