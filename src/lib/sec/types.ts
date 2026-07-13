/**
 * Types for SEC EDGAR Form 4 insider transaction data.
 */

export type TransactionCode = "P" | "S" | "A" | "D" | "F" | "I" | "M" | "W" | "U" | "X" | "G" | "J" | "L" | "K" | "Z" | "C" | "V";

export const TRANSACTION_CODE_LABELS: Record<TransactionCode, string> = {
  P: "Open-market purchase",
  S: "Open-market sale",
  A: "Grant/award",
  D: "Sale to issuer",
  F: "Tax withholding",
  I: "Discretionary transaction",
  M: "Exercise/derivative",
  W: "Disposition",
  U: "Disposition under plan",
  X: "Exercise of derivative",
  G: "Gift",
  J: "Discretionary transaction",
  L: "Small acquisition",
  K: "Equity swap",
  Z: "Other",
  C: "Conversion/exercise",
  V: "Other (voluntary reporting)",
};

/**
 * Normalized insider transaction type — maps SEC codes to meaningful categories.
 * Only P and S are economically directional.
 */
export type InsiderTransactionType =
  | "purchase"
  | "sale"
  | "grant"
  | "option_exercise"
  | "gift"
  | "tax_withholding"
  | "other";

/** Mapping: SEC transaction code → InsiderTransactionType */
export const CODE_TO_TYPE: Record<TransactionCode, InsiderTransactionType> = {
  P: "purchase",
  S: "sale",
  D: "sale",
  A: "grant",
  M: "option_exercise",
  C: "option_exercise",
  G: "gift",
  F: "tax_withholding",
  V: "other",
  I: "other",
  W: "other",
  U: "other",
  X: "other",
  J: "other",
  L: "other",
  K: "other",
  Z: "other",
};

export const TX_TYPE_LABELS: Record<InsiderTransactionType, string> = {
  purchase: "Open Market Purchase",
  sale: "Open Market Sale",
  grant: "Equity Grant",
  option_exercise: "Option Exercise",
  gift: "Gift",
  tax_withholding: "Tax Withholding",
  other: "Other",
};

export function codeToType(code: TransactionCode): InsiderTransactionType {
  return CODE_TO_TYPE[code] || "other";
}

export function isDirectionalType(txType: InsiderTransactionType): boolean {
  return txType === "purchase" || txType === "sale";
}

/**
 * Core normalized insider transaction — never exposes raw SEC XML.
 */
export interface InsiderTransaction {
  /** Unique deduplication key */
  id: string;
  ticker: string;
  cik: string;
  accessionNumber: string;
  /** SEC filing detail page URL */
  filingUrl: string;

  /** Insider info */
  insiderName: string;
  insiderRole: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;

  /** Transaction details */
  transactionDate: string; // ISO date (trade date)
  filingDate: string; // ISO date
  transactionCode: TransactionCode; // Original SEC code (for debugging)
  transactionType: InsiderTransactionType; // Normalized type
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwnedAfter: number | null;
  isDirectOwnership: boolean;

  /** Derived */
  ownershipChange: number | null; // percentage change in ownership
}

export interface InsiderTransactionEvent {
  id: string;
  ticker: string;
  type: "insider-buy" | "insider-sell" | "insider-transaction";
  direction: "positive" | "negative" | "neutral";
  title: string;
  summary: string;
  source: "sec-edgar";
  sourceUrl: string;
  date: string;
  disclosureDelay: number;
  size: number; // 0-1 normalized
  strength: number; // 0-1
  isContradiction: boolean;
  aiExplanation: string;
  metadata: {
    insiderName: string;
    insiderRole: string | null;
    transactionClass: string;
    transactionType: InsiderTransactionType;
    shares: number;
    totalValue: number | null;
    sharesOwnedAfter: number | null;
  };
}

export interface SecSubmissionResult {
  transactions: InsiderTransaction[];
  errors: string[];
  fetchedAt: string;
}

export interface SecProviderState {
  lastFetchByTicker: Record<string, string>;
  dedupKeys: string[];
  transactionsByTicker: Record<string, InsiderTransaction[]>;
}

export interface EmergingInsiderCandidate {
  ticker: string;
  name: string;
  transactionCount: number;
  totalValue: number;
  uniqueInsiders: number;
  latestDate: string;
  averageStrength: number;
}