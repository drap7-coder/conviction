import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import {
  COMMODITY_SCOREBOARD,
  INDEX_SCOREBOARD,
  scoreboardCommodities,
  scoreboardIndexes,
} from "@/lib/market/index-scoreboard";
import { getSectorColors, hasDomainLogo } from "@/lib/market/logos";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function market(overrides: Partial<PulseGlobalMarket>): PulseGlobalMarket {
  return {
    ticker: "DIA",
    name: "Dow Jones Industrial Average",
    changePercent: -0.2,
    price: 421.12,
    weight: 14,
    category: "Major Index",
    history: [],
    ...overrides,
  };
}

describe("index scoreboard", () => {
  it("keeps Dow, S&P, Nasdaq, and Russell in that order and drops extra index ETFs", () => {
    expect(INDEX_SCOREBOARD.map((entry) => entry.ticker)).toEqual(["DIA", "SPY", "QQQ", "IWM"]);
    const rows = scoreboardIndexes([
      market({ ticker: "RSP", name: "S&P 500 Equal Weight" }),
      market({ ticker: "IWM", name: "Russell 2000" }),
      market({ ticker: "QQQ", name: "Nasdaq 100" }),
      market({ ticker: "MDY", name: "S&P MidCap 400" }),
      market({ ticker: "SPY", name: "S&P 500" }),
      market({ ticker: "DIA" }),
    ]);

    expect(rows.map((row) => row.ticker)).toEqual(["DIA", "SPY", "QQQ", "IWM"]);
    expect(rows[0]?.name).toBe("Dow Jones");
    expect(rows.some((row) => row.ticker === "MDY" || row.ticker === "RSP")).toBe(false);
  });
});

describe("commodity scoreboard", () => {
  it("keeps oil, gold, silver, and gas in definition order", () => {
    expect(COMMODITY_SCOREBOARD.map((entry) => entry.ticker)).toEqual(["USO", "GLD", "SLV", "UNG"]);
    const rows = scoreboardCommodities([
      market({ ticker: "SLV", name: "iShares Silver Trust", category: "Commodity" }),
      market({ ticker: "UNG", name: "United States Natural Gas", category: "Commodity" }),
      market({ ticker: "GLD", name: "SPDR Gold Shares", category: "Commodity" }),
      market({ ticker: "USO", name: "United States Oil", category: "Commodity" }),
    ]);

    expect(rows.map((row) => row.ticker)).toEqual(["USO", "GLD", "SLV", "UNG"]);
    expect(rows[0]?.name).toBe("Crude Oil");
    expect(rows[1]?.name).toBe("Gold");
  });
});

describe("scoreboard LogoDisplay", () => {
  it("renders LogoDisplay on MarketScoreboard rows with Movers-matched chrome", () => {
    const board = read("src/components/market/IndexScoreboard.tsx");
    expect(board).toContain("LogoDisplay");
    expect(board).toContain('size="detail"');
    expect(board).toContain("pulse-index-logo");
    expect(read("src/app/globals.css")).toContain(".pulse-index-logo");
    expect(read("src/components/market/CryptoBoard.tsx")).toContain("MarketScoreboard");
  });

  it("covers Pulse scoreboard tickers with domains or sector badges", () => {
    const tickers = [
      ...INDEX_SCOREBOARD.map((e) => e.ticker),
      ...COMMODITY_SCOREBOARD.map((e) => e.ticker),
      "BTC-USD",
      "ETH-USD",
      "XRP-USD",
      "DOGE-USD",
      "ADA-USD",
      "EWJ",
      "MCHI",
      "EWU",
      "INDA",
      "EWT",
      "EWG",
      "XLK",
      "XLF",
      "XLV",
      "XLE",
      "XLI",
      "XLY",
      "XLP",
      "XLU",
      "XLRE",
      "XLC",
      "XLB",
    ];
    const missing = tickers.filter((t) => !hasDomainLogo(t) && !getSectorColors(t));
    expect(missing).toEqual([]);
  });
});
