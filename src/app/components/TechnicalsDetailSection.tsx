"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TechnicalStateCard } from "@/app/components/TechnicalStateCard";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import type { StockQuote } from "@/lib/market/quotes";

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

/** Detail panel for the Technicals Conviction Signals row. */
export function TechnicalsDetailSection({ ticker }: { ticker: string }) {
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const [historyData, quoteData] = await Promise.all([
          fetchJsonWithTimeout<StockHistory>(
            `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
            14_000,
            controller.signal,
          ),
          fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
            `/api/market/quotes?tickers=${encodeURIComponent(ticker)}`,
            10_000,
            controller.signal,
          ),
        ]);
        if (cancelled) return;
        const points = Array.isArray(historyData?.points) ? historyData.points : [];
        setHistory(points.length > 0 ? { ...historyData, points } : null);
        setCurrentPrice(quoteData.quotes?.[0]?.price ?? historyData?.endPrice ?? null);
        setStatus(points.length > 0 ? "success" : "empty");
      } catch (caught) {
        if (!cancelled) {
          const next = classifyClientError(caught);
          setStatus(next === "idle" ? "error" : next);
          setHistory(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  return (
    <TechnicalsDetailShell>
      <TechnicalStateCard
        history={history}
        status={status === "empty" ? "error" : status}
        currentPrice={currentPrice}
      />
    </TechnicalsDetailShell>
  );
}

function TechnicalsDetailShell({ children }: { children: ReactNode }) {
  return <div className="conviction-signal-technicals-detail">{children}</div>;
}
