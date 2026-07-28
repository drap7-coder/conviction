/**
 * Client loader for InstitutionalConvictionOverview on company dashboards.
 * Fetches 13F evidence and scores it — does not invent counts when empty.
 */

"use client";

import { useEffect, useState } from "react";
import { InstitutionalConvictionOverview } from "@/app/components/InstitutionalConvictionOverview";
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

export function InstitutionalConvictionOverviewCard({ ticker }: { ticker: string }) {
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

  return (
    <InstitutionalConvictionOverview
      conviction={conviction}
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
