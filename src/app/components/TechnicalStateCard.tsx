"use client";

import { useMemo } from "react";
import { deriveTechnicalState, type TechnicalState } from "@/lib/market/technical-state";
import type { EvidenceStatus } from "./evidence-request";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface StockHistory {
  ticker: string;
  range: string;
  points: StockHistoryPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  endPrice: number | null;
}

interface TechnicalStateCardProps {
  history: StockHistory | null;
  status: EvidenceStatus;
  currentPrice: number | null;
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function deltaClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "signal-neutral";
  return value >= 0 ? "signal-positive" : "signal-negative";
}

function bullishLabel(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value >= 0 ? "Bullish" : "Bearish";
}

function stateClass(state: TechnicalState): string {
  const label = state.label;
  if (label === "Insufficient Data" || label === "Mixed Signal") return "state-neutral";
  if (label === "Trend Resisting" || label === "Golden Cross" || label === "Recovering") return "state-bullish";
  if (label === "Death Cross" || label === "Trend Lagging") return "state-bearish";
  return "state-neutral";
}

export function TechnicalStateCard({ history, status, currentPrice }: TechnicalStateCardProps) {
  const technicalState = useMemo(() => {
    if (!history || history.points.length === 0) return null;
    return deriveTechnicalState(
      history.points,
      currentPrice ?? history.endPrice,
      history.fiftyTwoWeekHigh,
      history.fiftyTwoWeekLow,
    );
  }, [history, currentPrice]);

  if (status === "loading") {
    return (
      <div className="technical-state-card" aria-label="Technical state loading">
        <div className="technical-state-header">
          <span className="technical-state-label state-neutral">
            <span className="state-dot" />
            Loading
          </span>
        </div>
        <p className="technical-state-interp">Calculating moving averages and trend metrics...</p>
      </div>
    );
  }

  if (status === "error" || !technicalState) {
    return (
      <div className="technical-state-card" aria-label="Technical state unavailable">
        <div className="technical-state-header">
          <span className="technical-state-label state-insufficient">
            <span className="state-dot" />
            Unavailable
          </span>
        </div>
        <p className="technical-state-interp">Technical indicators require trading history. Not available for this range.</p>
      </div>
    );
  }

  const cls = stateClass(technicalState);
  const sma50Bullish = bullishLabel(technicalState.sma50Delta);
  const sma200Bullish = bullishLabel(technicalState.sma200Delta);
  const sma50DeltaStr = formatDelta(technicalState.sma50Delta);
  const sma200DeltaStr = formatDelta(technicalState.sma200Delta);

  return (
    <div className="technical-state-card" aria-label="Technical state">
      <div className="technical-state-header">
        <span className={`technical-state-label ${cls}`}>
          <span className="state-dot" />
          {technicalState.label}
        </span>
      </div>
      <p className="technical-state-interp">{technicalState.interpretation}</p>
      <div className="technical-state-grid">
        {/* SMA-50: verdict first */}
        <div className="technical-state-stat">
          <span className="stat-label">SMA-50</span>
          {sma50Bullish ? (
            <span className={`stat-verdict ${deltaClass(technicalState.sma50Delta)}`}>
              {sma50Bullish}
            </span>
          ) : (
            <span className="stat-value">—</span>
          )}
          {sma50DeltaStr ? (
            <span className={`stat-delta ${deltaClass(technicalState.sma50Delta)}`}>
              {sma50DeltaStr}
            </span>
          ) : null}
          <span className="stat-signal">{formatPrice(technicalState.sma50)}</span>
        </div>

        {/* SMA-200: verdict first */}
        <div className="technical-state-stat">
          <span className="stat-label">SMA-200</span>
          {sma200Bullish ? (
            <span className={`stat-verdict ${deltaClass(technicalState.sma200Delta)}`}>
              {sma200Bullish}
            </span>
          ) : (
            <span className="stat-value">—</span>
          )}
          {sma200DeltaStr ? (
            <span className={`stat-delta ${deltaClass(technicalState.sma200Delta)}`}>
              {sma200DeltaStr}
            </span>
          ) : null}
          <span className="stat-signal">{formatPrice(technicalState.sma200)}</span>
        </div>

        {/* 52W Range: same verdict-first pattern */}
        <div className="technical-state-stat">
          <span className="stat-label">52W Range</span>
          {technicalState.fiftyTwoWeekPercentile !== null ? (
            <>
              <span className={`stat-verdict ${technicalState.fiftyTwoWeekPercentile >= 50 ? "signal-positive" : "signal-negative"}`}>
                {technicalState.fiftyTwoWeekPercentile >= 50 ? "Upper half" : "Lower half"}
              </span>
              <span className={`stat-delta ${technicalState.fiftyTwoWeekPercentile >= 50 ? "signal-positive" : "signal-negative"}`}>
                {technicalState.fiftyTwoWeekPercentile.toFixed(0)}% of 52W
              </span>
              <span className="stat-signal">
                {formatPrice(technicalState.fiftyTwoWeekLow)} – {formatPrice(technicalState.fiftyTwoWeekHigh)}
              </span>
            </>
          ) : (
            <span className="stat-value">—</span>
          )}
        </div>
      </div>
    </div>
  );
}