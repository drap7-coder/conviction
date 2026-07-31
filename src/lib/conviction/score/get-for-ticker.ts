/**
 * Server-side Conviction Score loader.
 *
 * Fetches institutional + technicals + short interest once, builds the
 * composite, and returns a display DTO every UI surface can reuse.
 */

import { getInstitutionalAccumulationForCompany } from "@/lib/sec/institutional";
import { fetchShortInterestSummary } from "@/lib/market/short-interest";
import { fetchStockHistory, fetchStockQuotes } from "@/lib/market/quotes";
import { withTimeout } from "@/lib/request-timeout";
import {
  buildCategoryScores,
  buildConvictionScore,
  displayLabelForComposite,
  displayScoreFromSigned,
  formatCoverageSources,
  toneForComposite,
  type BuildConvictionScoreInput,
  type ConvictionDisplayLabel,
} from "./build";
import type { CategoryScore } from "./types";
import { MIN_COVERAGE, SCORING_VERSION } from "./weights";
import type { ConvictionScoreView } from "./view";

export type { ConvictionScoreView } from "./view";

function evidenceToneFromDisplay(
  label: ConvictionDisplayLabel,
): ConvictionScoreView["evidenceTone"] {
  if (label === "Accumulating") return "positive";
  if (label === "Distribution") return "negative";
  if (label === "Holding") return "contested";
  return "quiet";
}

function ringLabelFromDisplay(
  label: ConvictionDisplayLabel,
): ConvictionScoreView["ringLabel"] {
  return label === "Unavailable" ? "Awaiting" : label;
}

function toView(
  ticker: string,
  result: ReturnType<typeof buildConvictionScore>,
  categories: CategoryScore[],
): ConvictionScoreView {
  const displayLabel = displayLabelForComposite(result.label);
  const displayScore = displayScoreFromSigned(result.score);
  const sources = formatCoverageSources(result.includedCategories);

  let detail: string;
  if (result.score === null) {
    detail =
      result.coverage < MIN_COVERAGE
        ? `Need more evidence (coverage ${Math.round(result.coverage * 100)}% · need ${Math.round(MIN_COVERAGE * 100)}%).`
        : "Insufficient evidence for a conviction score.";
  } else {
    detail = `Score ${displayScore}/100 · ${sources}`;
  }

  return {
    ticker,
    score: result.score,
    displayScore,
    label: result.label,
    displayLabel,
    ringLabel: ringLabelFromDisplay(displayLabel),
    tone: toneForComposite(result.label),
    evidenceTone: evidenceToneFromDisplay(displayLabel),
    coverage: result.coverage,
    includedCategories: result.includedCategories,
    detail,
    categories: categories.map((category) => ({
      category: category.category,
      score: category.score,
      hasData: category.hasData,
      isStale: category.isStale,
      explanation: category.explanation,
    })),
    scoringVersion: SCORING_VERSION,
  };
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function buildInput(
  ticker: string,
  institutional: Awaited<ReturnType<typeof getInstitutionalAccumulationForCompany>> | null,
  shortInterest: Awaited<ReturnType<typeof fetchShortInterestSummary>> | null,
  history: Awaited<ReturnType<typeof fetchStockHistory>> | null,
  quote: Awaited<ReturnType<typeof fetchStockQuotes>>[number] | null,
): BuildConvictionScoreInput {
  return {
    ticker,
    institutional: institutional
      ? {
          results: institutional.results ?? [],
          status: "success",
          fetchedAt: new Date().toISOString(),
        }
      : {
          results: [],
          status: "error",
          message: "Institutional filings unavailable.",
        },
    technicals: {
      points: history?.points ?? [],
      currentPrice: quote?.price ?? null,
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
      fetchedAt: new Date().toISOString(),
    },
    shortInterest: shortInterest
      ? {
          ticker,
          status: shortInterest.status,
          latest: shortInterest.latest,
          fetchedAt: shortInterest.fetchedAt,
        }
      : {
          ticker,
          status: "error",
          latest: null,
          message: "Short interest unavailable.",
        },
  };
}

/**
 * Build the shared Conviction Score for one ticker.
 * Partial source failures become missing categories (lower coverage), not hard errors.
 */
export async function getConvictionScoreForTicker(
  ticker: string,
  options: { companyName?: string } = {},
): Promise<ConvictionScoreView> {
  const upper = ticker.trim().toUpperCase();
  const companyName = options.companyName?.trim() || upper;

  const [institutional, shortInterest, history, quotes] = await Promise.all([
    settled(
      withTimeout(
        getInstitutionalAccumulationForCompany(upper, companyName),
        22_000,
      ),
    ),
    settled(fetchShortInterestSummary(upper)),
    settled(fetchStockHistory(upper, "1y")),
    settled(fetchStockQuotes([upper])),
  ]);

  const input = buildInput(
    upper,
    institutional,
    shortInterest,
    history,
    quotes?.[0] ?? null,
  );
  const categories = buildCategoryScores(input);
  const result = buildConvictionScore(input);
  return toView(upper, result, categories);
}

const DEFAULT_CONCURRENCY = 3;

/**
 * Batch loader with limited concurrency — institutional SEC work is rate-limited.
 */
export async function getConvictionScoresForTickers(
  tickers: Array<string | { ticker: string; companyName?: string }>,
  options: { concurrency?: number } = {},
): Promise<Record<string, ConvictionScoreView>> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const jobs = tickers.map((item) =>
    typeof item === "string"
      ? { ticker: item.toUpperCase(), companyName: item.toUpperCase() }
      : {
          ticker: item.ticker.toUpperCase(),
          companyName: item.companyName ?? item.ticker.toUpperCase(),
        },
  );

  const unique = new Map<string, { ticker: string; companyName: string }>();
  for (const job of jobs) {
    if (!job.ticker) continue;
    if (!unique.has(job.ticker)) unique.set(job.ticker, job);
  }

  const list = [...unique.values()];
  const out: Record<string, ConvictionScoreView> = {};
  let index = 0;

  async function worker() {
    while (index < list.length) {
      const current = list[index++];
      out[current.ticker] = await getConvictionScoreForTicker(current.ticker, {
        companyName: current.companyName,
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length || 1) }, () => worker()),
  );
  return out;
}
