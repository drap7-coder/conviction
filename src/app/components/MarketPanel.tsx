"use client";

import { useEffect, useState } from "react";
import { fetchMarketHistory } from "@/lib/market/client-market-data";
import type { StockHistory } from "@/lib/market/quotes";
import type { EvidenceStatus } from "./evidence-request";
import { PriceTrendCard, type TrendRange } from "./PriceTrendCard";
import { TechnicalStateCard } from "./TechnicalStateCard";

interface MarketPanelProps {
  ticker: string;
}

/**
 * Owns a single history fetch for the ticker+range and feeds both the trend
 * chart and technicals — avoids a second /api/market/history from PriceTrendCard.
 */
export function MarketPanel({ ticker }: MarketPanelProps) {
  const [range, setRange] = useState<TrendRange>("1y");
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const next = await fetchMarketHistory(ticker, range, {
          reason: "initial",
          signal: controller.signal,
        });
        if (cancelled) return;
        setHistory(next);
        setStatus(next.points.length >= 2 ? "success" : "empty");
      } catch {
        if (cancelled) return;
        setHistory(null);
        setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, range]);

  return (
    <div className="market-panel-opening">
      <PriceTrendCard
        ticker={ticker}
        history={history}
        status={status}
        activeRange={range}
        onRangeChange={setRange}
      />
      <TechnicalStateCard
        history={history}
        status={status}
        currentPrice={history?.endPrice ?? null}
      />
    </div>
  );
}
