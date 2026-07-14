import { describe, expect, it } from "vitest";
import { getTickerSignalSummary, TICKER_SIGNAL_SUMMARIES } from "@/lib/evidence/signal-summaries";

describe("ticker signal summaries", () => {
  it("reuses one source for card and ticker copy", () => {
    const oxy = getTickerSignalSummary("oxy");

    expect(oxy?.text).toBe("D. E. Shaw increased common shares");
    expect(oxy?.cardText).toContain("D. E. Shaw");
    expect(oxy?.badge).toBe("13F: accumulating");
  });

  it("keeps configured ticker signals unique", () => {
    const tickers = TICKER_SIGNAL_SUMMARIES.map((summary) => summary.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
  });
});
