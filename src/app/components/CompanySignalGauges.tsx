/**
 * Dashboard gauges: session signals + technical SMA context.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { GaugeRing } from "@/components/GaugeRing";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import { isFiniteNumber } from "@/lib/display/format";
import {
  rangePosition,
  volumeVsAverage,
} from "@/lib/market/quote-gauges";
import {
  deriveTechnicalState,
  type StockHistoryPoint,
} from "@/lib/market/technical-state";

function formatRange(low: number | null, high: number | null): string {
  if (!isFiniteNumber(low) || !isFiniteNumber(high)) return "—";
  const fmt = (value: number) =>
    `$${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 2 : 3,
      minimumFractionDigits: value >= 1 ? 2 : 3,
    })}`;
  return `${fmt(low)}—${fmt(high)}`;
}

function formatPrice(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  })}`;
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

function toneForSma(delta: number | null): "green" | "amber" | "red" | "neutral" {
  if (delta === null) return "neutral";
  if (delta >= 0.5) return "green";
  if (delta <= -0.5) return "red";
  return "amber";
}

/** Map SMA % delta onto a 0–100 ring centered at 50 (at the average). */
function smaGaugeValue(delta: number | null): number | null {
  if (delta === null || !Number.isFinite(delta)) return null;
  return Math.max(0, Math.min(100, 50 + delta * 2.5));
}

function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return "—";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

export function CompanySignalGauges({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [averageVolume, setAverageVolume] = useState<number | null>(null);
  const [historyPoints, setHistoryPoints] = useState<StockHistoryPoint[]>([]);
  const [week52High, setWeek52High] = useState<number | null>(null);
  const [week52Low, setWeek52Low] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const [quotesRes, shortRes, historyRes] = await Promise.all([
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
        fetchJsonWithTimeout<{
          history?: {
            points?: StockHistoryPoint[];
            fiftyTwoWeekHigh?: number | null;
            fiftyTwoWeekLow?: number | null;
          };
        }>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
          12_000,
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
      setHistoryPoints(historyRes?.history?.points ?? []);
      setWeek52High(historyRes?.history?.fiftyTwoWeekHigh ?? null);
      setWeek52Low(historyRes?.history?.fiftyTwoWeekLow ?? null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const live = quote ? getLivePrice(quote) : null;
  const livePrice = live?.price ?? quote?.price ?? null;

  const dayPct = quote
    ? rangePosition(livePrice, quote.dayLow, quote.dayHigh)
    : null;
  const weekPct = quote
    ? rangePosition(livePrice, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh)
    : null;
  const volumePct = quote
    ? volumeVsAverage(quote.volume, averageVolume)
    : null;

  const technical = useMemo(
    () => deriveTechnicalState(historyPoints, livePrice, week52High, week52Low),
    [historyPoints, livePrice, week52High, week52Low],
  );

  const sma50Value = smaGaugeValue(technical.sma50Delta);
  const sma200Value = smaGaugeValue(technical.sma200Delta);

  return (
    <>
      <section className="quote-card dashboard-signal-gauges ink-box ink-box--quiet" aria-label="Signal gauges">
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

      <section className="quote-card dashboard-signal-gauges ink-box ink-box--quiet" aria-label="Technical gauges">
        <div className="quote-card-header">
          <span className="quote-card-title">Technical</span>
          <span className="quote-card-meta">
            {loading ? "LOADING" : technical.label === "Insufficient Data" ? "NO DATA" : technical.label.toUpperCase()}
          </span>
        </div>
        <div className="quote-signal-gauges quote-signal-gauges-pair">
          <GaugeRing
            value={sma50Value}
            label={formatDelta(technical.sma50Delta)}
            detail={
              technical.sma50 !== null
                ? `${technical.sma50Relation ?? "vs"} ${formatPrice(technical.sma50)}`
                : "SMA50 unavailable"
            }
            caption="vs SMA50"
            tone={toneForSma(technical.sma50Delta)}
          />
          <GaugeRing
            value={sma200Value}
            label={formatDelta(technical.sma200Delta)}
            detail={
              technical.sma200 !== null
                ? `${technical.sma200Relation ?? "vs"} ${formatPrice(technical.sma200)}`
                : "SMA200 unavailable"
            }
            caption="vs SMA200"
            tone={toneForSma(technical.sma200Delta)}
          />
        </div>
      </section>
    </>
  );
}
