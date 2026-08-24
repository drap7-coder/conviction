import { classifyFit, type FitResult } from "@/lib/portfolio/fit";
import { computeReliance, type RelianceResult, type RelianceTone } from "@/lib/portfolio/reliance";
import { mixFromHoldings, type BookHolding } from "@/lib/portfolio/sleeves";

export type PortfolioValueTone = RelianceTone;

export interface PortfolioValueHolding extends BookHolding {}

export interface PortfolioValueBrief {
  headline: string;
  summary: string;
  /** Plain mix — Study “How it’s built.” */
  construction: string;
  /** Plain concentration — Study “What has to go right.” */
  stake: string;
  tone: PortfolioValueTone;
  largest: { ticker: string; weight: number } | null;
  topThreeWeight: number | null;
  fit: FitResult;
  reliance: RelianceResult;
}

/** Live hero copy: job of the book, then how it’s built / what has to go right. */
export function buildPortfolioValueBrief(holdings: PortfolioValueHolding[]): PortfolioValueBrief {
  const fit = classifyFit(holdings);
  const reliance = computeReliance(holdings);

  return {
    headline: fit.headline,
    summary: reliance.summary,
    construction: describeBookConstruction(holdings),
    stake: describeBookStake(reliance),
    tone: reliance.tone,
    largest: reliance.largest,
    topThreeWeight: reliance.largest ? reliance.topThreeWeight : null,
    fit,
    reliance,
  };
}

export function describeBookConstruction(holdings: BookHolding[]): string {
  if (holdings.length === 0) return "Add a holding to see how the book is built.";
  const mix = mixFromHoldings(holdings);
  const stocks = mix.usEquity + mix.intl;
  const ballast = mix.bonds + mix.cash;
  const hedges = mix.gold + mix.commodities;

  if (stocks >= 85 && ballast < 8) {
    return mix.intl >= 8
      ? "Almost all stocks — U.S. and international. Little to no ballast."
      : "Almost all U.S. stocks. Little to no ballast.";
  }
  if (stocks >= 55 && ballast >= 25 && hedges < 15) {
    return mix.intl >= 10
      ? "Stocks for growth, including international, plus a real bond sleeve."
      : "Stocks for growth, bonds for ballast.";
  }
  if (ballast + hedges >= 45) {
    return "A large share sits in ballast and hedges — built to hold, not to sprint.";
  }
  if (mix.usEquity >= 40 && (ballast >= 10 || hedges >= 10)) {
    return "A mix of stocks and ballast — not a single-idea book.";
  }
  return "A stock-heavy book with limited ballast.";
}

export function describeBookStake(reliance: RelianceResult): string {
  const largest = reliance.largest;
  if (!largest) return "Prices are still landing.";
  const weight = Math.round(largest.weight);
  if (reliance.tone === "concentrated") {
    return `${largest.ticker} is ${weight}% of the book. That name has to work.`;
  }
  if (reliance.tone === "watch") {
    return `${largest.ticker} is ${weight}% of the book. A miss would show.`;
  }
  return "No single name has to be right.";
}
