/**
 * Quality half of Conviction Score — slow-moving business strength.
 * Separate from evidence categories (filings, technicals, short interest).
 */

export type QualityFactorId =
  | "margin_moat"
  | "balance_sheet"
  | "fcf_strength"
  | "earnings_consistency"
  | "ownership_base"
  | "capital_return";

export interface QualityFactorScore {
  factor: QualityFactorId;
  /** Signed contribution in [-100, +100]. */
  score: number;
  baseWeight: number;
  hasData: boolean;
  explanation: string;
}

export interface QualityCompositeResult {
  score: number | null;
  coverage: number;
  includedFactors: QualityFactorId[];
  excludedFactors: QualityFactorId[];
  factors: QualityFactorScore[];
}
