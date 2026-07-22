/**
 * ── Canonical Assessment Types ──
 *
 * Every view (Watchlist, Trending, Company page, etc.) consumes this shared schema.
 * No view independently calculates, reinterprets, or renames the score.
 */

import type { MODEL_VERSION } from "./model-version";

// ── Re-usable scalars ──

export type SignalSentiment =
  | "strong_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "strong_negative"
  | "unknown";

export type EvidenceVerdict = "strong" | "positive" | "mixed" | "weak" | "negative";
export type EvidenceDirection = "improving" | "stable" | "deteriorating" | "unknown";
export type TechnicalState =
  | "strong"
  | "improving"
  | "mixed"
  | "weakening"
  | "weak"
  | "unknown";
export type MarketSession = "pre_market" | "regular" | "after_hours" | "closed";

// ── Evidence reference ──

export interface EvidenceReference {
  id: string;
  type: string;
  summary: string;
  direction: "positive" | "negative" | "neutral";
  date: string;
  strength: number; // 0-1
  source: string;
}

export interface SignalReference {
  key: string;
  label: string;
  sentiment: SignalSentiment;
  summary: string;
}

// ── Signal assessment (one per signal category) ──

export interface SignalAssessment {
  sentiment: SignalSentiment;
  score: number | null; // -100 to +100
  confidence: number; // 0-1
  freshness: number; // 0-1 (1 = most recent)
  evidenceFor: EvidenceReference[];
  evidenceAgainst: EvidenceReference[];
  summary: string;
  updatedAt: string | null;
}

// ── Aggregate evidence assessment ──

export interface EvidenceAssessment {
  score: number; // -100 to +100
  verdict: EvidenceVerdict;
  direction: EvidenceDirection;

  signals: {
    institutional: SignalAssessment;
    insider: SignalAssessment;
    earnings: SignalAssessment;
    political: SignalAssessment;
  };

  primarySignal: SignalReference | null;
  primaryRisk: SignalReference | null;
  supportingSignals: SignalReference[];
  conflictingSignals: SignalReference[];

  multiSignalStatus: {
    qualifies: boolean;
    categories: string[];
    explanation: string;
  };

  confidence: number; // 0-1
  coverage: number; // 0-1 proportion of expected signals with data
  summary: string;
}

// ── Technical assessment ──

export interface TechnicalAssessment {
  state: TechnicalState;
  shortTermTrend: SignalAssessment;
  longTermTrend: SignalAssessment;
  rangePosition: SignalAssessment;

  price: number | null;
  previousClose: number | null;
  sma50: number | null;
  sma200: number | null;
  distanceFromSma50Pct: number | null;
  distanceFromSma200Pct: number | null;
  week52High: number | null;
  week52Low: number | null;
  rangePositionPct: number | null;

  summary: string;
  updatedAt: string | null;
}

// ── Market session assessment ──

export interface MarketSessionAssessment {
  session: MarketSession;
  displayedPrice: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  referencePrice: number | null;
  referenceLabel: string;
  updatedAt: string | null;
}

// ── Top-level canonical snapshot ──

export interface ConvictionSnapshot {
  ticker: string;
  modelVersion: string; // typeof MODEL_VERSION

  evidence: EvidenceAssessment;
  technical: TechnicalAssessment;
  market: MarketSessionAssessment;

  generatedAt: string;
  evidenceUpdatedAt: string | null;
  technicalUpdatedAt: string | null;
  marketUpdatedAt: string | null;
}

// ── Convenience types for UI components ──

export interface ConvictionBadgeData {
  /** Overall evidence verdict label (uppercase) */
  verdict: string;
  /** Evidence direction suffix or null */
  direction: string | null;
  /** Technical state suffix or null */
  technicalState: string | null;
  /** CSS tone class */
  tone: "positive" | "negative" | "contested" | "quiet";
}

/**
 * Derive a display-friendly badge from the canonical snapshot.
 *
 * Rules:
 * - verdict + direction + technicalState are always distinct concepts
 * - A bare "Strengthening" or "Weakening" badge is NEVER shown without
 *   a category prefix ("Evidence improving", "Price weakening")
 */
export function getConvictionBadge(snapshot: ConvictionSnapshot): ConvictionBadgeData {
  const { evidence, technical } = snapshot;

  // Technical state label — computed independently of evidence coverage
  const techLabel =
    technical.state === "strong"
      ? "Price strong"
      : technical.state === "improving"
        ? "Price improving"
        : technical.state === "weakening"
          ? "Price weakening"
          : technical.state === "weak"
            ? "Price weak"
            : technical.state === "mixed"
              ? "Price mixed"
              : null;

  // Check coverage first — if insufficient, tone is "quiet"
  if (evidence.coverage < 0.5) {
    return {
      verdict: "Insufficient",
      direction: null,
      technicalState: techLabel,
      tone: "quiet",
    };
  }

  // Map evidence verdict to display label
  let verdictLabel: string;
  let tone: ConvictionBadgeData["tone"];

  switch (evidence.verdict) {
    case "strong":
    case "positive":
      verdictLabel = "Positive";
      tone = "positive";
      break;
    case "negative":
      verdictLabel = "Negative";
      tone = "negative";
      break;
    case "weak":
      verdictLabel = "Weak";
      tone = "negative";
      break;
    case "mixed":
      verdictLabel = "Mixed";
      tone = "contested";
      break;
    default:
      verdictLabel = "Insufficient";
      tone = "quiet";
  }

  // Evidence direction label
  const directionLabel =
    evidence.direction === "improving"
      ? "Improving"
      : evidence.direction === "deteriorating"
        ? "Deteriorating"
        : null;

  return {
    verdict: verdictLabel,
    direction: directionLabel,
    technicalState: techLabel,
    tone,
  };
}