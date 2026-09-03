/**
 * Crowd My Picks premise: every player starts with a fictional $100,000 book.
 * Dollars are derived at read time from equal-weight % returns — no extra storage
 * or market calls.
 *
 * School / campus performance is the **average** student balance (avg return % on
 * one $100k book). Headcount must not inflate dollar P&L. Missing/flat returns
 * still show the starting $100,000 — never an empty dash.
 */

export const PLAYER_BANKROLL_USD = 100_000;

function coerceReturnPct(returnPct: number | null | undefined): number {
  if (returnPct === null || returnPct === undefined || !Number.isFinite(returnPct)) return 0;
  return returnPct;
}

/** Apply a return % to a bankroll → ending notional value. Always a number. */
export function notionalValueUsd(
  returnPct: number | null | undefined,
  bankrollUsd: number = PLAYER_BANKROLL_USD,
): number {
  const pct = coerceReturnPct(returnPct);
  if (!Number.isFinite(bankrollUsd)) return PLAYER_BANKROLL_USD;
  return Math.round(bankrollUsd * (1 + pct / 100));
}

/** Dollar P&L on a bankroll for a return %. Null/flat → $0. */
export function notionalDeltaUsd(
  returnPct: number | null | undefined,
  bankrollUsd: number = PLAYER_BANKROLL_USD,
): number {
  return notionalValueUsd(returnPct, bankrollUsd) - Math.round(
    Number.isFinite(bankrollUsd) ? bankrollUsd : PLAYER_BANKROLL_USD,
  );
}

/**
 * Average student balance for a campus — same as one $100k book at the school's
 * average return. Independent of member count. Always populated (defaults to $100k).
 */
export function averageStudentBalanceUsd(avgReturnPct: number | null | undefined): number {
  return notionalValueUsd(avgReturnPct, PLAYER_BANKROLL_USD);
}

/** `$100,000` / `$1.2M` — compact whole dollars. */
export function formatUsd(value: number): string {
  const abs = Math.abs(Math.round(value));
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const text = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, "");
    return `${value < 0 ? "-$" : "$"}${text}M`;
  }
  return `${value < 0 ? "-$" : "$"}${abs.toLocaleString("en-US")}`;
}

/** `+$1,240` / `-$890` / `$0`. Nullish → `$0` (starting book). */
export function formatUsdDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "$0";
  const rounded = Math.round(value);
  if (rounded === 0) return "$0";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}
