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
  | "unavailable";

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

export function signalToneFromScore(
  score: number | null,
  hasData: boolean,
  isStale = false,
): ConvictionSignalTone {
  if (!hasData || isStale || score === null) return "unavailable";
  if (score >= 25) return "positive";
  if (score <= -25) return "negative";
  return "neutral";
}

export function signalStateLabel(signal: ConvictionSignalDisplay): string {
  if (signal.status === "loading") return "Checking";
  if (signal.status === "stale") return "Stale";
  if (signal.status === "unavailable") return "No data";
  if (signal.tone === "positive") return "Bullish";
  if (signal.tone === "negative") return "Bearish";
  return "Neutral";
}

export function rankConvictionSignals(
  signals: ConvictionSignalDisplay[],
  limit = 4,
): ConvictionSignalDisplay[] {
  return signals
    .filter((signal) => signal.status === "available" || signal.status === "stale")
    .sort((left, right) => {
      const freshnessDelta = Number(right.status === "available") - Number(left.status === "available");
      if (freshnessDelta !== 0) return freshnessDelta;
      return right.strength - left.strength;
    })
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
