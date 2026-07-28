/**
 * Normalize 13F institutional evidence into a CategoryScore.
 * Remaps the existing 0–100 ring score onto [-100, +100] so the
 * institutional category stays consistent with Quotes dial math.
 */

import { scoreInstitutionalConviction } from "@/lib/market/quote-gauges";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

export interface InstitutionalCategoryInput {
  results: InstitutionalAccumulation[];
  status?: string | null;
  fetchedAt?: string | null;
  message?: string | null;
}

function latestFilingDate(results: InstitutionalAccumulation[]): string | null {
  const dates = results
    .map((row) => row.filingDate)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return dates[0] ?? null;
}

export function toInstitutionalCategoryScore(
  ticker: string,
  input: InstitutionalCategoryInput,
  now = new Date(),
): CategoryScore {
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const failed = input.status === "timeout" || input.status === "error";
  const ring = scoreInstitutionalConviction(input.results ?? []);
  const sourceDate = latestFilingDate(input.results ?? []);
  const hasData = !failed && ring.score !== null;

  if (!hasData) {
    return {
      ticker: ticker.toUpperCase(),
      category: "institutional",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.institutional,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        input.message
        ?? (failed
          ? "Institutional filings could not be loaded."
          : "No tracked manager filings for this name yet."),
      scoringVersion: SCORING_VERSION,
    };
  }

  // Ring is centered at 50 (holding). Map to signed [-100, +100].
  const score = clampSignedScore((ring.score! - 50) * 2);
  const isStale = isSourceStale(sourceDate, now);

  return {
    ticker: ticker.toUpperCase(),
    category: "institutional",
    score,
    baseWeight: CATEGORY_WEIGHTS.institutional,
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
