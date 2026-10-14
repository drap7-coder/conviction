"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMarketHistory } from "@/lib/market/client-market-data";
import { mapPool } from "@/lib/map-pool";
import type { BriefName } from "@/lib/watchlist/daily-brief";
import {
  buildCorrelationMatrix,
  buildQuantTelemetry,
  closesFromPoints,
  logReturns,
  type QuantTickerTelemetry,
} from "@/lib/market/quant-telemetry";

const HISTORY_CONCURRENCY = 2;
const MAX_NAMES = 12;
const BENCH = "SPY";

function fmt(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function Spark({ values, anomaly }: { values: number[]; anomaly: boolean }) {
  if (values.length < 2) {
    return <span className="brief-quant-spark is-empty" aria-hidden="true" />;
  }
  const w = 72;
  const h = 22;
  const d = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - value * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`brief-quant-spark${anomaly ? " is-anomaly" : ""}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CorrHeat({
  tickers,
  values,
}: {
  tickers: string[];
  values: Array<Array<number | null>>;
}) {
  if (tickers.length < 2) {
    return (
      <p className="brief-quant-empty">
        Need at least two names with history to build a correlation grid.
      </p>
    );
  }
  return (
    <div className="brief-quant-corr" role="table" aria-label="Pairwise return correlation matrix">
      <div className="brief-quant-corr-row is-head" role="row">
        <span role="columnheader" />
        {tickers.map((ticker) => (
          <span key={ticker} role="columnheader">
            {ticker}
          </span>
        ))}
      </div>
      {tickers.map((rowTicker, i) => (
        <div key={rowTicker} className="brief-quant-corr-row" role="row">
          <span role="rowheader">{rowTicker}</span>
          {values[i].map((value, j) => {
            const tone =
              value == null
                ? "idle"
                : value >= 0.6
                  ? "hot"
                  : value <= -0.2
                    ? "cold"
                    : "mid";
            return (
              <span
                key={`${rowTicker}-${tickers[j]}`}
                role="cell"
                className={`is-${tone}`}
                title={
                  value == null
                    ? `${rowTicker} vs ${tickers[j]}: unavailable`
                    : `${rowTicker} vs ${tickers[j]}: ${value.toFixed(2)}`
                }
              >
                {value == null ? "—" : value.toFixed(2)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Quantitative overlay for Home brief scope.
 * Computes z-score, SPY beta, realized vol, and pairwise correlations from daily closes.
 * Does not invent style-factor loadings, implied vol, or order-book imbalance.
 */
export function BriefQuantOverlay({ names }: { names: BriefName[] }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<QuantTickerTelemetry[]>([]);
  const [corr, setCorr] = useState<{ tickers: string[]; values: Array<Array<number | null>> }>({
    tickers: [],
    values: [],
  });

  const scopeKey = JSON.stringify(names.slice(0, MAX_NAMES));

  useEffect(() => {
    const scoped = JSON.parse(scopeKey) as BriefName[];
    if (scoped.length === 0) {
      setRows([]);
      setCorr({ tickers: [], values: [] });
      setStatus("ready");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");

    void (async () => {
      try {
        const tickers = [...scoped.map((name) => name.ticker), BENCH];
        const histories = await mapPool(tickers, HISTORY_CONCURRENCY, (ticker) =>
          fetchMarketHistory(ticker, "6m", { reason: "manual", signal: controller.signal }),
        );
        if (cancelled) return;
        const benchCloses = closesFromPoints(
          (histories[histories.length - 1]?.points ?? []).map((point, index) => ({
            t: index,
            close: point.close,
          })),
        );
        const benchReturns = logReturns(benchCloses.slice(-(60 + 1)));
        const nextRows: QuantTickerTelemetry[] = [];
        const returnSeries: Array<{ ticker: string; returns: number[] }> = [];

        scoped.forEach((name, index) => {
          const closes = closesFromPoints(
            (histories[index]?.points ?? []).map((point, pointIndex) => ({
              t: pointIndex,
              close: point.close,
            })),
          );
          const row = buildQuantTelemetry({
            ticker: name.ticker,
            held: name.held,
            closes,
            benchReturns,
          });
          nextRows.push(row);
          returnSeries.push({ ticker: name.ticker, returns: logReturns(closes.slice(-(60 + 1))) });
        });

        setRows(nextRows);
        setCorr(buildCorrelationMatrix(returnSeries));
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [scopeKey]);

  const anomalies = rows.filter((row) => row.anomaly);

  return (
    <div className="brief-quant" aria-label="Quantitative overlay">
      <p className="brief-quant-disclaimer">
        Daily closes only · 60-session window · beta vs {BENCH}. No style-factor model, implied vol,
        or order-book feed on this path.
      </p>

      {status === "loading" ? (
        <p className="brief-quant-loading" role="status">
          Computing dispersion from market history…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="brief-quant-empty" role="status">
          Quantitative history is temporarily unavailable. Narrative coverage is unchanged.
        </p>
      ) : null}

      {status === "ready" ? (
        <>
          <section className="brief-quant-panel" aria-labelledby="brief-quant-exceptions-title">
            <div className="brief-panel-label">
              <h3 id="brief-quant-exceptions-title">01 / Dispersion flags</h3>
              <span>
                {anomalies.length} at ±2σ
              </span>
            </div>
            {anomalies.length === 0 ? (
              <p className="brief-quant-empty">
                No name in this batch is outside a ±2σ band vs its 60-session mean. Absence of a flag
                is not a trade signal.
              </p>
            ) : (
              <ul className="brief-quant-flags">
                {anomalies.map((row) => (
                  <li key={row.ticker} className={row.zScore != null && row.zScore > 0 ? "is-high" : "is-low"}>
                    <strong>{row.ticker}</strong>
                    <span className="tnum">z {fmt(row.zScore)}</span>
                    <Link href={`/companies/${encodeURIComponent(row.ticker)}`}>Inspect →</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="brief-quant-panel" aria-labelledby="brief-quant-table-title">
            <div className="brief-panel-label">
              <h3 id="brief-quant-table-title">02 / Z-score · beta · realized vol</h3>
              <span>{rows.length} names</span>
            </div>
            <div className="brief-quant-table" role="table" aria-label="Quant telemetry by ticker">
              <div className="brief-quant-table-row is-head" role="row">
                <span role="columnheader">Ticker</span>
                <span role="columnheader">Spark</span>
                <span role="columnheader">Z</span>
                <span role="columnheader">β/{BENCH}</span>
                <span role="columnheader">RV</span>
              </div>
              {rows.map((row) => (
                <div
                  key={row.ticker}
                  className={`brief-quant-table-row${row.anomaly ? " is-anomaly" : ""}`}
                  role="row"
                >
                  <span role="cell">
                    <Link href={`/companies/${encodeURIComponent(row.ticker)}`}>{row.ticker}</Link>
                    <small>{row.held ? "Owned" : "Watched"}</small>
                  </span>
                  <span role="cell">
                    <Spark values={row.spark} anomaly={row.anomaly} />
                  </span>
                  <span role="cell" className="tnum">
                    {fmt(row.zScore)}
                  </span>
                  <span role="cell" className="tnum">
                    {fmt(row.beta)}
                  </span>
                  <span role="cell" className="tnum">
                    {row.realizedVol == null ? "—" : `${(row.realizedVol * 100).toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="brief-quant-panel" aria-labelledby="brief-quant-corr-title">
            <div className="brief-panel-label">
              <h3 id="brief-quant-corr-title">03 / Return correlation grid</h3>
              <span>60-session</span>
            </div>
            <CorrHeat tickers={corr.tickers} values={corr.values} />
            <p>
              Pairwise correlations from overlapping daily returns — concentration risk among names
              in scope, not a multi-factor style model.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
