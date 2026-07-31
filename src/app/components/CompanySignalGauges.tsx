/**
 * Side-by-side day / 52-week / volume gauges for the company dashboard.
 */

"use client";

import { useEffect, useState } from "react";
import { GaugeRing } from "@/components/GaugeRing";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import { isFiniteNumber } from "@/lib/display/format";
import {
  rangePosition,
  volumeVsAverage,
} from "@/lib/market/quote-gauges";

function formatRange(low: number | null, high: number | null): string {
  if (!isFiniteNumber(low) || !isFiniteNumber(high)) return "—";
  const fmt = (value: number) =>
    `$${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 2 : 3,
      minimumFractionDigits: value >= 1 ? 2 : 3,
    })}`;
  return `${fmt(low)}—${fmt(high)}`;
}

function toneForRange(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 70) return "green";
  if (pct <= 30) return "red";
  return "amber";
}

function toneForVolume(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 100) return "green";
  if (pct >= 70) return "amber";
  return "red";
}

export function CompanySignalGauges({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [averageVolume, setAverageVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const [quotesRes, shortRes] = await Promise.all([
        fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
          8_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<{
          status?: string;
          latest?: { averageDailyVolume?: number } | null;
        }>(
          `/api/market/short-interest?ticker=${encodeURIComponent(ticker)}`,
          8_000,
          controller.signal,
        ).catch(() => null),
      ]);

      if (cancelled) return;
      setQuote(quotesRes?.quotes?.[0] ?? null);
      const avg =
        shortRes?.status === "success" && isFiniteNumber(shortRes.latest?.averageDailyVolume)
          ? shortRes.latest!.averageDailyVolume!
          : null;
      setAverageVolume(avg);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const live = quote ? getLivePrice(quote) : null;
  const dayPct = quote
    ? rangePosition(live?.price ?? quote.price, quote.dayLow, quote.dayHigh)
    : null;
  const weekPct = quote
    ? rangePosition(
        live?.price ?? quote.price,
        quote.fiftyTwoWeekLow,
        quote.fiftyTwoWeekHigh,
      )
    : null;
  const volumePct = quote
    ? volumeVsAverage(quote.volume, averageVolume)
    : null;

  return (
    <section className="quote-card dashboard-signal-gauges" aria-label="Signal gauges">
      <div className="quote-card-header">
        <span className="quote-card-title">Signal gauges</span>
        <span className="quote-card-meta">{loading ? "LOADING" : "LIVE"}</span>
      </div>
      <div className="quote-signal-gauges">
        <GaugeRing
          value={dayPct}
          label={dayPct !== null ? `${Math.round(dayPct)}%` : "—"}
          detail={quote ? formatRange(quote.dayLow, quote.dayHigh) : "—"}
          caption="Day range"
          tone={toneForRange(dayPct)}
        />
        <GaugeRing
          value={weekPct}
          label={weekPct !== null ? `${Math.round(weekPct)}%` : "—"}
          detail={quote ? formatRange(quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh) : "—"}
          caption="52-week range"
          tone={toneForRange(weekPct)}
        />
        <GaugeRing
          value={volumePct !== null ? Math.min(100, volumePct) : null}
          label={volumePct !== null ? `${Math.round(volumePct)}%` : "—"}
          detail={averageVolume ? "vs avg volume" : "Avg unavailable"}
          caption="Volume"
          tone={toneForVolume(volumePct)}
        />
      </div>
    </section>
  );
}
