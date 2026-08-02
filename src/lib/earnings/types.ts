export interface EarningsQuarter {
  fiscalQuarter: string;
  reportedDate: string;
  actualEps: number;
  estimatedEps: number;
  surprisePercent: number;
}

export interface EarningsForecast {
  fiscalQuarter: string;
  consensusEps: number;
  revisionsUp: number;
  revisionsDown: number;
}

export type AnalystGradeDirection =
  | "upgrade"
  | "downgrade"
  | "maintain"
  | "initiate"
  | "other";

/** Recent Street rating action from FMP `/grades` (explanatory, not scored). */
export interface AnalystGradeAction {
  date: string;
  firm: string | null;
  action: string;
  previousGrade: string | null;
  newGrade: string | null;
  direction: AnalystGradeDirection;
}

export interface EarningsEvidence {
  ticker: string;
  history: EarningsQuarter[];
  forecasts: EarningsForecast[];
  /** Structured analyst grade actions when FMP grades are available. */
  gradeActions: AnalystGradeAction[];
  historyScore: number | null;
  revisionScore: number | null;
  score: number | null;
  momentum: "Estimates rising" | "Estimates falling" | "Stable" | "Unavailable";
  nextEarningsDate: string | null;
  asOf: string | null;
  source: "fmp" | "nasdaq" | "unavailable";
  status: "success" | "partial" | "unavailable";
  message?: string;
}
