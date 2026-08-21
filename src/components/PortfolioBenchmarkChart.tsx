"use client";

import { useEffect, useMemo, useState } from "react";
import { MacroChainChart, type MacroChainSeries } from "@/components/market/MacroChainChart";

type HistPoint = { date: string; close: number };

function dayKey(date: string): string {
  return date.slice(0, 10);
}

async function fetchHistory(ticker: string, signal: AbortSignal): Promise<HistPoint[]> {
  try {
    const res = await fetch(
      `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1m`,
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
 * Book vs Benchmark — portfolio NAV (teal) vs SPY (gray), last 15 sessions,
 * normalized 0–100 via the shared MacroChain chart. Portfolio NAV is computed
 * from each holding's daily closes (Σ shares × close) on dates common to all
 * holdings and SPY. Renders nothing when history can't be aligned.
 */
export function PortfolioBenchmarkChart({
  positions,
}: {
  positions: { ticker: string; shares: number }[];
}) {
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
        ...tickers.map((ticker) => fetchHistory(ticker, controller.signal)),
        fetchHistory("SPY", controller.signal),
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
  }, [tickerKey]);

  const { series, takeaway, takeawayTone } = useMemo<{
    series: MacroChainSeries[];
    takeaway: string | null;
    takeawayTone: "ahead" | "behind" | "flat" | null;
  }>(() => {
    if (spy.length < 2) return { series: [], takeaway: null, takeawayTone: null };

    const spyMap = new Map(spy.map((point) => [dayKey(point.date), point.close]));
    const holdingMaps = positions
      .map((position) => ({
        shares: position.shares,
        map: new Map(
          (histories[position.ticker.toUpperCase()] ?? []).map((point) => [dayKey(point.date), point.close]),
        ),
      }))
      .filter((holding) => holding.map.size > 0);

    if (holdingMaps.length === 0) return { series: [], takeaway: null, takeawayTone: null };

    // Dates present across SPY and every priced holding, most recent 15.
    const alignedDates = spy
      .map((point) => dayKey(point.date))
      .filter((date) => holdingMaps.every((holding) => holding.map.has(date)))
      .slice(-15);

    if (alignedDates.length < 2) return { series: [], takeaway: null, takeawayTone: null };

    const navValues = alignedDates.map((date) =>
      holdingMaps.reduce((sum, holding) => sum + holding.shares * (holding.map.get(date) ?? 0), 0),
    );
    const spyValues = alignedDates.map((date) => spyMap.get(date) ?? 0);

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
  }, [spy, histories, positions]);

  if (status === "loading") {
    return (
      <section className="pf-benchmark" aria-label="Book vs benchmark" aria-busy="true">
        <span className="pf-section-eyebrow">Book vs Benchmark</span>
        <div className="pf-benchmark-skeleton" aria-hidden="true" />
      </section>
    );
  }

  if (series.length === 0) return null;

  return (
    <section className="pf-benchmark" aria-label="Book vs benchmark">
      <MacroChainChart
        series={series}
        title="Book vs Benchmark"
        subtitle="Normalized · last 15 sessions"
      />
      {takeaway ? (
        <p className={`pf-benchmark-takeaway${takeawayTone ? ` is-${takeawayTone}` : ""}`}>
          {takeaway}
        </p>
      ) : null}
    </section>
  );
}
