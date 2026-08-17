"use client";

import { useEffect, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { PriceTrendCard, type TrendRange } from "./PriceTrendCard";
import { TechnicalStateCard } from "./TechnicalStateCard";

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

interface MarketPanelProps {
  ticker: string;
}

export function MarketPanel({ ticker }: MarketPanelProps) {
  const [range, setRange] = useState<TrendRange>("1y");
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<HistoryResponse>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=${range}`,
          8_000,
          controller.signal,
        );
        setHistory(data.history);
        setStatus(data.history.points.length >= 2 ? "success" : "empty");
      } catch {
        setHistory(null);
        setStatus("error");
      }
    }

    void load();
    return () => controller.abort();
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
