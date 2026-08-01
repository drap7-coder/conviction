/**
 * Display DTO for the shared Conviction Score.
 * Safe to import from client components (no server fetchers).
 */

import type { CompositeTone, ConvictionDisplayLabel } from "./build";
import type { QualityFactorId } from "./quality/types";
import type { ConvictionScoreLabel, EvidenceCategory } from "./types";

export interface ConvictionScoreView {
  ticker: string;
  /** Final signed composite in [-100, +100], or null when coverage is too low. */
  score: number | null;
  /** 0–100 ring value, or null when unavailable. */
  displayScore: number | null;
  label: ConvictionScoreLabel;
  /** Accumulating / Holding / Distribution / Unavailable */
  displayLabel: ConvictionDisplayLabel;
  /** Ring copy — Unavailable becomes Awaiting for list/dashboard language. */
  ringLabel: "Accumulating" | "Holding" | "Distribution" | "Awaiting";
  tone: CompositeTone;
  /** Evidence-tone alias used by existing Watchlist/Trending card props. */
  evidenceTone: "positive" | "negative" | "contested" | "quiet";
  /** Evidence-only composite (calculateConvictionScore), before quality blend. */
  evidenceScore: number | null;
  /** Quality-only composite, before evidence blend. */
  qualityScore: number | null;
  /** True when final score is the 65/35 quality+evidence blend. */
  blended: boolean;
  coverage: number;
  includedCategories: EvidenceCategory[];
  includedQualityFactors: QualityFactorId[];
  detail: string;
  categories: Array<{
    category: EvidenceCategory;
    score: number;
    hasData: boolean;
    isStale: boolean;
    explanation: string;
  }>;
  qualityFactors: Array<{
    factor: QualityFactorId;
    score: number;
    hasData: boolean;
    explanation: string;
  }>;
  scoringVersion: string;
}
