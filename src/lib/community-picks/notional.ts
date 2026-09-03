/**
 * Crowd My Picks premise: every player starts with a fictional $100,000 book.
 * Dollars are derived at read time from equal-weight % returns — no extra storage
 * or market calls.
 *
 * School / campus performance is the **average** student balance (avg return % on
 * one $100k book). Headcount must not inflate dollar P&L.
 */

export const PLAYER_BANKROLL_USD = 100_000;

/** Apply a return % to a bankroll → ending notional value. */
export function notionalValueUsd(
  returnPct: number | null,
  bankrollUsd: number = PLAYER_BANKROLL_USD,
): number | null {
  if (returnPct === null || !Number.isFinite(returnPct) || !Number.isFinite(bankrollUsd)) {
    return null;
  }
  return Math.round(bankrollUsd * (1 + returnPct / 100));
}

/** Dollar P&L on a bankroll for a return %. */
export function notionalDeltaUsd(
  returnPct: number | null,
  bankrollUsd: number = PLAYER_BANKROLL_USD,
): number | null {
  const value = notionalValueUsd(returnPct, bankrollUsd);
  if (value === null) return null;
  return value - Math.round(bankrollUsd);
}

/**
 * Average student balance for a campus — same as one $100k book at the school's
 * average return. Independent of member count.
 */
export function averageStudentBalanceUsd(avgReturnPct: number | null): number | null {
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

/** `+$1,240` / `-$890` / `$0`. */
export function formatUsdDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  if (rounded === 0) return "$0";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}
