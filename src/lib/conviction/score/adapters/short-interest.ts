import type { ShortInterestRecord } from "@/lib/market/short-interest";
import { clampSignedScore, isSourceStale } from "../freshness";
import type { CategoryScore } from "../types";
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "../weights";

export interface ShortInterestCategoryInput {
  ticker: string;
  status?: string | null;
  latest: ShortInterestRecord | null;
  fetchedAt?: string | null;
  message?: string | null;
}

export function toShortInterestCategoryScore(
  input: ShortInterestCategoryInput,
  now = new Date(),
): CategoryScore {
  const ticker = input.ticker.toUpperCase();
  const updatedAt = input.fetchedAt ?? now.toISOString();
  const status = input.status ?? "empty";
  const failed =
    status === "timeout"
    || status === "error"
    || status === "unsupported"
    || status === "empty";
  const latest = input.latest;

  if (failed || !latest || status !== "success") {
    return {
      ticker,
      category: "short_interest",
      score: 0,
      baseWeight: CATEGORY_WEIGHTS.short_interest,
      hasData: false,
      isStale: false,
      sourceDate: null,
      updatedAt,
      explanation:
        input.message
        ?? (status === "unsupported"
          ? "Short interest is not supported for this issuer."
          : "Short interest data is unavailable."),
      scoringVersion: SCORING_VERSION,
    };
  }

  // Blend level (days to cover) with trend (Δ%). High + rising SI is most bearish.
  const changeScore = clampSignedScore(-latest.changePercent);
  let levelScore = 0;
  if (latest.daysToCover >= 8) levelScore = -35;
  else if (latest.daysToCover >= 5) levelScore = -18;
  else if (latest.daysToCover >= 3) levelScore = -5;
  else if (latest.daysToCover > 0 && latest.daysToCover < 2) levelScore = 12;

  let score = clampSignedScore(changeScore * 0.65 + levelScore * 0.35);
  if (latest.daysToCover >= 5 && latest.changePercent > 0) {
    score = clampSignedScore(score - 12);
  } else if (latest.daysToCover >= 5 && latest.changePercent < 0) {
    score = clampSignedScore(score + 10);
  }

  const sourceDate = latest.settlementDate;
  const isStale = isSourceStale(sourceDate, now);
  const changeText = `${latest.changePercent > 0 ? "+" : ""}${latest.changePercent.toFixed(1)}%`;
  const explanation = `Short interest ${latest.changePercent >= 0 ? "rose" : "fell"} ${changeText}; ${latest.daysToCover.toFixed(1)} days to cover.`;

  return {
    ticker,
    category: "short_interest",
    score,
    baseWeight: CATEGORY_WEIGHTS.short_interest,
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
