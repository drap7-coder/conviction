export type ConvictionSignalCategory =
  | "institutional"
  | "insider"
  | "technicals"
  | "short_interest";

export type ConvictionSignalTone =
  | "positive"
  | "negative"
  | "neutral"
  | "unavailable";

export type ConvictionSignalStatus =
  | "loading"
  | "available"
  | "stale"
  | "unavailable"
  | "quiet";

export interface ConvictionSignalDisplay {
  category: ConvictionSignalCategory;
  label: string;
  tone: ConvictionSignalTone;
  status: ConvictionSignalStatus;
  headline: string;
  detail: string;
  /** Relative signal intensity used only to order the evidence cards. */
  strength: number;
}

export interface ConvictionQualityHighlight {
  factor: string;
  explanation: string;
  score: number;
}

/**
 * Aligns with institutional ring Accumulating (≥60 → signed +20) /
 * Distribution (≤40 → signed −20). Composite labels still use ±25.
 */
export const SIGNAL_DIRECTIONAL_THRESHOLD = 20;

const INSIDER_NO_BUYING_PATTERN =
  /no open-market insider purchases|sales ignored/i;

export function signalToneFromScore(
  score: number | null,
  hasData: boolean,
  isStale = false,
): ConvictionSignalTone {
  if (!hasData || isStale || score === null) return "unavailable";
  if (score >= SIGNAL_DIRECTIONAL_THRESHOLD) return "positive";
  if (score <= -SIGNAL_DIRECTIONAL_THRESHOLD) return "negative";
  return "neutral";
}

/** True when Form 4 loaded but purchases-only scoring found nothing to count. */
export function isInsiderQuietMessage(message: string | null | undefined): boolean {
  return typeof message === "string" && INSIDER_NO_BUYING_PATTERN.test(message);
}

export function signalStateLabel(signal: ConvictionSignalDisplay): string {
  if (signal.status === "loading") return "Checking";
  if (signal.status === "stale") return "Stale";
  if (signal.status === "quiet") return "No buying";
  if (signal.status === "unavailable") return "No data";
  if (signal.tone === "positive") return "Bullish";
  if (signal.tone === "negative") return "Bearish";
  return "Neutral";
}

/** Prefer directional evidence, then informative neutrals, then quiet/stale. */
export function rankConvictionSignals(
  signals: ConvictionSignalDisplay[],
  limit = 4,
): ConvictionSignalDisplay[] {
  const rank = (signal: ConvictionSignalDisplay): number => {
    if (signal.status === "available" && (signal.tone === "positive" || signal.tone === "negative")) {
      return 400 + signal.strength;
    }
    if (signal.status === "available" && signal.tone === "neutral") {
      return 300 + signal.strength;
    }
    if (signal.status === "quiet") return 200;
    if (signal.status === "stale") return 100 + signal.strength;
    return 0;
  };

  return signals
    .filter((signal) =>
      signal.status === "available"
      || signal.status === "stale"
      || signal.status === "quiet",
    )
    .sort((left, right) => rank(right) - rank(left))
    .slice(0, limit);
}

export function signalDisagreement(signals: ConvictionSignalDisplay[]): {
  positive: string[];
  negative: string[];
} | null {
  const positive = signals
    .filter((signal) => signal.status === "available" && signal.tone === "positive")
    .map((signal) => signal.label);
  const negative = signals
    .filter((signal) => signal.status === "available" && signal.tone === "negative")
    .map((signal) => signal.label);

  return positive.length > 0 && negative.length > 0 ? { positive, negative } : null;
}

function shortenHeadline(headline: string, max = 96): string {
  const trimmed = headline.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function clauseForSignal(signal: ConvictionSignalDisplay): string | null {
  if (signal.status === "quiet" || (signal.category === "insider" && signal.status === "unavailable" && isInsiderQuietMessage(signal.headline))) {
    return "no insider buying";
  }
  if (signal.status !== "available" && signal.status !== "stale") return null;

  if (signal.tone === "positive") {
    if (signal.category === "institutional") return "institutions accumulating";
    if (signal.category === "insider") return "insider buying";
    if (signal.category === "technicals") return "chart trend supportive";
    if (signal.category === "short_interest") return "short interest easing";
  }

  if (signal.tone === "negative") {
    if (signal.category === "institutional") return "institutions distributing";
    if (signal.category === "insider") return "insider pressure";
    if (signal.category === "technicals") return "chart trend weak";
    if (signal.category === "short_interest") return "short interest elevated";
  }

  // Neutral / mixed — keep useful, specific language.
  if (signal.category === "institutional") {
    if (/adding or opening/i.test(signal.headline) && /trimming or exiting/i.test(signal.headline)) {
      return "institutions mixed";
    }
    if (/holding/i.test(signal.headline)) return "institutions mostly holding";
    return "institutions mixed";
  }
  if (signal.category === "technicals") {
    if (/fallen below the short-term|caution/i.test(signal.headline)) {
      return "chart soft near-term";
    }
    if (/above the short-term|momentum/i.test(signal.headline)) {
      return "chart mixed";
    }
    return "chart mixed";
  }
  if (signal.category === "short_interest") {
    if (/fell|eased/i.test(signal.headline)) return "short interest light";
    if (/rose|climbing/i.test(signal.headline)) return "short interest building";
    return "short interest quiet";
  }
  if (signal.category === "insider") return "insider activity quiet";
  return null;
}

/**
 * One-line read of the current evidence set — the product layer users need
 * when few categories clear the bullish/bearish bar.
 */
export function synthesizeConvictionSignals(signals: ConvictionSignalDisplay[]): string {
  const clauses = signals
    .map(clauseForSignal)
    .filter((value): value is string => Boolean(value));

  // De-dupe while preserving order.
  const unique: string[] = [];
  for (const clause of clauses) {
    if (!unique.includes(clause)) unique.push(clause);
  }

  if (unique.length === 0) {
    return "Not enough live evidence yet to form a conviction read.";
  }

  const directional = signals.filter(
    (signal) =>
      signal.status === "available"
      && (signal.tone === "positive" || signal.tone === "negative"),
  ).length;

  const lead = directional === 0
    ? "Evidence is quiet"
    : directional === 1
      ? "Evidence is mixed"
      : "Evidence is active";

  return `${lead}: ${unique.slice(0, 3).join(", ")}.`;
}

/** Compact supporting facts from the quality half (not a score). */
export function qualityHighlightsFromFactors(
  factors: Array<{ factor: string; score: number; hasData: boolean; explanation: string }>,
  limit = 2,
): ConvictionQualityHighlight[] {
  return factors
    .filter((factor) => factor.hasData && Math.abs(factor.score) >= 40)
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
    .slice(0, limit)
    .map((factor) => ({
      factor: factor.factor.replace(/_/g, " "),
      explanation: shortenHeadline(factor.explanation, 72),
      score: factor.score,
    }));
}

/**
 * Short “what stands out” notes derived from current evidence.
 * Prefer real transition history when available; this is the always-on fallback.
 */
export function notableSignalNotes(signals: ConvictionSignalDisplay[], limit = 3): string[] {
  const notes: string[] = [];

  for (const signal of signals) {
    if (signal.status === "quiet" || (signal.category === "insider" && isInsiderQuietMessage(signal.headline))) {
      notes.push("Insider open-market buying is quiet in the current window.");
      continue;
    }
    if (signal.status === "stale") {
      notes.push(`${signal.label} evidence is stale and shown for context only.`);
      continue;
    }
    if (signal.status !== "available") continue;

    if (signal.tone === "positive" || signal.tone === "negative") {
      notes.push(shortenHeadline(signal.headline, 110));
      continue;
    }

    // Neutral but informative.
    if (signal.category === "institutional" && /adding|trimming|opening|exiting/i.test(signal.headline)) {
      notes.push(shortenHeadline(signal.headline, 110));
    } else if (signal.category === "technicals") {
      notes.push(shortenHeadline(signal.headline, 110));
    } else if (signal.category === "short_interest") {
      notes.push(shortenHeadline(signal.headline, 110));
    }
  }

  const unique: string[] = [];
  for (const note of notes) {
    if (!unique.includes(note)) unique.push(note);
  }
  return unique.slice(0, limit);
}
