/**
 * Dashboard Conviction Score — same getCardVerdict formula as Trending / Watchlist rings.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { ConvictionScoreOverview } from "@/app/components/ConvictionScoreOverview";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  getCardVerdict,
  type CardVerdictShortInterest,
} from "@/lib/evidence/card-verdict";
import type { StockQuote } from "@/lib/market/quotes";
import type { ShortInterestSummary } from "@/lib/market/short-interest";
import type { GaugeTone } from "@/components/GaugeRing";

function ringFromVerdict(tone: string, strength: number): {
  tone: GaugeTone;
  label: string;
} {
  if (tone === "positive") return { tone: "green", label: "Accumulating" };
  if (tone === "negative") return { tone: "red", label: "Distribution" };
  if (tone === "contested") return { tone: "amber", label: "Holding" };
  return {
    tone: strength >= 55 ? "amber" : "neutral",
    label: strength >= 55 ? "Holding" : "Awaiting",
  };
}

export function ConvictionScoreOverviewCard({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [shortInterest, setShortInterest] = useState<CardVerdictShortInterest | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setQuote(null);
      setShortInterest(undefined);

      const [quotesRes, shortRes] = await Promise.all([
        fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
          8_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<ShortInterestSummary & { status?: string }>(
          `/api/market/short-interest?ticker=${encodeURIComponent(ticker)}`,
          10_000,
          controller.signal,
        ).catch(() => null),
      ]);

      if (cancelled) return;

      setQuote(quotesRes?.quotes?.[0] ?? null);
      setShortInterest(
        shortRes
          ? {
              status: shortRes.status as CardVerdictShortInterest["status"],
              latest: shortRes.latest ?? null,
            }
          : undefined,
      );
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const verdict = useMemo(() => {
    if (!quote) return null;
    return getCardVerdict(
      {
        ticker: ticker.toUpperCase(),
        companyName: quote.name || ticker.toUpperCase(),
        addedAt: new Date().toISOString(),
        status: "active",
      },
      quote,
      shortInterest,
    );
  }, [quote, shortInterest, ticker]);

  const ring = verdict ? ringFromVerdict(verdict.tone, verdict.strength) : null;

  return (
    <ConvictionScoreOverview
      score={verdict?.strength ?? null}
      label={ring?.label ?? "Unavailable"}
      tone={ring?.tone ?? "neutral"}
      detail={
        verdict
          ? `Score ${verdict.strength}/100 · ${verdict.insight}`
          : loading
            ? "Loading live quote and short interest…"
            : "Quote unavailable — score cannot be calculated."
      }
      meta={loading ? "LOADING" : "LIVE"}
      loading={loading}
      className="dashboard-conviction-overview"
    />
  );
}
