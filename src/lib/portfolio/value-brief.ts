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
      headline: "Portfolio value is waiting for complete prices.",
      summary: "Position weights will resolve as market data becomes available.",
      tone: "neutral",
      largest: null,
      topThreeWeight: null,
    };
  }

  const largest = ranked[0];
  const topThreeWeight = ranked.slice(0, 3).reduce((sum, holding) => sum + holding.weight, 0);

  if (largest.weight > 25) {
    return {
      headline: `${largest.ticker} is the book’s binding concentration.`,
      summary: `At ${largest.weight.toFixed(0)}% of portfolio value, a 20% move in the position would move the total book by roughly ${(largest.weight * 0.2).toFixed(1)}%.`,
      tone: "concentrated",
      largest,
      topThreeWeight,
    };
  }

  if (topThreeWeight > 60) {
    return {
      headline: "Three positions drive most of the portfolio.",
      summary: `The top three holdings represent ${topThreeWeight.toFixed(0)}% of total value. The book is diversified by name count more than by capital at risk.`,
      tone: "watch",
      largest,
      topThreeWeight,
    };
  }

  if (largest.weight > 20) {
    return {
      headline: `${largest.ticker} is moving into concentration territory.`,
      summary: `The largest position represents ${largest.weight.toFixed(0)}% of portfolio value. It is not yet dominant, but it deserves an explicit size limit and trim rule.`,
      tone: "watch",
      largest,
      topThreeWeight,
    };
  }

  if (ranked.length >= 5 && largest.weight < 12) {
    return {
      headline: "Position sizing is balanced across the book.",
      summary: `${largest.ticker} is the largest holding at ${largest.weight.toFixed(0)}%, while the top three account for ${topThreeWeight.toFixed(0)}% of value. No single outcome dominates.`,
      tone: "balanced",
      largest,
      topThreeWeight,
    };
  }

  return {
    headline: "Capital is distributed without one dominant position.",
    summary: `${largest.ticker} is largest at ${largest.weight.toFixed(0)}%, and the top three holdings account for ${topThreeWeight.toFixed(0)}% of total value.`,
    tone: "neutral",
    largest,
    topThreeWeight,
  };
}
