"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { computeSma, buildSmaPath } from "@/lib/market/technical-state";

type TrendRange = "1d" | "1w" | "1m" | "6m" | "1y";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface StockHistory {
  ticker: string;
  range: TrendRange;
  points: StockHistoryPoint[];
  startPrice: number | null;
  endPrice: number | null;
  change: number | null;
  changePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketCap: number | null;
}

interface HistoryResponse {
  history: StockHistory;
}

interface PriceTrendCardProps {
  ticker: string;
  /** Optional external history — if provided, the card won't fetch on its own */
  history?: StockHistory | null;
  status?: EvidenceStatus;
  onRangeChange?: (range: TrendRange) => void;
  activeRange?: TrendRange;
}

const RANGES: Array<{ label: string; value: TrendRange }> = [
  { label: "Day", value: "1d" },
  { label: "Week", value: "1w" },
  { label: "Month", value: "1m" },
  { label: "6M", value: "6m" },
  { label: "Year", value: "1y" },
];

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(value >= 100 ? 2 : 2)}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function buildPath(points: StockHistoryPoint[]) {
  if (points.length < 2) return "";
  const width = 320;
  const height = 96;
  const padding = 6;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + ((max - point.close) / spread) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function PriceTrendCard({
  ticker,
  history: externalHistory,
  status: externalStatus,
  onRangeChange,
  activeRange,
}: PriceTrendCardProps) {
  const [internalRange, setInternalRange] = useState<TrendRange>("1m");
  const [internalHistory, setInternalHistory] = useState<StockHistory | null>(null);
  const [internalStatus, setInternalStatus] = useState<EvidenceStatus>("idle");

  const range = activeRange ?? internalRange;
  const history = externalHistory ?? internalHistory;
  const status = externalStatus ?? internalStatus;

  const setRange = onRangeChange ?? setInternalRange;

  useEffect(() => {
    // If external history is provided, skip internal fetch
    if (externalHistory !== undefined) return;
    const controller = new AbortController();

    async function load() {
      setInternalStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<HistoryResponse>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=${range}`,
          8_000,
          controller.signal,
        );
        setInternalHistory(data.history);
        setInternalStatus(data.history.points.length >= 2 ? "success" : "empty");
      } catch {
        setInternalHistory(null);
        setInternalStatus("error");
      }
    }

    void load();
    return () => controller.abort();
  }, [ticker, range, externalHistory]);

  const path = useMemo(() => buildPath(history?.points ?? []), [history]);
  const isPositive = (history?.change ?? 0) >= 0;

  // Compute SMA overlays
  const smaPaths = useMemo(() => {
    if (!history || history.points.length < 2) return { sma50: "", sma200: "" };
    const closes = history.points.map((p) => p.close);
    const width = 320;
    const height = 96;
    const padding = 6;

    const sma50Values = computeSma(closes, 50);
    const sma200Values = computeSma(closes, 200);

    return {
      sma50: buildSmaPath(closes, sma50Values, width, height, padding),
      sma200: buildSmaPath(closes, sma200Values, width, height, padding),
    };
  }, [history]);

  return (
    <section className="price-trend-card" aria-label={`${ticker} price trend`}>
      <div className="price-trend-top">
        <div>
          <span className="move-eyebrow">Price trend</span>
          <strong>{history?.endPrice ? formatPrice(history.endPrice) : status === "loading" ? "Loading market tape" : "Trend unavailable"}</strong>
          <p className={isPositive ? "trend-positive" : "trend-negative"}>
            {status === "success" ? `${formatPercent(history?.changePercent)} over selected range` : "Uses the existing quote provider. No extra market-data system."}
          </p>
        </div>
        <div className="price-range-tabs" aria-label="Price range">
          {RANGES.map((option) => (
            <button
              aria-pressed={range === option.value}
              className={range === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setRange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`price-chart ${isPositive ? "positive" : "negative"} ${status === "loading" ? "loading" : ""}`}>
        {status === "loading" ? (
          <div className="price-chart-build" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : path ? (
          <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 320 96">
            {smaPaths.sma200 ? (
              <path className="price-chart-sma200" d={smaPaths.sma200} />
            ) : null}
            {smaPaths.sma50 ? (
              <path className="price-chart-sma50" d={smaPaths.sma50} />
            ) : null}
            <path className="price-chart-glow" d={path} />
            <path className="price-chart-line" d={path} />
          </svg>
        ) : (
          <span className="price-chart-empty">Market chart unavailable right now.</span>
        )}
      </div>
    </section>
  );
}