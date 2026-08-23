import { classifyFit, type FitResult } from "@/lib/portfolio/fit";
import { computeReliance, type RelianceResult, type RelianceTone } from "@/lib/portfolio/reliance";
import type { BookHolding } from "@/lib/portfolio/sleeves";

export type PortfolioValueTone = RelianceTone;

export interface PortfolioValueHolding extends BookHolding {}

export interface PortfolioValueBrief {
  headline: string;
  summary: string;
  tone: PortfolioValueTone;
  largest: { ticker: string; weight: number } | null;
  topThreeWeight: number | null;
  fit: FitResult;
  reliance: RelianceResult;
}

/** Live hero copy: Fit first, then Reliance. Never "runs the book." */
export function buildPortfolioValueBrief(holdings: PortfolioValueHolding[]): PortfolioValueBrief {
  const fit = classifyFit(holdings);
  const reliance = computeReliance(holdings);

  return {
    headline: fit.headline,
    summary: reliance.summary,
    tone: reliance.tone,
    largest: reliance.largest,
    topThreeWeight: reliance.largest ? reliance.topThreeWeight : null,
    fit,
    reliance,
  };
}
