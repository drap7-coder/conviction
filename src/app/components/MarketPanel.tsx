"use client";

import { useEffect, useState } from "react";
import { fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { TechnicalStateCard } from "./TechnicalStateCard";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
// Today & industry change temporarily suppressed — restore this import when re-enabling:
// import { TodayAndIndustryCard } from "./TodayAndPeersCard";

interface StockHistoryPoint {
  date: string;
  close: number;
}

interface StockHistory {
  ticker: string;
  range: string;
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
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const [historyData, quotesData] = await Promise.all([
          fetchJsonWithTimeout<HistoryResponse>(
            `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
            8_000,
            controller.signal,
          ),
          fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
            `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
            8_000,
            controller.signal,
          ).catch(() => null),
        ]);
        setHistory(historyData.history);
        const quote = quotesData?.quotes?.[0] ?? null;
        setLivePrice(quote ? getLivePrice(quote).price : null);
        setStatus(historyData.history.points.length >= 2 ? "success" : "empty");
      } catch {
        setHistory(null);
        setLivePrice(null);
        setStatus("error");
      }
    }

    void load();
    return () => controller.abort();
  }, [ticker]);

  // Prefer live session price so dashboard technicals stay session-aware.
  return (
    <>
      <TechnicalStateCard
        history={history}
        status={status}
        currentPrice={livePrice ?? history?.endPrice ?? null}
      />
      {/* Today & industry change temporarily suppressed — restore when ready:
      <TodayAndIndustryCard ticker={ticker} /> */}
    </>
  );
}
