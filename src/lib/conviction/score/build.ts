/**
 * Assemble CategoryScore inputs and compute the composite Conviction Score.
 * Unwired categories (technicals, short_interest, political, social) are
 * included as hasData: false placeholders so coverage math stays honest.
 */

import { toEarningsCategoryScore } from "./adapters/earnings";
import { toInstitutionalCategoryScore, type InstitutionalCategoryInput } from "./adapters/institutional";
import { calculateConvictionScore } from "./calculate";
import type {
  CategoryScore,
  ConvictionScoreLabel,
  ConvictionScoreResult,
  EvidenceCategory,
} from "./types";
import { CATEGORY_WEIGHTS, EVIDENCE_CATEGORIES, SCORING_VERSION } from "./weights";
import type { EarningsEvidence } from "@/lib/earnings/types";

const UNWIRED: EvidenceCategory[] = [
  "technicals",
  "short_interest",
  "political",
  "social",
];

export type CompositeTone = "green" | "amber" | "red" | "neutral";

export interface BuildConvictionScoreInput {
  ticker: string;
  institutional?: InstitutionalCategoryInput | null;
  earnings?: EarningsEvidence | null;
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
    explanation: `${category.replace(/_/g, " ")} evidence is not wired yet.`,
    scoringVersion: SCORING_VERSION,
  };
}

export function buildCategoryScores(input: BuildConvictionScoreInput): CategoryScore[] {
  const now = input.now ?? new Date();
  const ticker = input.ticker.toUpperCase();
  const categories: CategoryScore[] = [];

  categories.push(
    input.institutional
      ? toInstitutionalCategoryScore(ticker, input.institutional, now)
      : emptyCategory(ticker, "institutional", now),
  );

  categories.push(
    input.earnings
      ? toEarningsCategoryScore(input.earnings, now)
      : emptyCategory(ticker, "earnings", now),
  );

  for (const category of UNWIRED) {
    categories.push(emptyCategory(ticker, category, now));
  }

  // Keep a stable order matching EVIDENCE_CATEGORIES.
  return EVIDENCE_CATEGORIES.map(
    (category) => categories.find((item) => item.category === category)!,
  );
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

/** Map signed [-100, +100] onto the GaugeRing's 0–100 arc. */
export function dialValueFromScore(score: number | null): number | null {
  if (score === null || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, (score + 100) / 2));
}

export function formatCoverageSources(included: EvidenceCategory[]): string {
  if (included.length === 0) return "no category data";
  return included.map((category) => category.replace(/_/g, " ")).join(" + ");
}
