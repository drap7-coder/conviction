/**
 * Fetches wired evidence categories, builds CategoryScores,
 * and renders the composite Conviction Score overview.
 *
 * Wired: institutional, earnings, technicals, short_interest, political
 * Unwired: social
 */

"use client";

import { useEffect, useState } from "react";
import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  buildConvictionScore,
  type ConvictionScoreResult,
} from "@/lib/conviction/score";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { ShortInterestSummary } from "@/lib/market/short-interest";
import type { StockHistoryPoint } from "@/lib/market/technical-state";
import type { StockQuote } from "@/lib/market/quotes";
import {
  scoreInstitutionalConviction,
  type ConvictionRingScore,
} from "@/lib/market/quote-gauges";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

const EMPTY_INSTITUTIONAL: ConvictionRingScore = {
  score: null,
  tone: "neutral",
  label: "Unavailable",
  detail: "Loading institutional filings…",
  added: 0,
  reduced: 0,
  newPositions: 0,
  filingQuarter: null,
};

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
    "political",
    "social",
  ],
};

export function ConvictionScoreOverviewCard({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<ConvictionScoreResult>(EMPTY_RESULT);
  const [institutional, setInstitutional] =
    useState<ConvictionRingScore>(EMPTY_INSTITUTIONAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setResult(EMPTY_RESULT);
      setInstitutional(EMPTY_INSTITUTIONAL);

      try {
        const [instRes, earningsRes, shortRes, politicalRes, historyRes, quotesRes] =
          await Promise.all([
            fetchJsonWithTimeout<{
              results?: InstitutionalAccumulation[];
              status?: string;
              fetchedAt?: string;
              message?: string;
            }>(
              `/api/evidence/institutional?ticker=${encodeURIComponent(ticker)}`,
              26_000,
              controller.signal,
            ).catch(() => null),
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
            fetchJsonWithTimeout<PoliticalTradeSummary & { status?: string; message?: string }>(
              `/api/evidence/political?ticker=${encodeURIComponent(ticker)}`,
              12_000,
              controller.signal,
            ).catch(() => null),
            fetchJsonWithTimeout<{
              history?: StockHistoryPoint[];
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

        const instInput = instRes
          ? {
              results: instRes.results ?? [],
              status: instRes.status,
              fetchedAt: instRes.fetchedAt,
              message: instRes.message,
            }
          : {
              results: [] as InstitutionalAccumulation[],
              status: "error",
              message: "Institutional filings could not be loaded.",
            };

        const earnings =
          earningsRes
          ?? ({
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
          } satisfies EarningsEvidence);

        const quote = quotesRes?.quotes?.[0] ?? null;
        const technicals = {
          points: historyRes?.history ?? [],
          currentPrice: quote?.price ?? null,
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
          fetchedAt: historyRes?.fetchedAt ?? null,
        };

        const shortInterest = shortRes
          ? {
              ticker: shortRes.ticker ?? ticker,
              status: shortRes.status,
              latest: shortRes.latest ?? null,
              fetchedAt: shortRes.fetchedAt,
              message: shortRes.message,
            }
          : {
              ticker,
              status: "error" as const,
              latest: null,
              fetchedAt: new Date().toISOString(),
              message: "Short interest data could not be loaded.",
            };

        const political = politicalRes
          ?? ({
            ticker,
            trades: [],
            purchases: [],
            sales: [],
            totalEstimatedPurchases: 0,
            totalEstimatedSales: 0,
            latestFilingDate: null,
            source: "kadoa-open-data",
            sourceUrl: "",
            fetchedAt: new Date().toISOString(),
            status: "error",
            message: "Political disclosure data could not be loaded.",
          } satisfies PoliticalTradeSummary & { status: string; message: string });

        setInstitutional(scoreInstitutionalConviction(instInput.results));
        setResult(
          buildConvictionScore({
            ticker,
            institutional: instInput,
            earnings,
            technicals,
            shortInterest,
            political,
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
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
      institutional={institutional}
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
