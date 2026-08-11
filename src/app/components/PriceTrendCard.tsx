"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { computeSma } from "@/lib/market/technical-state";
import { inkBoxClass, inkChipClass } from "@/lib/display/ink-tone";

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
  showQuote?: boolean;
  /** Render chart chrome only — used inside CompanyQuoteCard. */
  embedded?: boolean;
}

const RANGES: Array<{ label: string; value: TrendRange }> = [
  { label: "Day", value: "1d" },
  { label: "5D", value: "1w" },
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

function formatChange(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 126;
const PLOT_LEFT = 8;
const PLOT_RIGHT = 300;
const PLOT_TOP = 9;
const PLOT_BOTTOM = 101;

function formatChartDate(value: string, range: TrendRange): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  if (range === "1d") {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildSeriesPath(
  values: Array<number | null>,
  domainMin: number,
  domainMax: number,
): string {
  const spread = domainMax - domainMin || 1;
  const lastIndex = Math.max(1, values.length - 1);
  let started = false;

  return values.map((value, index) => {
    if (value === null) return "";
    const x = PLOT_LEFT + (index / lastIndex) * (PLOT_RIGHT - PLOT_LEFT);
    const y = PLOT_TOP + ((domainMax - value) / spread) * (PLOT_BOTTOM - PLOT_TOP);
    const command = started ? "L" : "M";
    started = true;
    return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}

function chartGeometry(points: StockHistoryPoint[], range: TrendRange) {
  if (points.length < 2) return null;
  const closes = points.map((point) => point.close);
  const rawMin = Math.min(...closes);
  const rawMax = Math.max(...closes);
  const rawSpread = rawMax - rawMin || Math.max(rawMax * 0.02, 1);
  const domainMin = rawMin - rawSpread * 0.08;
  const domainMax = rawMax + rawSpread * 0.08;
  const spread = domainMax - domainMin;
  const endPrice = closes.at(-1)!;
  const endY = PLOT_TOP + ((domainMax - endPrice) / spread) * (PLOT_BOTTOM - PLOT_TOP);
  const labelY = Math.max(PLOT_TOP + 8, Math.min(PLOT_BOTTOM - 8, endY));

  return {
    closes,
    path: buildSeriesPath(closes, domainMin, domainMax),
    domainMin,
    domainMax,
    endPrice,
    endY,
    labelY,
    startLabel: formatChartDate(points[0]!.date, range),
    endLabel: formatChartDate(points.at(-1)!.date, range),
    ticks: [rawMax, (rawMax + rawMin) / 2, rawMin].map((value) => ({
      value,
      y: PLOT_TOP + ((domainMax - value) / spread) * (PLOT_BOTTOM - PLOT_TOP),
    })),
  };
}

export function PriceTrendCard({
  ticker,
  history: externalHistory,
  status: externalStatus,
  onRangeChange,
  activeRange,
  showQuote = true,
  embedded = false,
}: PriceTrendCardProps) {
  const [internalRange, setInternalRange] = useState<TrendRange>("1m");
  const [internalHistory, setInternalHistory] = useState<StockHistory | null>(null);
  const [internalStatus, setInternalStatus] = useState<EvidenceStatus>("idle");
  const [responsiveRangeReady, setResponsiveRangeReady] = useState(false);

  const range = activeRange ?? internalRange;
  const history = externalHistory ?? internalHistory;
  const status = externalStatus ?? internalStatus;

  const setRange = onRangeChange ?? setInternalRange;

  useEffect(() => {
    if (activeRange === undefined && window.matchMedia("(max-width: 640px)").matches) {
      setInternalRange("1w");
    }
    setResponsiveRangeReady(true);
  }, [activeRange]);

  useEffect(() => {
    // If external history is provided, skip internal fetch
    if (externalHistory !== undefined) return;
    if (!responsiveRangeReady) return;
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
  }, [ticker, range, externalHistory, responsiveRangeReady]);

  const geometry = useMemo(
    () => chartGeometry(history?.points ?? [], range),
    [history, range],
  );
  const isPositive = (history?.change ?? 0) >= 0;

  // Compute SMA overlays
  const smaPaths = useMemo(() => {
    if (!history || !geometry) return { sma50: "", sma200: "" };
    const closes = geometry.closes;

    const sma50Values = computeSma(closes, 50);
    const sma200Values = computeSma(closes, 200);

    return {
      sma50: buildSeriesPath(sma50Values, geometry.domainMin, geometry.domainMax),
      sma200: buildSeriesPath(sma200Values, geometry.domainMin, geometry.domainMax),
    };
  }, [history, geometry]);

  const moveTone = status === "success"
    ? (isPositive ? "up" : "down")
    : "quiet";

  const shellClass = embedded
    ? "price-trend-card price-trend-card--embedded"
    : `price-trend-card ${inkBoxClass("quiet")}`;

  return (
    <section className={shellClass} aria-label={`${ticker} price trend`}>
      <div className="price-trend-top">
        {showQuote ? (
          <div className="price-trend-quote">
            <strong>{history?.endPrice ? formatPrice(history.endPrice) : status === "loading" ? "Loading market tape" : "Trend unavailable"}</strong>
            {status === "success" ? (
              <span className={inkChipClass(moveTone)}>
                {formatChange(history?.change)}
                <span aria-hidden="true"> · </span>
                {formatPercent(history?.changePercent)}
              </span>
            ) : null}
          </div>
        ) : embedded ? null : (
          <span className="price-trend-label">Chart</span>
        )}
        <div className={`price-range-tabs${embedded ? " price-range-tabs--end" : ""}`} aria-label="Price range">
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
        ) : geometry ? (
          <>
            <svg role="img" aria-label={`${ticker} price chart with price levels`} preserveAspectRatio="none" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
              <title>{`${ticker} price from ${geometry.startLabel} to ${geometry.endLabel}, ending at ${formatPrice(geometry.endPrice)}`}</title>
              {geometry.ticks.map((tick, index) => (
                <line className="price-chart-level" key={`${tick.value}-${index}`} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={tick.y} y2={tick.y} />
              ))}
              {smaPaths.sma200 ? <path className="price-chart-sma200" d={smaPaths.sma200} /> : null}
              {smaPaths.sma50 ? <path className="price-chart-sma50" d={smaPaths.sma50} /> : null}
              <path className="price-chart-glow" d={geometry.path} />
              <path className="price-chart-line" d={geometry.path} />
              <line className="price-chart-current-guide" x1={PLOT_RIGHT} x2={CHART_WIDTH - 7} y1={geometry.endY} y2={geometry.endY} />
              <circle className="price-chart-current-dot" cx={PLOT_RIGHT} cy={geometry.endY} r="3.4" />
            </svg>
            <div className="price-chart-scale" aria-hidden="true">
              {geometry.ticks.map((tick, index) => (
                <span key={`${tick.value}-${index}`} style={{ top: `${(tick.y / CHART_HEIGHT) * 100}%` }}>
                  {formatPrice(tick.value)}
                </span>
              ))}
            </div>
            <span
              className="price-chart-current-label"
              style={{ top: `${(geometry.labelY / CHART_HEIGHT) * 100}%` }}
              aria-hidden="true"
            >
              {formatPrice(geometry.endPrice)}
            </span>
            <div className="price-chart-dates" aria-hidden="true">
              <span>{geometry.startLabel}</span>
              <span>{geometry.endLabel}</span>
            </div>
          </>
        ) : (
          <span className="price-chart-empty">Market chart unavailable right now.</span>
        )}
      </div>
    </section>
  );
}
