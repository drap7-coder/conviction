import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";

/** Scoreboard names — short enough to read in one compact row. */
export const INDEX_SCOREBOARD: Array<{ ticker: string; name: string }> = [
  { ticker: "DIA", name: "Dow Jones" },
  { ticker: "SPY", name: "S&P 500" },
  { ticker: "QQQ", name: "Nasdaq 100" },
  { ticker: "IWM", name: "Russell 2000" },
];

export function scoreboardIndexes(markets: PulseGlobalMarket[]): PulseGlobalMarket[] {
  const byTicker = new Map(markets.map((market) => [market.ticker.toUpperCase(), market]));
  return INDEX_SCOREBOARD.flatMap((entry) => {
    const market = byTicker.get(entry.ticker);
    return market ? [{ ...market, name: entry.name }] : [];
  });
}
