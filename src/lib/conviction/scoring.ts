export type SignalKey = "institutional" | "insider" | "earnings" | "political";

export interface ConvictionSignal {
  key: SignalKey;
  label: string;
  weight: number;
  score: number | null;
  asOf: string | null;
  summary: string;
}

export interface ConvictionVerdict {
  score: number | null;
  coverage: number;
  confidence: "High" | "Medium" | "Low";
  direction: "bullish" | "bearish" | "mixed" | "insufficient";
  summary: string;
}

export const SIGNAL_WEIGHTS = {
  institutional: 0.3,
  insider: 0.3,
  earnings: 0.25,
  political: 0.15,
} satisfies Record<SignalKey, number>;

export function clampScore(value: number) {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function ageInDays(date: string | null, now: Date) {
  if (!date) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, (now.getTime() - timestamp) / 86_400_000)
    : Number.POSITIVE_INFINITY;
}

export function calculateConviction(
  signals: ConvictionSignal[],
  now = new Date(),
): ConvictionVerdict {
  const available = signals.filter((signal) => signal.score !== null);
  const coverage = available.reduce((sum, signal) => sum + signal.weight, 0);

  if (coverage < 0.5) {
    return {
      score: null,
      coverage,
      confidence: "Low",
      direction: "insufficient",
      summary: "Not enough current evidence for a responsible verdict yet.",
    };
  }

  const score = clampScore(
    available.reduce((sum, signal) => sum + (signal.score ?? 0) * signal.weight, 0) / coverage,
  );
  const directional = available.filter((signal) => Math.abs(signal.score ?? 0) >= 15);
  const positive = directional.filter((signal) => (signal.score ?? 0) > 0).length;
  const negative = directional.filter((signal) => (signal.score ?? 0) < 0).length;
  const agreement = directional.length === 0 ? 0 : Math.max(positive, negative) / directional.length;
  const stale = available.some((signal) => ageInDays(signal.asOf, now) > 90);

  let confidence: ConvictionVerdict["confidence"] =
    coverage >= 0.85 && agreement >= 0.75 ? "High" : coverage >= 0.65 && agreement >= 0.5 ? "Medium" : "Low";
  if (stale && confidence === "High") confidence = "Medium";
  else if (stale && confidence === "Medium") confidence = "Low";

  const direction = score >= 15 ? "bullish" : score <= -15 ? "bearish" : "mixed";
  const dominant = [...available]
    .sort((a, b) => Math.abs((b.score ?? 0) * b.weight) - Math.abs((a.score ?? 0) * a.weight))
    .slice(0, 2);
  const lead = dominant[0]?.summary ?? "Signals are balanced";
  const second = dominant[1]?.summary;

  return {
    score,
    coverage,
    confidence,
    direction,
    summary: second ? `${lead}; ${second}.` : `${lead}.`,
  };
}
