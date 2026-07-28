/**
 * Assemble CategoryScore inputs and compute the composite Conviction Score.
 * Social remains unwired (hasData: false) until a reliable source lands.
 */

import { toEarningsCategoryScore } from "./adapters/earnings";
import { toInstitutionalCategoryScore, type InstitutionalCategoryInput } from "./adapters/institutional";
import { toPoliticalCategoryScore, type PoliticalCategoryInput } from "./adapters/political";
import { toShortInterestCategoryScore, type ShortInterestCategoryInput } from "./adapters/short-interest";
import { toTechnicalsCategoryScore, type TechnicalCategoryInput } from "./adapters/technicals";
import { calculateConvictionScore } from "./calculate";
import type {
  CategoryScore,
  ConvictionScoreLabel,
  ConvictionScoreResult,
  EvidenceCategory,
} from "./types";
import { CATEGORY_WEIGHTS, EVIDENCE_CATEGORIES, SCORING_VERSION } from "./weights";
import type { EarningsEvidence } from "@/lib/earnings/types";

export type CompositeTone = "green" | "amber" | "red" | "neutral";

export interface BuildConvictionScoreInput {
  ticker: string;
  institutional?: InstitutionalCategoryInput | null;
  earnings?: EarningsEvidence | null;
  technicals?: TechnicalCategoryInput | null;
  shortInterest?: ShortInterestCategoryInput | null;
  political?: PoliticalCategoryInput | null;
  now?: Date;
}

function emptyCategory(ticker: string, category: EvidenceCategory, now: Date): CategoryScore {
  return {
    ticker: ticker.toUpperCase(),
    category,
    score: 0,
    baseWeight: CATEGORY_WEIGHTS[category],
    hasData: false,
    isStale: false,
    sourceDate: null,
    updatedAt: now.toISOString(),
    explanation:
      category === "social"
        ? "Social evidence is not wired yet."
        : `${category.replace(/_/g, " ")} evidence is unavailable.`,
    scoringVersion: SCORING_VERSION,
  };
}

export function buildCategoryScores(input: BuildConvictionScoreInput): CategoryScore[] {
  const now = input.now ?? new Date();
  const ticker = input.ticker.toUpperCase();

  const byCategory: Record<EvidenceCategory, CategoryScore> = {
    institutional: input.institutional
      ? toInstitutionalCategoryScore(ticker, input.institutional, now)
      : emptyCategory(ticker, "institutional", now),
    earnings: input.earnings
      ? toEarningsCategoryScore(input.earnings, now)
      : emptyCategory(ticker, "earnings", now),
    technicals: input.technicals
      ? toTechnicalsCategoryScore(ticker, input.technicals, now)
      : emptyCategory(ticker, "technicals", now),
    short_interest: input.shortInterest
      ? toShortInterestCategoryScore(
          { ...input.shortInterest, ticker: input.shortInterest.ticker || ticker },
          now,
        )
      : emptyCategory(ticker, "short_interest", now),
    political: input.political
      ? toPoliticalCategoryScore(input.political, now)
      : emptyCategory(ticker, "political", now),
    social: emptyCategory(ticker, "social", now),
  };

  return EVIDENCE_CATEGORIES.map((category) => byCategory[category]);
}

export function buildConvictionScore(input: BuildConvictionScoreInput): ConvictionScoreResult {
  return calculateConvictionScore(buildCategoryScores(input));
}

/** Display labels for the ring UI (match existing legend language). */
export type ConvictionDisplayLabel =
  | "Accumulating"
  | "Holding"
  | "Distribution"
  | "Unavailable";

export function displayLabelForComposite(
  label: ConvictionScoreLabel,
): ConvictionDisplayLabel {
  if (label === "strong_positive" || label === "positive") return "Accumulating";
  if (label === "mixed") return "Holding";
  if (label === "negative" || label === "strong_negative") return "Distribution";
  return "Unavailable";
}

export function toneForComposite(label: ConvictionScoreLabel): CompositeTone {
  if (label === "strong_positive" || label === "positive") return "green";
  if (label === "mixed") return "amber";
  if (label === "negative" || label === "strong_negative") return "red";
  return "neutral";
}

/** Map signed [-100, +100] onto a 0–100 display / dial scale. */
export function dialValueFromScore(score: number | null): number | null {
  if (score === null || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, (score + 100) / 2));
}

/** Integer 0–100 shown in the UI (null when insufficient evidence). */
export function displayScoreFromSigned(score: number | null): number | null {
  const dial = dialValueFromScore(score);
  return dial === null ? null : Math.round(dial);
}

export function formatCoverageSources(included: EvidenceCategory[]): string {
  if (included.length === 0) return "no category data";
  return included.map((category) => category.replace(/_/g, " ")).join(" + ");
}
