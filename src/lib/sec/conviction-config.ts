/**
 * Conviction scoring configuration.
 *
 * All weights live here — not hardcoded in the engine.
 * Only economically meaningful transactions affect the score.
 */

import type { InsiderTransactionType } from "./types";

export interface TransactionWeight {
  /** Base conviction score contribution */
  base: number;
  /** Whether this transaction type is economically meaningful */
  meaningful: boolean;
  /** Human-readable label */
  label: string;
}

/**
 * Per-type conviction weights.
 *
 * Rule of thumb:
 *   Open-market purchase (P)      +100  — strongest signal of insider confidence
 *   Open-market sale (S/D)         -40  — weaker signal (many reasons to sell)
 *   Everything else                  0  — routine compensation, ignored
 */
export const TX_WEIGHTS: Record<InsiderTransactionType, TransactionWeight> = {
  purchase:      { base: 100, meaningful: true,  label: "Open Market Purchase" },
  sale:          { base: -40, meaningful: true,  label: "Open Market Sale" },
  grant:         { base: 0,   meaningful: false, label: "Equity Grant" },
  option_exercise: { base: 0, meaningful: false, label: "Option Exercise" },
  gift:          { base: 0,   meaningful: false, label: "Gift" },
  tax_withholding: { base: 0, meaningful: false, label: "Tax Withholding" },
  other:         { base: 0,   meaningful: false, label: "Other" },
};

/**
 * Role multipliers applied on top of the base weight.
 * CEO/CFO actions carry more signal than directors or officers.
 */
export interface RoleMultiplier {
  isDirector?: number;
  isOfficer?: number;
  roleTitleMatch?: { pattern: RegExp; multiplier: number }[];
}

export const ROLE_MULTIPLIERS: RoleMultiplier = {
  isDirector: 1.0,
  isOfficer: 0.8,
  roleTitleMatch: [
    { pattern: /\b(?:ceo|chief executive|president)\b/i, multiplier: 3.0 },
    { pattern: /\b(?:cfo|chief financial)\b/i, multiplier: 2.5 },
    { pattern: /\b(?:coo|chief operating)\b/i, multiplier: 2.0 },
    { pattern: /\b(?:chief|chairman|chair)\b/i, multiplier: 1.5 },
  ],
};

/**
 * Time window (in days) for conviction scoring.
 * Only transactions within this window affect the current score.
 */
export const CONVICTION_WINDOW_DAYS = 90;

/**
 * Minimum transaction value (in dollars) to count for conviction.
 * Tiny de minimis transactions are ignored.
 */
export const MIN_VALUE_THRESHOLD = 10_000;