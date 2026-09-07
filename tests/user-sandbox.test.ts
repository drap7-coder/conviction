import { describe, expect, it } from "vitest";
import { normalizeSandboxHoldings } from "@/lib/user-sandbox";

describe("account-synced sandbox", () => {
  it("normalizes valid holdings for database storage", () => {
    expect(normalizeSandboxHoldings([
      { ticker: " vti ", weight: 60, entryPrice: 300 },
      { ticker: "bnd", weight: 40, entryPrice: null },
    ])).toEqual([
      { ticker: "VTI", weight: 60, entryPrice: 300 },
      { ticker: "BND", weight: 40, entryPrice: null },
    ]);
  });

  it("rejects an overallocated or malformed book", () => {
    expect(normalizeSandboxHoldings([
      { ticker: "VTI", weight: 80 },
      { ticker: "BND", weight: 40 },
    ])).toEqual([]);
    expect(normalizeSandboxHoldings([{ ticker: "not a symbol", weight: 10 }])).toEqual([]);
  });

  it("deduplicates tickers and caps the stored book at ten candidates", () => {
    const rows = normalizeSandboxHoldings([
      { ticker: "AAPL", weight: 10 },
      { ticker: "AAPL", weight: 20 },
      ...Array.from({ length: 12 }, (_, index) => ({ ticker: `X${index}`, weight: 1 })),
    ]);
    expect(rows[0]).toEqual({ ticker: "AAPL", weight: 20, entryPrice: null });
    expect(rows.length).toBeLessThanOrEqual(10);
  });
});
