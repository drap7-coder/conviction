/**
 * Display DTO for the shared Conviction Score.
 * Safe to import from client components (no server fetchers).
 */

import type { CompositeTone, ConvictionDisplayLabel } from "./build";
import type { ConvictionScoreLabel, EvidenceCategory } from "./types";

export interface ConvictionScoreView {
  ticker: string;
  /** Signed composite in [-100, +100], or null when coverage is too low. */
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
  coverage: number;
  includedCategories: EvidenceCategory[];
  detail: string;
  categories: Array<{
    category: EvidenceCategory;
    score: number;
    hasData: boolean;
    isStale: boolean;
    explanation: string;
  }>;
  scoringVersion: string;
}
