/**
 * Fetches institutional + earnings evidence, builds CategoryScores,
 * and renders the composite Conviction Score overview.
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
import {
  scoreInstitutionalConviction,
  type ConvictionRingScore,
} from "@/lib/market/quote-gauges";
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
        const [instRes, earningsRes] = await Promise.all([
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

        setInstitutional(scoreInstitutionalConviction(instInput.results));
        setResult(
          buildConvictionScore({
            ticker,
            institutional: instInput,
            earnings,
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
