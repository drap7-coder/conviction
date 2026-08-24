import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";

/** Scoreboard names — short enough to read in one compact row. */
export const INDEX_SCOREBOARD: Array<{ ticker: string; name: string }> = [
  { ticker: "DIA", name: "Dow Jones" },
  { ticker: "SPY", name: "S&P 500" },
  { ticker: "QQQ", name: "Nasdaq 100" },
  { ticker: "IWM", name: "Russell 2000" },
];

export const COMMODITY_SCOREBOARD: Array<{ ticker: string; name: string }> = [
  { ticker: "USO", name: "Crude Oil" },
  { ticker: "GLD", name: "Gold" },
  { ticker: "SLV", name: "Silver" },
  { ticker: "UNG", name: "Natural Gas" },
];

function pickScoreboard(
  markets: PulseGlobalMarket[],
  entries: Array<{ ticker: string; name: string }>,
): PulseGlobalMarket[] {
  const byTicker = new Map(markets.map((market) => [market.ticker.toUpperCase(), market]));
  return entries.flatMap((entry) => {
    const market = byTicker.get(entry.ticker);
    return market ? [{ ...market, name: entry.name }] : [];
  });
}

export function scoreboardIndexes(markets: PulseGlobalMarket[]): PulseGlobalMarket[] {
  return pickScoreboard(markets, INDEX_SCOREBOARD);
}

export function scoreboardCommodities(markets: PulseGlobalMarket[]): PulseGlobalMarket[] {
  return pickScoreboard(markets, COMMODITY_SCOREBOARD);
}
