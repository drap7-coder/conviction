/**
 * Normalize political disclosure trades into a CategoryScore.
 * Uses purchase/sale dollar lean already computed in the canonical model.
 */

import type { PoliticalTradeSummary } from "@/lib/political-trades";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

/** Political filings stay relevant longer than market prints. */
const POLITICAL_STALE_DAYS = 180;

export type PoliticalCategoryInput = PoliticalTradeSummary & {
  status?: string | null;
  message?: string | null;
};

export function toPoliticalCategoryScore(
  input: PoliticalCategoryInput,
  now = new Date(),
): CategoryScore {
  const ticker = input.ticker.toUpperCase();
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const failed = input.status === "timeout" || input.status === "error";
  const buys = input.totalEstimatedPurchases ?? 0;
  const sells = input.totalEstimatedSales ?? 0;
  const total = buys + sells;
  const hasActivity = !failed && total > 0;

  if (!hasActivity) {
    return {
      ticker,
      category: "political",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.political,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        input.message
        ?? (failed
          ? "Political disclosure data could not be loaded."
          : "No recent political purchase/sale disclosures for this name."),
      scoringVersion: SCORING_VERSION,
    };
  }

  const score = clampSignedScore(((buys - sells) / total) * 100);
  const sourceDate = input.latestFilingDate;
  const isStale = isSourceStale(sourceDate, now, POLITICAL_STALE_DAYS);
  const purchaseCount = input.purchases?.length ?? 0;
  const saleCount = input.sales?.length ?? 0;
  const explanation =
    score > 10
      ? `Political disclosures lean buy (${purchaseCount} purchases / ${saleCount} sales).`
      : score < -10
        ? `Political disclosures lean sell (${purchaseCount} purchases / ${saleCount} sales).`
        : `Political disclosures are balanced (${purchaseCount} purchases / ${saleCount} sales).`;

  return {
    ticker,
    category: "political",
    score,
    baseWeight: CATEGORY_WEIGHTS.political,
    hasData: true,
    isStale,
    sourceDate,
    updatedAt,
    explanation: isStale
      ? `${explanation} Evidence is stale and excluded from the composite.`
      : explanation,
    scoringVersion: SCORING_VERSION,
  };
}
