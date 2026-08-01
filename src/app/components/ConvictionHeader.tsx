"use client";

import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "./evidence-request";
import { fetchConvictionScore } from "./fetch-conviction-score";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dollarVolume: number | null;
  currency: string | null;
  marketState: string | null;
}

interface ConvictionHeaderProps {
  ticker: string;
  companyName: string;
}

export function ConvictionHeader({ ticker, companyName }: ConvictionHeaderProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [score, setScore] = useState<ConvictionScoreView | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
          6_000,
        );
        if (!cancelled && data.quotes?.[0]) {
          setQuote(data.quotes[0]);
        }
      } catch {
        // Quote is optional decoration beside the shared score.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadScore() {
      setScoreLoading(true);
      const next = await fetchConvictionScore(ticker, controller.signal);
      if (!cancelled) {
        setScore(next);
        setScoreLoading(false);
      }
    }
    void loadScore();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, companyName]);

  const toneClass = score?.evidenceTone ?? "quiet";
  const changeText =
    quote?.change !== null && quote?.change !== undefined
      ? `$${ticker} ${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent != null && quote.changePercent >= 0 ? "+" : ""}${(quote.changePercent ?? 0).toFixed(2)}%)`
      : null;

  return (
    <div className={`conviction-header conviction-header-${toneClass}${scoreLoading ? " conviction-header-loading" : ""}`}>
      <div className="conviction-header-score">
        <span className="conviction-header-score-value">
          {scoreLoading ? "…" : score?.displayScore ?? "—"}
        </span>
        <span className="conviction-header-score-sep">/</span>
        <span className="conviction-header-score-state">
          {scoreLoading ? "Scoring" : score?.ringLabel ?? "Awaiting"}
        </span>
      </div>
      <div className="conviction-header-details">
        {changeText && (
          <span className={`conviction-header-change ${quote != null && quote.change !== null && quote.change !== undefined && quote.change >= 0 ? "positive" : "negative"}`}>
            {changeText}
          </span>
        )}
        {score?.detail ? (
          <span className="conviction-header-insight">{score.detail}</span>
        ) : null}
      </div>
    </div>
  );
}
