/**
 * Types for SEC EDGAR Form 4 insider transaction data.
 */

export type TransactionCode = "P" | "S" | "A" | "D" | "F" | "I" | "M" | "W" | "U" | "X" | "G" | "J" | "L" | "K" | "Z";

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
};

export type TransactionClass =
  | "open-market-purchase"
  | "open-market-sale"
  | "grant"
  | "exercise"
  | "tax-withholding"
  | "automatic-plan-sale"
  | "disposition"
  | "gift"
  | "other";

export function classifyTransactionCode(code: TransactionCode): TransactionClass {
  switch (code) {
    case "P": return "open-market-purchase";
    case "S": return "open-market-sale";
    case "A": return "grant";
    case "M":
    case "X": return "exercise";
    case "F": return "tax-withholding";
    case "U": return "automatic-plan-sale";
    case "D": return "disposition";
    case "G": return "gift";
    default: return "other";
  }
}

export function isDirectionalTransaction(cls: TransactionClass): boolean {
  return cls === "open-market-purchase" || cls === "open-market-sale";
}

export interface InsiderTransaction {
  /** Unique deduplication key */
  id: string;
  ticker: string;
  cik: string;
  accessionNumber: string;
  /** SEC filing URL */
  filingUrl: string;

  /** Insider info */
  insiderName: string;
  insiderRole: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;

  /** Transaction details */
  transactionDate: string; // ISO date
  filingDate: string; // ISO date
  transactionCode: TransactionCode;
  transactionClass: TransactionClass;
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
  lastFetchByTicker: Record<string, string>; // ticker → ISO timestamp
  dedupKeys: string[]; // known transaction IDs
  emergingCandidates: Record<string, EmergingInsiderCandidate>;
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