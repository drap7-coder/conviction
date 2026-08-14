import { describe, expect, it } from "vitest";
import { validateTicker } from "@/lib/watchlist/validate";
import {
  getMarketInstrument,
  supportsConvictionSignals,
} from "@/lib/market/market-instruments";

describe("validateTicker market instruments", () => {
  it("accepts crypto pairs without SEC CIK", async () => {
    const eth = await validateTicker("ETH-USD");
    expect(eth.valid).toBe(true);
    expect(eth.ticker).toBe("ETH-USD");
    expect(eth.companyName).toBe("Ethereum");
    expect(eth.instrumentKind).toBe("crypto");
    expect(eth.supportsConvictionSignals).toBe(false);
    expect(eth.cik).toBeUndefined();
  });

  it("accepts Pulse index ETFs like RSP without SEC membership", async () => {
    const rsp = await validateTicker("RSP");
    expect(rsp.valid).toBe(true);
    expect(rsp.ticker).toBe("RSP");
    expect(rsp.companyName).toBe("S&P 500 Equal Weight");
    expect(rsp.instrumentKind).toBe("etf");
    expect(rsp.supportsConvictionSignals).toBe(false);
    expect(rsp.cik).toBeUndefined();
  });

  it("accepts sector SPDRs as light market instruments", async () => {
    const xlk = await validateTicker("XLK");
    expect(xlk.valid).toBe(true);
    expect(xlk.instrumentKind).toBe("etf");
    expect(xlk.supportsConvictionSignals).toBe(false);
    expect(getMarketInstrument("XLK")?.tag).toBe("Sector");
  });

  it("accepts strategy-book ETFs without SEC membership", async () => {
    const cases = [
      { ticker: "VTI", name: "Total Stock Market", tag: "ETF" },
      { ticker: "TLT", name: "20+ Year Treasury", tag: "Bond" },
      { ticker: "IEF", name: "7–10 Year Treasury", tag: "Bond" },
      { ticker: "GLD", name: "Gold", tag: "Commodity" },
      { ticker: "DBC", name: "Broad Commodities", tag: "Commodity" },
      { ticker: "BND", name: "Total Bond Market", tag: "Bond" },
      { ticker: "VXUS", name: "Total International Stock", tag: "International" },
      { ticker: "SGOV", name: "0–3 Month Treasury", tag: "Cash" },
    ] as const;

    for (const item of cases) {
      const result = await validateTicker(item.ticker);
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe(item.ticker);
      expect(result.companyName).toBe(item.name);
      expect(result.instrumentKind).toBe("etf");
      expect(result.supportsConvictionSignals).toBe(false);
      expect(getMarketInstrument(item.ticker)?.tag).toBe(item.tag);
    }
  });
});

describe("supportsConvictionSignals", () => {
  it("is false for crypto and Pulse ETFs", () => {
    expect(supportsConvictionSignals("ETH-USD")).toBe(false);
    expect(supportsConvictionSignals("RSP")).toBe(false);
    expect(supportsConvictionSignals("SPY")).toBe(false);
    expect(supportsConvictionSignals("NBIS")).toBe(true);
  });
});
