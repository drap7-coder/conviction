import { isFiniteNumber } from "./format";

type SessionFields = {
  sessionLabel?: string | null;
  extendedPrice?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  regularChangePercent?: number | null;
  changePercent?: number | null;
};

export function hasExtendedPrint(quote: SessionFields): boolean {
  return (quote.sessionLabel === "Pre-Market" || quote.sessionLabel === "After Hours")
    && !quote.extendedNoTrades && isFiniteNumber(quote.extendedPrice);
}

/** Missing extended prints are unknown, not unchanged or yesterday's move. */
export function activeSessionPercent(quote: SessionFields): number | null {
  const extended = quote.sessionLabel === "Pre-Market" || quote.sessionLabel === "After Hours";
  const value = extended
    ? (hasExtendedPrint(quote) ? quote.extendedChangePercent : null)
    : (quote.regularChangePercent ?? quote.changePercent);
  return isFiniteNumber(value) ? value : null;
}
