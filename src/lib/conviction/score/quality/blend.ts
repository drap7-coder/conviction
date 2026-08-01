/**
 * Final Conviction Score = quality × 0.65 + evidence × 0.35.
 *
 * evidenceComposite is exactly calculateConvictionScore(...) — untouched.
 * Labels apply to the blended score, not either half alone.
 */

import { labelForScore } from "../labels";
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

function clampScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

/**
 * Compose the single Conviction Score every UI surface should show.
 *
 * - Evidence insufficient → withhold (quality alone does not mint a score)
 * - Quality missing → fall back to evidence (prior behavior)
 * - Both present → 65/35 blend; agreement stays inside evidence only
 */
export function blendEvidenceAndQuality(
  evidence: ConvictionScoreResult,
  quality: QualityCompositeResult,
): BlendedConvictionScore {
  if (evidence.score === null) {
    return {
      score: null,
      label: "insufficient_evidence",
      evidenceScore: null,
      qualityScore: quality.score,
      evidenceWeight: EVIDENCE_BLEND_WEIGHT,
      qualityWeight: QUALITY_BLEND_WEIGHT,
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
      evidenceWeight: EVIDENCE_BLEND_WEIGHT,
      qualityWeight: QUALITY_BLEND_WEIGHT,
      blended: false,
      evidence,
      quality,
    };
  }

  const score = clampScore(
    quality.score * QUALITY_BLEND_WEIGHT + evidence.score * EVIDENCE_BLEND_WEIGHT,
  );

  return {
    score,
    label: labelForScore(score),
    evidenceScore: evidence.score,
    qualityScore: quality.score,
    evidenceWeight: EVIDENCE_BLEND_WEIGHT,
    qualityWeight: QUALITY_BLEND_WEIGHT,
    blended: true,
    evidence,
    quality,
  };
}
