/**
 * Size-aware evidence reweighting + mild blend tilt.
 * Complements the quality/evidence rubric — does not replace factor math.
 */

import type { EvidenceCategory } from "./types";
import { CATEGORY_WEIGHTS, EVIDENCE_CATEGORIES } from "./weights";
import {
  EVIDENCE_BLEND_WEIGHT,
  QUALITY_BLEND_WEIGHT,
} from "./quality/weights";

export type SizeBucket = "small" | "mid" | "large" | "mega" | "unknown";

/** Soft market-cap bands (USD). */
export function sizeBucketFromMarketCap(
  marketCap: number | null | undefined,
): SizeBucket {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap <= 0) {
    return "unknown";
  }
  if (marketCap < 2_000_000_000) return "small";
  if (marketCap < 50_000_000_000) return "mid";
  if (marketCap < 200_000_000_000) return "large";
  return "mega";
}

/**
 * Multipliers applied to default CATEGORY_WEIGHTS, then renormalized to 1.0.
 * Small names lean on insider + technicals; mega-caps lean on 13F + SI.
 */
const SIZE_CATEGORY_MULTIPLIERS: Record<
  SizeBucket,
  Record<EvidenceCategory, number>
> = {
  unknown: {
    institutional: 1,
    insider: 1,
    technicals: 1,
    short_interest: 1,
  },
  small: {
    institutional: 0.75,
    insider: 1.35,
    technicals: 1.2,
    short_interest: 0.9,
  },
  mid: {
    institutional: 1,
    insider: 1,
    technicals: 1,
    short_interest: 1,
  },
  large: {
    institutional: 1.15,
    insider: 0.85,
    technicals: 0.9,
    short_interest: 1.1,
  },
  mega: {
    institutional: 1.25,
    insider: 0.7,
    technicals: 0.85,
    short_interest: 1.15,
  },
};

export function evidenceWeightsForMarketCap(
  marketCap: number | null | undefined,
): Record<EvidenceCategory, number> {
  const bucket = sizeBucketFromMarketCap(marketCap);
  const multipliers = SIZE_CATEGORY_MULTIPLIERS[bucket];
  let sum = 0;
  const raw = {} as Record<EvidenceCategory, number>;
  for (const category of EVIDENCE_CATEGORIES) {
    raw[category] = CATEGORY_WEIGHTS[category] * multipliers[category];
    sum += raw[category];
  }
  const out = {} as Record<EvidenceCategory, number>;
  for (const category of EVIDENCE_CATEGORIES) {
    out[category] = sum > 0 ? raw[category] / sum : CATEGORY_WEIGHTS[category];
  }
  return out;
}

export interface BlendWeightPair {
  qualityWeight: number;
  evidenceWeight: number;
}

/**
 * Mild blend tilt by size — still quality-led; small-caps get a bit more
 * evidence reactivity, mega-caps lean further into quality.
 */
export function blendWeightsForMarketCap(
  marketCap: number | null | undefined,
): BlendWeightPair {
  const bucket = sizeBucketFromMarketCap(marketCap);
  switch (bucket) {
    case "small":
      return { qualityWeight: 0.58, evidenceWeight: 0.42 };
    case "large":
      return { qualityWeight: 0.68, evidenceWeight: 0.32 };
    case "mega":
      return { qualityWeight: 0.72, evidenceWeight: 0.28 };
    default:
      return {
        qualityWeight: QUALITY_BLEND_WEIGHT,
        evidenceWeight: EVIDENCE_BLEND_WEIGHT,
      };
  }
}
