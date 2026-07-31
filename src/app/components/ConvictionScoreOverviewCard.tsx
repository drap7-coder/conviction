/**
 * Dashboard Conviction Score — shared composite
 * (institutional 45% + technicals 38% + short interest 17%).
 */

"use client";

import { useEffect, useState } from "react";
import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { GaugeTone } from "@/components/GaugeRing";

export function ConvictionScoreOverviewCard({ ticker }: { ticker: string }) {
  const [score, setScore] = useState<ConvictionScoreView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setScore(null);
      try {
        const data = await fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        );
        if (!cancelled) setScore(data);
      } catch {
        if (!cancelled) setScore(null);
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

  const tone = (score?.tone ?? "neutral") as GaugeTone;
  const detail = score?.detail
    ?? (loading
      ? "Loading institutional, technical, and short-interest evidence…"
      : "Conviction score could not be loaded.");

  return (
    <ConvictionScoreOverview
      score={score?.displayScore ?? null}
      label={score?.ringLabel ?? "Awaiting"}
      tone={tone}
      detail={detail}
      meta={loading ? "LOADING" : "COMPOSITE"}
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
