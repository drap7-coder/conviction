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

export interface EarningsEvidence {
  ticker: string;
  history: EarningsQuarter[];
  forecasts: EarningsForecast[];
  historyScore: number | null;
  revisionScore: number | null;
  score: number | null;
  momentum: "Estimates rising" | "Estimates falling" | "Stable" | "Unavailable";
  nextEarningsDate: string | null;
  asOf: string | null;
  source: "nasdaq" | "unavailable";
  status: "success" | "partial" | "unavailable";
  message?: string;
}
