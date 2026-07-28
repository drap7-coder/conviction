/**
 * Fetches wired evidence categories, builds CategoryScores,
 * and renders the composite Conviction Score overview.
 *
 * Progressive scoring: fast sources (earnings, technicals, short interest)
 * can produce a score before the slow 13F institutional call finishes.
 * Institutional upgrades the composite when it arrives.
 *
 * Wired: institutional, earnings, technicals, short_interest
 */

"use client";

import { useEffect, useState } from "react";
import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  buildConvictionScore,
  type ConvictionScoreResult,
  type InstitutionalCategoryInput,
  type ShortInterestCategoryInput,
  type TechnicalCategoryInput,
} from "@/lib/conviction/score";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { ShortInterestSummary } from "@/lib/market/short-interest";
import type { StockHistoryPoint } from "@/lib/market/technical-state";
import type { StockQuote } from "@/lib/market/quotes";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

const EMPTY_RESULT: ConvictionScoreResult = {
  score: null,
  label: "insufficient_evidence",
  coverage: 0,
  agreementAdjustment: 0,
  includedCategories: [],
  excludedCategories: [
    "institutional",
    "earnings",
    "technicals",
    "short_interest",
  ],
};

function emptyEarnings(ticker: string): EarningsEvidence {
  return {
    ticker,
    history: [],
    forecasts: [],
    historyScore: null,
    revisionScore: null,
    score: null,
    momentum: "Unavailable",
    nextEarningsDate: null,
    asOf: null,
    source: "unavailable",
    status: "unavailable",
    message: "Earnings evidence could not be loaded.",
  };
}

function emptyInstitutional(): InstitutionalCategoryInput {
  return {
    results: [] as InstitutionalAccumulation[],
    status: "error",
    message: "Institutional filings could not be loaded.",
  };
}

function emptyShortInterest(ticker: string): ShortInterestCategoryInput {
  return {
    ticker,
    status: "error",
    latest: null,
    fetchedAt: new Date().toISOString(),
    message: "Short interest data could not be loaded.",
  };
}

function emptyTechnicals(): TechnicalCategoryInput {
  return {
    points: [],
    currentPrice: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    fetchedAt: null,
  };
}

function historyPointsFromResponse(
  historyRes: {
    history?: StockHistoryPoint[] | {
      points?: StockHistoryPoint[];
      fiftyTwoWeekHigh?: number | null;
      fiftyTwoWeekLow?: number | null;
    };
    fetchedAt?: string;
  } | null,
  quote: StockQuote | null,
): TechnicalCategoryInput {
  if (!historyRes) return emptyTechnicals();
  const historyPayload = historyRes.history;
  const historyPoints = Array.isArray(historyPayload)
    ? historyPayload
    : Array.isArray(historyPayload?.points)
      ? historyPayload.points
      : [];
  return {
    points: historyPoints,
    currentPrice: quote?.price ?? null,
    fiftyTwoWeekHigh:
      quote?.fiftyTwoWeekHigh
      ?? (historyPayload && !Array.isArray(historyPayload)
        ? historyPayload.fiftyTwoWeekHigh ?? null
        : null),
    fiftyTwoWeekLow:
      quote?.fiftyTwoWeekLow
      ?? (historyPayload && !Array.isArray(historyPayload)
        ? historyPayload.fiftyTwoWeekLow ?? null
        : null),
    fetchedAt: historyRes.fetchedAt ?? null,
  };
}

export function ConvictionScoreOverviewCard({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<ConvictionScoreResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setResult(EMPTY_RESULT);

      let institutional = emptyInstitutional();
      let earnings = emptyEarnings(ticker);
      let technicals = emptyTechnicals();
      let shortInterest = emptyShortInterest(ticker);

      const publish = (stillLoading: boolean) => {
        if (cancelled) return;
        setResult(
          buildConvictionScore({
            ticker,
            institutional,
            earnings,
            technicals,
            shortInterest,
          }),
        );
        if (!stillLoading) setLoading(false);
      };

      // Fast path first — enough weight to clear the 50% gate without 13F.
      const fast = await Promise.all([
        fetchJsonWithTimeout<EarningsEvidence>(
          `/api/evidence/earnings?ticker=${encodeURIComponent(ticker)}`,
          14_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<ShortInterestSummary & { status?: string; message?: string }>(
          `/api/market/short-interest?ticker=${encodeURIComponent(ticker)}`,
          10_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<{
          history?: StockHistoryPoint[] | {
            points?: StockHistoryPoint[];
            fiftyTwoWeekHigh?: number | null;
            fiftyTwoWeekLow?: number | null;
          };
          fetchedAt?: string;
        }>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
          12_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
          8_000,
          controller.signal,
        ).catch(() => null),
      ]);

      if (cancelled) return;

      const [earningsRes, shortRes, historyRes, quotesRes] = fast;
      earnings = earningsRes ?? emptyEarnings(ticker);
      technicals = historyPointsFromResponse(historyRes, quotesRes?.quotes?.[0] ?? null);
      shortInterest = shortRes
        ? {
            ticker: shortRes.ticker ?? ticker,
            status: shortRes.status,
            latest: shortRes.latest ?? null,
            fetchedAt: shortRes.fetchedAt,
            message: shortRes.message,
          }
        : emptyShortInterest(ticker);

      // Show a score as soon as fast coverage is enough; keep loading until 13F returns.
      publish(true);

      try {
        const instRes = await fetchJsonWithTimeout<{
          results?: InstitutionalAccumulation[];
          status?: string;
          fetchedAt?: string;
          message?: string;
        }>(
          `/api/evidence/institutional?ticker=${encodeURIComponent(ticker)}`,
          26_000,
          controller.signal,
        ).catch(() => null);

        if (cancelled) return;

        institutional = instRes
          ? {
              results: instRes.results ?? [],
              status: instRes.status,
              fetchedAt: instRes.fetchedAt,
              message: instRes.message,
            }
          : emptyInstitutional();
      } finally {
        publish(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  return (
    <ConvictionScoreOverview
      result={result}
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
