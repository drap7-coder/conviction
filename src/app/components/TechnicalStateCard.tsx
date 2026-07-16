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
  return `$${value.toFixed(value >= 100 ? 2 : 2)}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function stateClass(state: TechnicalState): string {
  const label = state.label;
  if (label === "Insufficient Data" || label === "Mixed Signal") return "state-neutral";
  if (label === "Trend Resisting" || label === "Golden Cross" || label === "Recovering") return "state-bullish";
  if (label === "Death Cross" || label === "Trend Lagging") return "state-bearish";
  return "state-neutral";
}

function relationLabel(relation: string | null): string {
  if (relation === "above") return "Above";
  if (relation === "below") return "Below";
  if (relation === "equal") return "At";
  return "—";
}

function relationSignal(relation: string | null): "signal-positive" | "signal-negative" | "signal-neutral" {
  if (relation === "above") return "signal-positive";
  if (relation === "below") return "signal-negative";
  return "signal-neutral";
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
        <div className="technical-state-stat">
          <span className="stat-label">SMA-50</span>
          <span className="stat-value">
            {technicalState.sma50 !== null ? formatPrice(technicalState.sma50) : "—"}
          </span>
          <span className={`stat-signal ${relationSignal(technicalState.sma50Relation)}`}>
            {relationLabel(technicalState.sma50Relation)} price
          </span>
        </div>
        <div className="technical-state-stat">
          <span className="stat-label">SMA-200</span>
          <span className="stat-value">
            {technicalState.sma200 !== null ? formatPrice(technicalState.sma200) : "—"}
          </span>
          <span className={`stat-signal ${relationSignal(technicalState.sma200Relation)}`}>
            {relationLabel(technicalState.sma200Relation)} price
          </span>
        </div>
        <div className="technical-state-stat">
          <span className="stat-label">52W Range</span>
          <span className="stat-value">
            {technicalState.fiftyTwoWeekPercentile !== null
              ? `${formatPercent(technicalState.fiftyTwoWeekPercentile)}`
              : "—"}
          </span>
          <span className="stat-signal signal-neutral">
            {technicalState.fiftyTwoWeekPercentile !== null
              ? technicalState.fiftyTwoWeekPercentile >= 50 ? "Upper half" : "Lower half"
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}