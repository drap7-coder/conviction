"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  ytd: "Normalized · year to date",
};

/** Bucket key so holdings + benchmark can align across Yahoo timestamps. */
function alignKey(date: string, range: StockHistoryRange): string {
  if (range === "1m" || range === "6m" || range === "1y" || range === "ytd") {
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
 * Book vs Benchmark — portfolio NAV vs the active Compare-against ETF,
 * range-selectable, with optional Compare / moves footer in the same card.
 */
export function PortfolioBenchmarkChart({
  positions,
  benchmarkTicker = "SPY",
  benchmarkLabel = "SPY",
  skipChart = false,
  children,
}: {
  positions: { ticker: string; shares: number }[];
  benchmarkTicker?: string;
  benchmarkLabel?: string;
  /** When true, skip history fetch and render only the Compare footer. */
  skipChart?: boolean;
  children?: ReactNode;
}) {
  const benchTicker = benchmarkTicker.toUpperCase();
  const [range, setRange] = useState<StockHistoryRange>("1m");
  const [histories, setHistories] = useState<Record<string, HistPoint[]>>({});
  const [benchmark, setBenchmark] = useState<HistPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">(skipChart ? "ready" : "loading");

  const tickers = useMemo(
    () => Array.from(new Set(positions.map((position) => position.ticker.toUpperCase()))),
    [positions],
  );
  const tickerKey = tickers.join(",");

  useEffect(() => {
    if (skipChart || tickers.length === 0) {
      setStatus("ready");
      setHistories({});
      setBenchmark([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      const results = await Promise.all([
        ...tickers.map((ticker) => fetchHistory(ticker, range, controller.signal)),
        fetchHistory(benchTicker, range, controller.signal),
      ]);
      if (cancelled) return;
      const map: Record<string, HistPoint[]> = {};
      tickers.forEach((ticker, index) => {
        map[ticker] = results[index];
      });
      setHistories(map);
      setBenchmark(results[results.length - 1]);
      setStatus("ready");
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, range, benchTicker, skipChart]);

  const { series, takeaway, takeawayTone } = useMemo<{
    series: MacroChainSeries[];
    takeaway: string | null;
    takeawayTone: "ahead" | "behind" | "flat" | null;
  }>(() => {
    if (skipChart || benchmark.length < 2) {
      return { series: [], takeaway: null, takeawayTone: null };
    }

    const benchMap = new Map(
      benchmark.map((point) => [alignKey(point.date, range), point.close]),
    );
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

    const alignedKeys = benchmark
      .map((point) => alignKey(point.date, range))
      .filter((key, index, all) => all.indexOf(key) === index)
      .filter((key) => holdingMaps.every((holding) => holding.map.has(key)));

    if (alignedKeys.length < 2) return { series: [], takeaway: null, takeawayTone: null };

    const navValues = alignedKeys.map((key) =>
      holdingMaps.reduce((sum, holding) => sum + holding.shares * (holding.map.get(key) ?? 0), 0),
    );
    const benchValues = alignedKeys.map((key) => benchMap.get(key) ?? 0);

    const navReturn =
      navValues[0] > 0 ? ((navValues[navValues.length - 1] - navValues[0]) / navValues[0]) * 100 : 0;
    const benchReturn =
      benchValues[0] > 0
        ? ((benchValues[benchValues.length - 1] - benchValues[0]) / benchValues[0]) * 100
        : 0;
    const delta = navReturn - benchReturn;
    const takeawayTone: "ahead" | "behind" | "flat" =
      Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "ahead" : "behind";
    const takeawayText =
      takeawayTone === "flat"
        ? `Your book is tracking ${benchmarkLabel} over this window.`
        : `Your book is ${takeawayTone === "ahead" ? "outpacing" : "trailing"} ${benchmarkLabel} by ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}% over this window.`;

    return {
      series: [
        { key: "portfolio", label: "Your Portfolio", color: "#2dd4bf", values: navValues },
        { key: "benchmark", label: benchmarkLabel, color: "#8b95a5", values: benchValues },
      ],
      takeaway: takeawayText,
      takeawayTone,
    };
  }, [benchmark, histories, positions, range, benchmarkLabel, skipChart]);

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

  const chartBody = (() => {
    if (skipChart) return null;
    if (status === "loading") {
      return <div className="pf-benchmark-skeleton" aria-hidden="true" />;
    }
    if (series.length === 0) {
      return <p className="pf-benchmark-empty">Not enough shared history for this range.</p>;
    }
    return (
      <>
        <MacroChainChart series={series} title="" subtitle={RANGE_SUBTITLE[range]} depth />
        {takeaway ? (
          <p className={`pf-benchmark-takeaway${takeawayTone ? ` is-${takeawayTone}` : ""}`}>
            {takeaway}
          </p>
        ) : null}
      </>
    );
  })();

  return (
    <section
      className="pf-benchmark surface-shell"
      aria-label="Book vs benchmark"
      aria-busy={!skipChart && status === "loading" ? true : undefined}
    >
      {!skipChart ? (
        <div className="pf-benchmark-head">
          <span className="pf-section-eyebrow">Book vs Benchmark</span>
          {rangeTabs}
        </div>
      ) : null}
      {chartBody}
      {children ? (
        <div className={`pf-benchmark-compare${skipChart ? " is-solo" : ""}`}>{children}</div>
      ) : null}
    </section>
  );
}
