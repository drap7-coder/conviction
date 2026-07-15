import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPoliticalTradesForTicker,
  normalizePoliticalDirection,
} from "@/lib/political-trades";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("political trades", () => {
  it("normalizes congressional transaction direction", () => {
    expect(normalizePoliticalDirection("Purchase")).toBe("purchase");
    expect(normalizePoliticalDirection("Sale (Partial)")).toBe("sale");
    expect(normalizePoliticalDirection("Exchange")).toBe("exchange");
    expect(normalizePoliticalDirection("Dividend Reinvestment")).toBe("other");
  });

  it("filters by ticker and summarizes purchases and sales", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify([
      {
        id: "trade-1",
        ticker: "APLD",
        asset_name: "Applied Digital Corporation",
        transaction_type: "Purchase",
        amount_range_low: 1001,
        amount_range_high: 15000,
        amount_range_label: "$1,001 - $15,000",
        transaction_date: "2026-06-01",
        filing_date: "2026-06-10",
        days_to_file: 9,
        is_late: 0,
        filer_name: "Jane Member",
        office: "U.S. Representative · TX",
        chamber: "house",
        party: "R",
        state: "TX",
        doc_url: "https://example.test/filing",
      },
      {
        id: "trade-2",
        ticker: "APLD",
        asset_name: "Applied Digital Corporation",
        transaction_type: "Sale",
        amount_range_low: 15001,
        amount_range_high: 50000,
        amount_range_label: "$15,001 - $50,000",
        transaction_date: "2026-06-02",
        filing_date: "2026-06-11",
        days_to_file: 9,
        is_late: 0,
        filer_name: "John Senator",
        office: "U.S. Senator · NY",
        chamber: "senate",
        party: "D",
        state: "NY",
        doc_url: "https://example.test/filing-2",
      },
      {
        id: "trade-3",
        ticker: "IBM",
        transaction_type: "Purchase",
        amount_range_low: 1001,
        amount_range_high: 15000,
        amount_range_label: "$1,001 - $15,000",
        filing_date: "2026-06-12",
      },
    ]), { status: 200 })) as typeof fetch;

    const summary = await getPoliticalTradesForTicker("apld");

    expect(summary.trades).toHaveLength(2);
    expect(summary.purchases).toHaveLength(1);
    expect(summary.sales).toHaveLength(1);
    expect(summary.totalEstimatedPurchases).toBe(8001);
    expect(summary.totalEstimatedSales).toBe(32501);
    expect(summary.latestFilingDate).toBe("2026-06-11");
  });
});
