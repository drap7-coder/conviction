"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout } from "./evidence-request";
import { getCardVerdict } from "@/lib/evidence/card-verdict";

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
        // Quote is optional; header still shows evidence-based verdict
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [ticker]);

  const verdict = useMemo(() => {
    // Build a minimal CardVerdictEntry from what we have
    return getCardVerdict(
      {
        ticker,
        companyName,
        addedAt: "",
        status: "active",
      },
      quote ?? undefined,
      undefined,
    );
  }, [ticker, companyName, quote]);

  const toneClass = verdict.tone;
  const changeText =
    quote?.change !== null && quote?.change !== undefined
      ? `$${ticker} ${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent != null && quote.changePercent >= 0 ? "+" : ""}${(quote.changePercent ?? 0).toFixed(2)}%)`
      : null;

  return (
    <div className={`conviction-header conviction-header-${toneClass}`}>
      <div className="conviction-header-score">
        <span className="conviction-header-score-value">{verdict.strength}</span>
        <span className="conviction-header-score-sep">/</span>
        <span className="conviction-header-score-state">{verdict.state}</span>
      </div>
      <div className="conviction-header-details">
        {changeText && (
          <span className={`conviction-header-change ${quote != null && quote.change !== null && quote.change !== undefined && quote.change >= 0 ? "positive" : "negative"}`}>
            {changeText}
          </span>
        )}
        {verdict.insight && (
          <span className="conviction-header-insight">{verdict.insight}</span>
        )}
      </div>
    </div>
  );
}
