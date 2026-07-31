/**
 * Dashboard Conviction Score — live 13F institutional scoring.
 * Same Accumulating / Holding / Distribution language as list rings, but
 * driven by tracked manager filings rather than day-move stubs.
 */

"use client";

import { useEffect, useState } from "react";
import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  scoreInstitutionalConviction,
  type ConvictionRingScore,
} from "@/lib/market/quote-gauges";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

const EMPTY: ConvictionRingScore = {
  score: null,
  tone: "neutral",
  label: "Unavailable",
  detail: "Loading institutional filings…",
  added: 0,
  reduced: 0,
  newPositions: 0,
  filingQuarter: null,
};

export function ConvictionScoreOverviewCard({ ticker }: { ticker: string }) {
  const [conviction, setConviction] = useState<ConvictionRingScore>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setConviction({
        ...EMPTY,
        detail: "Loading institutional filings…",
      });
      try {
        const data = await fetchJsonWithTimeout<{
          results?: InstitutionalAccumulation[];
          status?: string;
          message?: string;
        }>(
          `/api/evidence/institutional?ticker=${encodeURIComponent(ticker)}`,
          26_000,
          controller.signal,
        );
        if (cancelled) return;
        if (data.status === "timeout" || data.status === "error") {
          setConviction({
            score: null,
            tone: "neutral",
            label: "Unavailable",
            detail: data.message ?? "Institutional filings could not be loaded.",
            added: 0,
            reduced: 0,
            newPositions: 0,
            filingQuarter: null,
          });
        } else {
          setConviction(scoreInstitutionalConviction(data.results ?? []));
        }
      } catch {
        if (!cancelled) {
          setConviction({
            score: null,
            tone: "neutral",
            label: "Unavailable",
            detail: "Institutional filings could not be loaded.",
            added: 0,
            reduced: 0,
            newPositions: 0,
            filingQuarter: null,
          });
        }
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

  const detail =
    conviction.score !== null
      ? `Score ${conviction.score}/100 · ${conviction.detail}`
      : conviction.detail;

  return (
    <ConvictionScoreOverview
      score={conviction.score}
      label={conviction.label === "Unavailable" && !loading ? "Awaiting" : conviction.label}
      tone={conviction.tone}
      detail={detail}
      meta={
        loading
          ? "LOADING"
          : conviction.filingQuarter
            ? `${conviction.filingQuarter} 13F`
            : "13F FILINGS"
      }
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
