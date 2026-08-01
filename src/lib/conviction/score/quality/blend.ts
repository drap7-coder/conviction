/**
 * Final Conviction Score = quality × ~0.65 + evidence × ~0.35.
 *
 * evidenceComposite is exactly calculateConvictionScore(...) — untouched.
 * Size can mildly tilt the blend weights; labels apply to the blended score.
 */

import { labelForScore } from "../labels";
import { blendWeightsForMarketCap } from "../size-regime";
import type { ConvictionScoreLabel, ConvictionScoreResult } from "../types";
import type { QualityCompositeResult } from "./types";
import { EVIDENCE_BLEND_WEIGHT, QUALITY_BLEND_WEIGHT } from "./weights";

export interface BlendedConvictionScore {
  /** Final signed score used for labels / rings, or null when evidence is insufficient. */
  score: number | null;
  label: ConvictionScoreLabel;
  evidenceScore: number | null;
  qualityScore: number | null;
  evidenceWeight: number;
  qualityWeight: number;
  blended: boolean;
  evidence: ConvictionScoreResult;
  quality: QualityCompositeResult;
}

export interface BlendOptions {
  /** Yahoo market cap — mild size tilt on quality/evidence blend weights. */
  marketCap?: number | null;
}

function clampScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

/**
 * Compose the single Conviction Score every UI surface should show.
 *
 * - Evidence insufficient → withhold (quality alone does not mint a score)
 * - Quality missing → fall back to evidence (prior behavior)
 * - Both present → quality-led blend; agreement stays inside evidence only
 */
export function blendEvidenceAndQuality(
  evidence: ConvictionScoreResult,
  quality: QualityCompositeResult,
  options: BlendOptions = {},
): BlendedConvictionScore {
  const { qualityWeight, evidenceWeight } = blendWeightsForMarketCap(
    options.marketCap,
  );

  if (evidence.score === null) {
    return {
      score: null,
      label: "insufficient_evidence",
      evidenceScore: null,
      qualityScore: quality.score,
      evidenceWeight: evidenceWeight || EVIDENCE_BLEND_WEIGHT,
      qualityWeight: qualityWeight || QUALITY_BLEND_WEIGHT,
      blended: false,
      evidence,
      quality,
    };
  }

  if (quality.score === null) {
    return {
      score: evidence.score,
      label: evidence.label,
      evidenceScore: evidence.score,
      qualityScore: null,
      evidenceWeight,
      qualityWeight,
      blended: false,
      evidence,
      quality,
    };
  }

  const score = clampScore(
    quality.score * qualityWeight + evidence.score * evidenceWeight,
  );

  return {
    score,
    label: labelForScore(score),
    evidenceScore: evidence.score,
    qualityScore: quality.score,
    evidenceWeight,
    qualityWeight,
    blended: true,
    evidence,
    quality,
  };
}
