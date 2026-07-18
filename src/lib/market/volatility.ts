import type { StockQuote } from "./types";

export function calculateRelativeVolatility(
  tickerQuote: StockQuote | undefined,
  indexQuote: StockQuote | undefined,
  volatilityThreshold: number = 1.5,
): boolean {
  if (!tickerQuote?.changePercent || !indexQuote?.changePercent) {
    return false; // Cannot calculate if data is missing
  }

  // Calculate relative movement: absolute change of ticker relative to index
  const tickerMovement = Math.abs(tickerQuote.changePercent);
  const indexMovement = Math.abs(indexQuote.changePercent);

  // Trigger if ticker's movement is significantly higher than the index's movement
  return tickerMovement > (indexMovement * volatilityThreshold);
}
