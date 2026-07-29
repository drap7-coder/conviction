/**
 * Normalize 13F fund evidence into a CategoryScore.
 * Filters filings by fund kind (hedge vs investment) and remaps the
 * existing 0–100 ring score onto [-100, +100].
 */

import { scoreInstitutionalConviction } from "@/lib/market/quote-gauges";
import {
  filterAccumulationsByFundKind,
  type InstitutionalAccumulation,
} from "@/lib/sec/institutional";
import type { FundKind } from "@/lib/sec/institutional-managers";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore, EvidenceCategory } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

export interface InstitutionalCategoryInput {
  results: InstitutionalAccumulation[];
  status?: string | null;
  fetchedAt?: string | null;
  message?: string | null;
}

const FUND_CATEGORY_BY_KIND = {
  hedge_fund: "hedge_funds",
  investment_fund: "investment_funds",
} as const satisfies Record<FundKind, EvidenceCategory>;

const CATEGORY_LABEL: Record<"hedge_funds" | "investment_funds", string> = {
  hedge_funds: "Hedge fund",
  investment_funds: "Investment fund",
};

function latestFilingDate(results: InstitutionalAccumulation[]): string | null {
  const dates = results
    .map((row) => row.filingDate)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return dates[0] ?? null;
}

export function toFundCategoryScore(
  ticker: string,
  input: InstitutionalCategoryInput,
  fundKind: FundKind,
  now = new Date(),
): CategoryScore {
  const category = FUND_CATEGORY_BY_KIND[fundKind];
  const label = CATEGORY_LABEL[category];
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const failed = input.status === "timeout" || input.status === "error";
  const filtered = filterAccumulationsByFundKind(input.results ?? [], fundKind);
  const ring = scoreInstitutionalConviction(filtered);
  const sourceDate = latestFilingDate(filtered);
  const hasData = !failed && ring.score !== null;

  if (!hasData) {
    return {
      ticker: ticker.toUpperCase(),
      category,
      score: 0,
      baseWeight: CATEGORY_WEIGHTS[category],
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        input.message
        ?? (failed
          ? `${label} filings could not be loaded.`
          : `No tracked ${label.toLowerCase()} filings for this name yet.`),
      scoringVersion: SCORING_VERSION,
    };
  }

  // Ring is centered at 50 (holding). Map to signed [-100, +100].
  const score = clampSignedScore((ring.score! - 50) * 2);
  const isStale = isSourceStale(sourceDate, now);

  return {
    ticker: ticker.toUpperCase(),
    category,
    score,
    baseWeight: CATEGORY_WEIGHTS[category],
    hasData: true,
    isStale,
    sourceDate,
    updatedAt,
    explanation: isStale
      ? `${ring.detail} Evidence is stale and excluded from the composite.`
      : ring.detail,
    scoringVersion: SCORING_VERSION,
  };
}

/** @deprecated Prefer toFundCategoryScore with an explicit fund kind. */
export function toInstitutionalCategoryScore(
  ticker: string,
  input: InstitutionalCategoryInput,
  now = new Date(),
): CategoryScore {
  return toFundCategoryScore(ticker, input, "hedge_fund", now);
}
