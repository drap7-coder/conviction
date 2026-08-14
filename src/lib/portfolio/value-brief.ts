export type PortfolioValueTone = "balanced" | "watch" | "concentrated" | "neutral";

export interface PortfolioValueHolding {
  ticker: string;
  weight: number | null;
}

export interface PortfolioValueBrief {
  headline: string;
  summary: string;
  tone: PortfolioValueTone;
  largest: { ticker: string; weight: number } | null;
  topThreeWeight: number | null;
}

export function buildPortfolioValueBrief(holdings: PortfolioValueHolding[]): PortfolioValueBrief {
  const ranked = holdings
    .filter((holding): holding is { ticker: string; weight: number } =>
      typeof holding.weight === "number" && Number.isFinite(holding.weight) && holding.weight >= 0,
    )
    .sort((a, b) => b.weight - a.weight);

  if (ranked.length === 0) {
    return {
      headline: "Waiting on prices.",
      summary: "Weights resolve when quotes land.",
      tone: "neutral",
      largest: null,
      topThreeWeight: null,
    };
  }

  const largest = ranked[0];
  const topThreeWeight = ranked.slice(0, 3).reduce((sum, holding) => sum + holding.weight, 0);

  if (largest.weight > 25) {
    return {
      headline: `${largest.ticker} runs the book.`,
      summary: `${largest.weight.toFixed(0)}% of value. A 20% move swings the book ~${(largest.weight * 0.2).toFixed(1)}%.`,
      tone: "concentrated",
      largest,
      topThreeWeight,
    };
  }

  if (topThreeWeight > 60) {
    return {
      headline: "Top three run the book.",
      summary: `${topThreeWeight.toFixed(0)}% of value in three names. Count ≠ capital risk.`,
      tone: "watch",
      largest,
      topThreeWeight,
    };
  }

  if (largest.weight > 20) {
    return {
      headline: `${largest.ticker} is getting large.`,
      summary: `${largest.weight.toFixed(0)}% of value — not dominant yet. Set a size rule.`,
      tone: "watch",
      largest,
      topThreeWeight,
    };
  }

  if (ranked.length >= 5 && largest.weight < 12) {
    return {
      headline: "Sizing looks balanced.",
      summary: `${largest.ticker} largest at ${largest.weight.toFixed(0)}%. Top three: ${topThreeWeight.toFixed(0)}%.`,
      tone: "balanced",
      largest,
      topThreeWeight,
    };
  }

  return {
    headline: "No single name dominates.",
    summary: `${largest.ticker} largest at ${largest.weight.toFixed(0)}%. Top three: ${topThreeWeight.toFixed(0)}%.`,
    tone: "neutral",
    largest,
    topThreeWeight,
  };
}
