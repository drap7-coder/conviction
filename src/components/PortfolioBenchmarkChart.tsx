"use client";

import { useEffect, useMemo, useState } from "react";
import { MacroChainChart, type MacroChainSeries } from "@/components/market/MacroChainChart";
import type { StockHistoryRange } from "@/lib/market/quotes";

type HistPoint = { date: string; close: number };

const RANGES: Array<{ label: string; value: StockHistoryRange }> = [
  { label: "Today", value: "1d" },
  { label: "5D", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
];

const RANGE_SUBTITLE: Record<StockHistoryRange, string> = {
  "1d": "Normalized · today",
  "1w": "Normalized · 5 days",
  "1m": "Normalized · 1 month",
  "6m": "Normalized · 6 months",
  "1y": "Normalized · 1 year",
};

/** Bucket key so holdings + SPY can align across Yahoo timestamps. */
function alignKey(date: string, range: StockHistoryRange): string {
  if (range === "1m" || range === "6m" || range === "1y") {
    return date.slice(0, 10);
  }
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return date;
  const bucketMs = range === "1d" ? 5 * 60 * 1000 : 30 * 60 * 1000;
  return String(Math.floor(ms / bucketMs) * bucketMs);
}

async function fetchHistory(
  ticker: string,
  range: StockHistoryRange,
  signal: AbortSignal,
): Promise<HistPoint[]> {
  try {
    const res = await fetch(
      `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { history?: { points?: HistPoint[] } };
    return (data.history?.points ?? [])
      .map((point) => ({ date: point.date, close: point.close }))
      .filter((point) => typeof point.close === "number" && Number.isFinite(point.close));
  } catch {
    return [];
  }
}

/**
 * Book vs Benchmark — portfolio NAV (teal) vs SPY (gray), range-selectable,
 * normalized 0–100 via the shared MacroChain chart. Portfolio NAV is computed
 * from each holding's closes (Σ shares × close) on timestamps common to all
 * holdings and SPY. Renders nothing when history can't be aligned.
 */
export function PortfolioBenchmarkChart({
  positions,
}: {
  positions: { ticker: string; shares: number }[];
}) {
  const [range, setRange] = useState<StockHistoryRange>("1m");
  const [histories, setHistories] = useState<Record<string, HistPoint[]>>({});
  const [spy, setSpy] = useState<HistPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const tickers = useMemo(
    () => Array.from(new Set(positions.map((position) => position.ticker.toUpperCase()))),
    [positions],
  );
  const tickerKey = tickers.join(",");

  useEffect(() => {
    if (tickers.length === 0) {
      setStatus("ready");
      setHistories({});
      setSpy([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      const results = await Promise.all([
        ...tickers.map((ticker) => fetchHistory(ticker, range, controller.signal)),
        fetchHistory("SPY", range, controller.signal),
      ]);
      if (cancelled) return;
      const map: Record<string, HistPoint[]> = {};
      tickers.forEach((ticker, index) => {
        map[ticker] = results[index];
      });
      setHistories(map);
      setSpy(results[results.length - 1]);
      setStatus("ready");
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, range]);

  const { series, takeaway, takeawayTone } = useMemo<{
    series: MacroChainSeries[];
    takeaway: string | null;
    takeawayTone: "ahead" | "behind" | "flat" | null;
  }>(() => {
    if (spy.length < 2) return { series: [], takeaway: null, takeawayTone: null };

    const spyMap = new Map(spy.map((point) => [alignKey(point.date, range), point.close]));
    const holdingMaps = positions
      .map((position) => ({
        shares: position.shares,
        map: new Map(
          (histories[position.ticker.toUpperCase()] ?? []).map((point) => [
            alignKey(point.date, range),
            point.close,
          ]),
        ),
      }))
      .filter((holding) => holding.map.size > 0);

    if (holdingMaps.length === 0) return { series: [], takeaway: null, takeawayTone: null };

    // Keys present across SPY and every priced holding, in SPY order.
    const alignedKeys = spy
      .map((point) => alignKey(point.date, range))
      .filter((key, index, all) => all.indexOf(key) === index)
      .filter((key) => holdingMaps.every((holding) => holding.map.has(key)));

    if (alignedKeys.length < 2) return { series: [], takeaway: null, takeawayTone: null };

    const navValues = alignedKeys.map((key) =>
      holdingMaps.reduce((sum, holding) => sum + holding.shares * (holding.map.get(key) ?? 0), 0),
    );
    const spyValues = alignedKeys.map((key) => spyMap.get(key) ?? 0);

    const navReturn = navValues[0] > 0 ? ((navValues[navValues.length - 1] - navValues[0]) / navValues[0]) * 100 : 0;
    const spyReturn = spyValues[0] > 0 ? ((spyValues[spyValues.length - 1] - spyValues[0]) / spyValues[0]) * 100 : 0;
    const delta = navReturn - spyReturn;
    const takeawayTone: "ahead" | "behind" | "flat" =
      Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "ahead" : "behind";
    const takeawayText =
      takeawayTone === "flat"
        ? "Your book is tracking SPY over this window."
        : `Your book is ${takeawayTone === "ahead" ? "outpacing" : "trailing"} SPY by ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}% over this window.`;

    return {
      series: [
        { key: "portfolio", label: "Your Portfolio", color: "#2dd4bf", values: navValues },
        { key: "spy", label: "SPY", color: "#8b95a5", values: spyValues },
      ],
      takeaway: takeawayText,
      takeawayTone,
    };
  }, [spy, histories, positions, range]);

  const rangeTabs = (
    <div className="price-range-tabs pf-benchmark-ranges" role="tablist" aria-label="Benchmark range">
      {RANGES.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={range === item.value}
          className={range === item.value ? "active" : undefined}
          onClick={() => setRange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  if (status === "loading") {
    return (
      <section className="pf-benchmark" aria-label="Book vs benchmark" aria-busy="true">
        <div className="pf-benchmark-head">
          <span className="pf-section-eyebrow">Book vs Benchmark</span>
          {rangeTabs}
        </div>
        <div className="pf-benchmark-skeleton" aria-hidden="true" />
      </section>
    );
  }

  if (series.length === 0) {
    return (
      <section className="pf-benchmark" aria-label="Book vs benchmark">
        <div className="pf-benchmark-head">
          <span className="pf-section-eyebrow">Book vs Benchmark</span>
          {rangeTabs}
        </div>
        <p className="pf-benchmark-empty">Not enough shared history for this range.</p>
      </section>
    );
  }

  return (
    <section className="pf-benchmark" aria-label="Book vs benchmark">
      <div className="pf-benchmark-head">
        <span className="pf-section-eyebrow">Book vs Benchmark</span>
        {rangeTabs}
      </div>
      <MacroChainChart
        series={series}
        title=""
        subtitle={RANGE_SUBTITLE[range]}
      />
      {takeaway ? (
        <p className={`pf-benchmark-takeaway${takeawayTone ? ` is-${takeawayTone}` : ""}`}>
          {takeaway}
        </p>
      ) : null}
    </section>
  );
}
